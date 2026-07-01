const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// GET /login
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', { title: 'Login' });
});

// POST /login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        req.flash('error', 'Please enter both username and password');
        return res.redirect('/login');
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);

        if (rows.length === 0) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/login');
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/login');
        }

        // Update last login
        await db.query("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);

        // Store user in session
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar_color: user.avatar_color
        };

        req.flash('success', `Welcome back, ${user.full_name}!`);
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/login');
    }
});

// GET /dashboard
router.get('/dashboard', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const [teacherCount] = await db.query('SELECT COUNT(*) as count FROM teachers');
        const [staffCount] = await db.query('SELECT COUNT(*) as count FROM staff');
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
        const [activeTeachers] = await db.query("SELECT COUNT(*) as count FROM teachers WHERE status = 'Active'");
        const [activeStaff] = await db.query("SELECT COUNT(*) as count FROM staff WHERE status = 'Active'");
        const [recentTeachers] = await db.query('SELECT * FROM teachers ORDER BY created_at DESC LIMIT 5');
        const [recentStaff] = await db.query('SELECT * FROM staff ORDER BY created_at DESC LIMIT 5');
        const [onLeaveTeachers] = await db.query("SELECT COUNT(*) as count FROM teachers WHERE status = 'On Leave'");
        const [onLeaveStaff] = await db.query("SELECT COUNT(*) as count FROM staff WHERE status = 'On Leave'");

        res.render('dashboard', {
            title: 'Dashboard',
            stats: {
                totalTeachers: teacherCount[0].count,
                totalStaff: staffCount[0].count,
                totalUsers: userCount[0].count,
                activeTeachers: activeTeachers[0].count,
                activeStaff: activeStaff[0].count,
                onLeaveTeachers: onLeaveTeachers[0].count,
                onLeaveStaff: onLeaveStaff[0].count
            },
            recentTeachers,
            recentStaff
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        req.flash('error', 'Failed to load dashboard data');
        res.render('dashboard', {
            title: 'Dashboard',
            stats: { totalTeachers: 0, totalStaff: 0, totalUsers: 0, activeTeachers: 0, activeStaff: 0, onLeaveTeachers: 0, onLeaveStaff: 0 },
            recentTeachers: [],
            recentStaff: []
        });
    }
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/login');
    });
});

module.exports = router;
