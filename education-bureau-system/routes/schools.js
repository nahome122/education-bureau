const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, requirePermission } = require('../middleware/auth');

router.use(isAuthenticated);

// GET /schools - list schools
router.get('/', requirePermission('schools', 'read'), async (req, res) => {
    try {
        const [schools] = await db.query('SELECT * FROM schools ORDER BY name ASC');
        res.render('schools', { title: 'School Management', schools });
    } catch (err) {
        console.error('Schools list error:', err);
        req.flash('error', 'Failed to load schools');
        res.render('schools', { title: 'School Management', schools: [] });
    }
});

// POST /schools - add new school
router.post('/', requirePermission('schools', 'create'), async (req, res) => {
    const { name, address, description } = req.body;
    try {
        await db.query(
            'INSERT INTO schools (name, address, description) VALUES (?, ?, ?)',
            [name, address || null, description || null]
        );
        req.flash('success', `School "${name}" added successfully`);
    } catch (err) {
        console.error('Add school error:', err);
        req.flash('error', 'Failed to add school');
    }
    res.redirect('/schools');
});

// POST /schools/:id/update - update school
router.post('/:id/update', requirePermission('schools', 'update'), async (req, res) => {
    const { id } = req.params;
    const { name, address, description } = req.body;
    try {
        await db.query(
            'UPDATE schools SET name = ?, address = ?, description = ? WHERE id = ?',
            [name, address || null, description || null, id]
        );
        req.flash('success', `School "${name}" updated successfully`);
    } catch (err) {
        console.error('Update school error:', err);
        req.flash('error', 'Failed to update school');
    }
    res.redirect('/schools');
});

// POST /schools/:id/delete - delete school
router.post('/:id/delete', requirePermission('schools', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
        const [teachers] = await db.query('SELECT id FROM teachers WHERE school_id = ?', [id]);
        if (teachers.length > 0) {
            req.flash('error', 'Cannot delete school while teachers are assigned to it.');
            return res.redirect('/schools');
        }
        await db.query('DELETE FROM schools WHERE id = ?', [id]);
        req.flash('success', 'School deleted successfully');
    } catch (err) {
        console.error('Delete school error:', err);
        req.flash('error', 'Failed to delete school');
    }
    res.redirect('/schools');
});

module.exports = router;
