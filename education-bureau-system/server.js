const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();

const app = express();
const { canRead, canCreate, canUpdate, canDelete } = require('./middleware/permissions');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.user = req.session.user || null;
    
    // Permission helpers for views
    if (req.session.user) {
        const role = req.session.user.role;
        res.locals.canRead = (resource) => canRead(role, resource);
        res.locals.canCreate = (resource) => canCreate(role, resource);
        res.locals.canUpdate = (resource) => canUpdate(role, resource);
        res.locals.canDelete = (resource) => canDelete(role, resource);
    }
    
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const staffRoutes = require('./routes/staff');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const leavesRoutes = require('./routes/leaves');
const schoolRoutes = require('./routes/schools');

app.use('/', authRoutes);
app.use('/teachers', teacherRoutes);
app.use('/staff', staffRoutes);
app.use('/users', userRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/leaves', leavesRoutes);
app.use('/schools', schoolRoutes);

// Root redirect
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('login', {
        title: '404 - Page Not Found',
        error_msg: ['Page not found'],
        success_msg: []
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).send('Something went wrong!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🏫 Teachers & Staff Management System`);
    console.log(`   Wachale Woreda Education Bureau`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   🌐 Server running at: http://localhost:${PORT}`);
    console.log(`   📋 Login: admin / admin123\n`);
});
