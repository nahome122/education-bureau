const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Apply auth + admin middleware
router.use(isAuthenticated);
router.use(isAdmin);

// GET /users - List all users
router.get('/', async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, email, full_name, role, avatar_color, is_active, last_login, created_at FROM users ORDER BY created_at DESC');
        res.render('users', { title: 'User Management', users });
    } catch (err) {
        console.error('Users list error:', err);
        req.flash('error', 'Failed to load users');
        res.render('users', { title: 'User Management', users: [] });
    }
});

// POST /users - Add new user
router.post('/', async (req, res) => {
    const { username, email, password, full_name, role } = req.body;

    try {
        // Check if username or email exists
        const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing.length > 0) {
            req.flash('error', 'Username or email already exists');
            return res.redirect('/users');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const colors = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        await db.query(
            'INSERT INTO users (username, email, password, full_name, role, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, full_name, role || 'viewer', randomColor]
        );
        req.flash('success', `User "${username}" created successfully`);
    } catch (err) {
        console.error('Add user error:', err);
        req.flash('error', 'Failed to create user');
    }
    res.redirect('/users');
});

// POST /users/:id/update - Update user
router.post('/:id/update', async (req, res) => {
    const { id } = req.params;
    const { username, email, password, full_name, role, is_active } = req.body;

    try {
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET username=?, email=?, password=?, full_name=?, role=?, is_active=? WHERE id=?',
                [username, email, hashedPassword, full_name, role, is_active ? 1 : 0, id]
            );
        } else {
            await db.query(
                'UPDATE users SET username=?, email=?, full_name=?, role=?, is_active=? WHERE id=?',
                [username, email, full_name, role, is_active ? 1 : 0, id]
            );
        }
        req.flash('success', `User "${username}" updated successfully`);
    } catch (err) {
        console.error('Update user error:', err);
        req.flash('error', 'Failed to update user');
    }
    res.redirect('/users');
});

// POST /users/:id/delete - Delete user
router.post('/:id/delete', async (req, res) => {
    const { id } = req.params;

    // Prevent deleting own account
    if (parseInt(id) === req.session.user.id) {
        req.flash('error', 'You cannot delete your own account');
        return res.redirect('/users');
    }

    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        req.flash('success', 'User deleted successfully');
    } catch (err) {
        console.error('Delete user error:', err);
        req.flash('error', 'Failed to delete user');
    }
    res.redirect('/users');
});

module.exports = router;
