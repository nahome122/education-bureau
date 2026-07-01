const { hasPermission } = require('./permissions');

// Authentication middleware
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
}

// Admin-only middleware
function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Access denied. Admin privileges required.');
    res.redirect('/dashboard');
}

// Manager or Admin middleware
function isManagerOrAdmin(req, res, next) {
    if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'manager')) {
        return next();
    }
    req.flash('error', 'Access denied. Manager or Admin privileges required.');
    res.redirect('/dashboard');
}

// Permission-based middleware factory
function requirePermission(resource, action) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            req.flash('error', 'Please log in');
            return res.redirect('/login');
        }

        const { role } = req.session.user;
        if (!hasPermission(role, resource, action)) {
            req.flash('error', `Access denied. You don't have permission to ${action} ${resource}`);
            return res.redirect('/dashboard');
        }

        next();
    };
}

module.exports = { isAuthenticated, isAdmin, isManagerOrAdmin, requirePermission };
