const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, requirePermission } = require('../middleware/auth');

router.use(isAuthenticated);

// GET /attendance — show bulk daily register
router.get('/', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const type = req.query.type || 'teacher';

        let people = [];
        if (type === 'teacher') {
            const [rows] = await db.query("SELECT id, full_name, gender, school_name as info, status FROM teachers WHERE status = 'Active' ORDER BY full_name");
            people = rows;
        } else {
            const [rows] = await db.query("SELECT id, full_name, gender, department as info, status FROM staff WHERE status = 'Active' ORDER BY full_name");
            people = rows;
        }

        // Get existing attendance for this date and type
        const [existing] = await db.query(
            "SELECT person_id, status, notes FROM attendance WHERE person_type = ? AND date = ?",
            [type, date]
        );
        const attendanceMap = {};
        existing.forEach(r => { attendanceMap[r.person_id] = r; });

        // Stats for the chosen date
        const [statsRows] = await db.query(
            "SELECT status, COUNT(*) as count FROM attendance WHERE person_type = ? AND date = ? GROUP BY status",
            [type, date]
        );
        const stats = { Present: 0, Absent: 0, Late: 0 };
        statsRows.forEach(r => { stats[r.status] = r.count; });

        // Recent dates that have records
        const [recentDates] = await db.query(
            "SELECT DISTINCT date FROM attendance WHERE person_type = ? ORDER BY date DESC LIMIT 10",
            [type]
        );

        res.render('attendance', {
            title: 'Attendance',
            people,
            date,
            type,
            attendanceMap,
            stats,
            recentDates
        });
    } catch (err) {
        console.error('Attendance error:', err);
        req.flash('error', 'Failed to load attendance');
        res.redirect('/dashboard');
    }
});

// POST /attendance — save bulk attendance for a date
router.post('/', requirePermission('attendance', 'create'), async (req, res) => {
    try {
        const { date, type, records } = req.body;
        // records is an array of { person_id, status, notes }
        const parsedRecords = Array.isArray(records) ? records : [records];

        for (const r of parsedRecords) {
            if (!r || !r.person_id) continue;
            // Upsert: if exists update, else insert
            const [exists] = await db.query(
                "SELECT id FROM attendance WHERE person_type = ? AND person_id = ? AND date = ?",
                [type, r.person_id, date]
            );
            if (exists.length > 0) {
                await db.query(
                    "UPDATE attendance SET status = ?, notes = ?, recorded_by = ? WHERE person_type = ? AND person_id = ? AND date = ?",
                    [r.status || 'Present', r.notes || null, req.session.user.id, type, r.person_id, date]
                );
            } else {
                await db.query(
                    "INSERT INTO attendance (person_type, person_id, date, status, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)",
                    [type, r.person_id, date, r.status || 'Present', r.notes || null, req.session.user.id]
                );
            }
        }
        req.flash('success', `Attendance saved for ${date}`);
    } catch (err) {
        console.error('Save attendance error:', err);
        req.flash('error', 'Failed to save attendance');
    }
    res.redirect(`/attendance?date=${req.body.date}&type=${req.body.type}`);
});

module.exports = router;
