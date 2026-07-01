const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, requirePermission } = require('../middleware/auth');

router.use(isAuthenticated);

const PAGE_SIZE = 10;

// GET /staff - List with search, filter, pagination
router.get('/', async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const page = parseInt(req.query.page) || 1;
        let query = 'SELECT * FROM staff';
        let countQuery = 'SELECT COUNT(*) as total FROM staff';
        let params = [];
        let conditions = [];

        if (search) {
            conditions.push('(full_name LIKE ? OR position LIKE ? OR department LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) { conditions.push('status = ?'); params.push(status); }

        if (conditions.length > 0) {
            const where = ' WHERE ' + conditions.join(' AND ');
            query += where;
            countQuery += where;
        }

        const [countRows] = await db.query(countQuery, params);
        const total = countRows[0].total;
        const totalPages = Math.ceil(total / PAGE_SIZE);

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);

        const [staff] = await db.query(query, params);
        res.render('staff', { title: 'Staff Management', staff, search, status, page, totalPages, total });
    } catch (err) {
        console.error('Staff list error:', err);
        req.flash('error', 'Failed to load staff');
        res.render('staff', { title: 'Staff Management', staff: [], search: '', status: '', page: 1, totalPages: 1, total: 0 });
    }
});

// GET /staff/export - CSV export
router.get('/export', async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        let query = 'SELECT * FROM staff';
        let params = [];
        let conditions = [];

        if (search) {
            conditions.push('(full_name LIKE ? OR position LIKE ? OR department LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) { conditions.push('status = ?'); params.push(status); }
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY full_name';

        const [staff] = await db.query(query, params);

        const headers = ['ID','Full Name','Gender','Position','Department','Phone','Email','Hire Date','Salary','Experience (Yrs)','Status','Notes'];
        const rows = staff.map(s => [
            s.id, s.full_name, s.gender, s.position, s.department,
            s.phone || '', s.email || '',
            s.hire_date ? s.hire_date.split('T')[0] : '',
            s.salary, s.experience_years, s.status, (s.notes || '').replace(/,/g, ';')
        ]);

        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="staff_export.csv"');
        res.send(csv);
    } catch (err) {
        console.error('Export error:', err);
        req.flash('error', 'Export failed');
        res.redirect('/staff');
    }
});

// GET /staff/:id - Profile page
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM staff WHERE id = ?', [id]);
        if (rows.length === 0) {
            req.flash('error', 'Staff member not found');
            return res.redirect('/staff');
        }
        const member = rows[0];

        const [attendance] = await db.query(
            "SELECT * FROM attendance WHERE person_type = 'staff' AND person_id = ? ORDER BY date DESC LIMIT 30",
            [id]
        );
        const [leaves] = await db.query(
            "SELECT * FROM leaves WHERE person_type = 'staff' AND person_id = ? ORDER BY created_at DESC",
            [id]
        );
        const [attSummary] = await db.query(
            "SELECT status, COUNT(*) as count FROM attendance WHERE person_type = 'staff' AND person_id = ? GROUP BY status",
            [id]
        );
        const attStats = { Present: 0, Absent: 0, Late: 0 };
        attSummary.forEach(r => { attStats[r.status] = r.count; });

        res.render('staff-profile', {
            title: member.full_name,
            member,
            attendance,
            leaves,
            attStats
        });
    } catch (err) {
        console.error('Staff profile error:', err);
        req.flash('error', 'Failed to load staff profile');
        res.redirect('/staff');
    }
});

// POST /staff - Add new staff
router.post('/', requirePermission('staff', 'create'), async (req, res) => {
    const { full_name, gender, position, department, phone, email, hire_date, salary, experience_years, status, notes } = req.body;
    try {
        await db.query(
            'INSERT INTO staff (full_name, gender, position, department, phone, email, hire_date, salary, experience_years, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [full_name, gender, position, department, phone || null, email || null, hire_date, salary || 0, experience_years || 0, status || 'Active', notes || null]
        );
        req.flash('success', `Staff "${full_name}" added successfully`);
    } catch (err) {
        console.error('Add staff error:', err);
        req.flash('error', 'Failed to add staff member');
    }
    res.redirect('/staff');
});

// POST /staff/:id/update - Update staff
router.post('/:id/update', requirePermission('staff', 'update'), async (req, res) => {
    const { id } = req.params;
    const { full_name, gender, position, department, phone, email, hire_date, salary, experience_years, status, notes } = req.body;
    try {
        await db.query(
            'UPDATE staff SET full_name=?, gender=?, position=?, department=?, phone=?, email=?, hire_date=?, salary=?, experience_years=?, status=?, notes=? WHERE id=?',
            [full_name, gender, position, department, phone || null, email || null, hire_date, salary || 0, experience_years || 0, status, notes || null, id]
        );
        req.flash('success', `Staff "${full_name}" updated successfully`);
    } catch (err) {
        console.error('Update staff error:', err);
        req.flash('error', 'Failed to update staff member');
    }
    res.redirect('/staff');
});

// POST /staff/:id/delete - Delete staff
router.post('/:id/delete', requirePermission('staff', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM staff WHERE id = ?', [id]);
        req.flash('success', 'Staff member deleted successfully');
    } catch (err) {
        console.error('Delete staff error:', err);
        req.flash('error', 'Failed to delete staff member');
    }
    res.redirect('/staff');
});

module.exports = router;
