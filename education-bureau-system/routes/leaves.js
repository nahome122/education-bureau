const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isAdmin, requirePermission } = require('../middleware/auth');

router.use(isAuthenticated);

// Helper: get person name
async function getPersonName(type, id) {
    const table = type === 'teacher' ? 'teachers' : 'staff';
    const [rows] = await db.query(`SELECT full_name FROM ${table} WHERE id = ?`, [id]);
    return rows.length > 0 ? rows[0].full_name : 'Unknown';
}

// GET /leaves — list all leave requests
router.get('/', async (req, res) => {
    try {
        const statusFilter = req.query.status || '';
        const typeFilter = req.query.type || '';

        let query = "SELECT * FROM leaves";
        let params = [];
        let conditions = [];
        if (statusFilter) { conditions.push("status = ?"); params.push(statusFilter); }
        if (typeFilter) { conditions.push("person_type = ?"); params.push(typeFilter); }
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY created_at DESC';

        const [leaves] = await db.query(query, params);

        // Enrich with person names
        for (const leave of leaves) {
            leave.person_name = await getPersonName(leave.person_type, leave.person_id);
            // Calculate days
            const from = new Date(leave.from_date);
            const to = new Date(leave.to_date);
            leave.days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
        }

        // Get teachers and staff for the "add leave" form
        const [teachers] = await db.query("SELECT id, full_name FROM teachers WHERE status = 'Active' ORDER BY full_name");
        const [staff] = await db.query("SELECT id, full_name FROM staff WHERE status = 'Active' ORDER BY full_name");

        res.render('leaves', {
            title: 'Leave Management',
            leaves,
            teachers,
            staff,
            statusFilter,
            typeFilter
        });
    } catch (err) {
        console.error('Leaves list error:', err);
        req.flash('error', 'Failed to load leaves');
        res.redirect('/dashboard');
    }
});

// POST /leaves — submit a new leave request
router.post('/', requirePermission('leaves', 'create'), async (req, res) => {
    const { person_type, person_id, leave_type, from_date, to_date, reason } = req.body;
    try {
        await db.query(
            "INSERT INTO leaves (person_type, person_id, leave_type, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')",
            [person_type, person_id, leave_type, from_date, to_date, reason || null]
        );
        const name = await getPersonName(person_type, person_id);
        req.flash('success', `Leave request for "${name}" submitted successfully`);
    } catch (err) {
        console.error('Add leave error:', err);
        req.flash('error', 'Failed to submit leave request');
    }
    res.redirect('/leaves');
});

// POST /leaves/:id/approve — approve a leave (admin only)
router.post('/:id/approve', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            "UPDATE leaves SET status = 'Approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?",
            [req.session.user.id, id]
        );
        req.flash('success', 'Leave request approved');
    } catch (err) {
        console.error('Approve leave error:', err);
        req.flash('error', 'Failed to approve leave');
    }
    res.redirect('/leaves');
});

// POST /leaves/:id/reject — reject a leave (admin only)
router.post('/:id/reject', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            "UPDATE leaves SET status = 'Rejected', approved_by = ?, approved_at = datetime('now') WHERE id = ?",
            [req.session.user.id, id]
        );
        req.flash('success', 'Leave request rejected');
    } catch (err) {
        console.error('Reject leave error:', err);
        req.flash('error', 'Failed to reject leave');
    }
    res.redirect('/leaves');
});

// POST /leaves/:id/delete — delete a leave
router.post('/:id/delete', requirePermission('leaves', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM leaves WHERE id = ?", [id]);
        req.flash('success', 'Leave request deleted');
    } catch (err) {
        console.error('Delete leave error:', err);
        req.flash('error', 'Failed to delete leave');
    }
    res.redirect('/leaves');
});

module.exports = router;
