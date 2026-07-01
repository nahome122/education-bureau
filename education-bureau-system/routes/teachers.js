const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, requirePermission } = require('../middleware/auth');

router.use(isAuthenticated);

const PAGE_SIZE = 10;

// GET /teachers - List with search, filter, pagination
router.get('/', async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const page = parseInt(req.query.page) || 1;
        let query = 'SELECT t.*, COALESCE(s.name, t.school_name) AS school_name FROM teachers t LEFT JOIN schools s ON t.school_id = s.id';
        let countQuery = 'SELECT COUNT(*) as total FROM teachers t LEFT JOIN schools s ON t.school_id = s.id';
        let params = [];
        let conditions = [];

        if (search) {
            conditions.push('(t.full_name LIKE ? OR COALESCE(s.name, t.school_name) LIKE ? OR t.subject_specialization LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }

        if (conditions.length > 0) {
            const where = ' WHERE ' + conditions.join(' AND ');
            query += where;
            countQuery += where;
        }

        const [countRows] = await db.query(countQuery, params);
        const total = countRows[0].total;
        const totalPages = Math.ceil(total / PAGE_SIZE);

        query += ' ORDER BY school_name ASC, full_name ASC LIMIT ? OFFSET ?';
        params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);

        const [teachers] = await db.query(query, params);
        const [schools] = await db.query('SELECT id, name FROM schools ORDER BY name ASC');
        res.render('teachers', { title: 'Teachers Management', teachers, schools, search, status, page, totalPages, total });
    } catch (err) {
        console.error('Teachers list error:', err);
        req.flash('error', 'Failed to load teachers');
        res.render('teachers', { title: 'Teachers Management', teachers: [], schools: [], search: '', status: '', page: 1, totalPages: 1, total: 0 });
    }
});

// GET /teachers/export - CSV export
router.get('/export', async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        let query = 'SELECT t.*, COALESCE(s.name, t.school_name) AS school_name FROM teachers t LEFT JOIN schools s ON t.school_id = s.id';
        let params = [];
        let conditions = [];

        if (search) {
            conditions.push('(t.full_name LIKE ? OR COALESCE(s.name, t.school_name) LIKE ? OR t.subject_specialization LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) { conditions.push('status = ?'); params.push(status); }
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY full_name';

        const [teachers] = await db.query(query, params);

        const headers = ['ID','Full Name','Gender','Qualification','Subject','School','Phone','Email','Hire Date','Salary','Experience (Yrs)','Status','Notes'];
        const rows = teachers.map(t => [
            t.id, t.full_name, t.gender, t.qualification, t.subject_specialization,
            t.school_name, t.phone || '', t.email || '',
            t.hire_date ? t.hire_date.split('T')[0] : '',
            t.salary, t.experience_years, t.status, (t.notes || '').replace(/,/g, ';')
        ]);

        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="teachers_export.csv"');
        res.send(csv);
    } catch (err) {
        console.error('Export error:', err);
        req.flash('error', 'Export failed');
        res.redirect('/teachers');
    }
});

// GET /teachers/:id - Profile page
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            'SELECT t.*, COALESCE(s.name, t.school_name) as school_name, s.id as school_id FROM teachers t LEFT JOIN schools s ON t.school_id = s.id WHERE t.id = ?',
            [id]
        );
        if (rows.length === 0) {
            req.flash('error', 'Teacher not found');
            return res.redirect('/teachers');
        }
        const teacher = rows[0];

        // Recent attendance (last 30 records)
        const [attendance] = await db.query(
            "SELECT * FROM attendance WHERE person_type = 'teacher' AND person_id = ? ORDER BY date DESC LIMIT 30",
            [id]
        );

        // Leave history
        const [leaves] = await db.query(
            "SELECT * FROM leaves WHERE person_type = 'teacher' AND person_id = ? ORDER BY created_at DESC",
            [id]
        );

        // Attendance summary
        const [attSummary] = await db.query(
            "SELECT status, COUNT(*) as count FROM attendance WHERE person_type = 'teacher' AND person_id = ? GROUP BY status",
            [id]
        );
        const attStats = { Present: 0, Absent: 0, Late: 0 };
        attSummary.forEach(r => { attStats[r.status] = r.count; });

        res.render('teacher-profile', {
            title: teacher.full_name,
            teacher,
            attendance,
            leaves,
            attStats
        });
    } catch (err) {
        console.error('Teacher profile error:', err);
        req.flash('error', 'Failed to load teacher profile');
        res.redirect('/teachers');
    }
});

// POST /teachers - Add new teacher
router.post('/', requirePermission('teachers', 'create'), async (req, res) => {
    const { full_name, gender, qualification, subject_specialization, school_id, phone, email, hire_date, salary, experience_years, status, notes } = req.body;
    try {
        const schoolId = school_id ? parseInt(school_id, 10) : null;
        let schoolName = null;
        if (schoolId) {
            const [schools] = await db.query('SELECT name FROM schools WHERE id = ?', [schoolId]);
            schoolName = schools.length ? schools[0].name : null;
        }
        await db.query(
            'INSERT INTO teachers (full_name, gender, qualification, subject_specialization, school_name, school_id, phone, email, hire_date, salary, experience_years, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [full_name, gender, qualification, subject_specialization, schoolName || null, schoolId, phone || null, email || null, hire_date, salary || 0, experience_years || 0, status || 'Active', notes || null]
        );
        req.flash('success', `Teacher "${full_name}" added successfully`);
    } catch (err) {
        console.error('Add teacher error:', err);
        req.flash('error', 'Failed to add teacher');
    }
    res.redirect('/teachers');
});

// POST /teachers/:id/update - Update teacher
router.post('/:id/update', requirePermission('teachers', 'update'), async (req, res) => {
    const { id } = req.params;
    const { full_name, gender, qualification, subject_specialization, school_id, phone, email, hire_date, salary, experience_years, status, notes } = req.body;
    try {
        const schoolId = school_id ? parseInt(school_id, 10) : null;
        let schoolName = null;
        if (schoolId) {
            const [schools] = await db.query('SELECT name FROM schools WHERE id = ?', [schoolId]);
            schoolName = schools.length ? schools[0].name : null;
        }
        await db.query(
            'UPDATE teachers SET full_name=?, gender=?, qualification=?, subject_specialization=?, school_name=?, school_id=?, phone=?, email=?, hire_date=?, salary=?, experience_years=?, status=?, notes=? WHERE id=?',
            [full_name, gender, qualification, subject_specialization, schoolName || null, schoolId, phone || null, email || null, hire_date, salary || 0, experience_years || 0, status, notes || null, id]
        );
        req.flash('success', `Teacher "${full_name}" updated successfully`);
    } catch (err) {
        console.error('Update teacher error:', err);
        req.flash('error', 'Failed to update teacher');
    }
    res.redirect('/teachers');
});

// POST /teachers/:id/delete - Delete teacher
router.post('/:id/delete', requirePermission('teachers', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM teachers WHERE id = ?', [id]);
        req.flash('success', 'Teacher deleted successfully');
    } catch (err) {
        console.error('Delete teacher error:', err);
        req.flash('error', 'Failed to delete teacher');
    }
    res.redirect('/teachers');
});

module.exports = router;
