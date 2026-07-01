// Role-Based Permissions System
// Defines what each role can do

const PERMISSIONS = {
    admin: {
        teachers: ['create', 'read', 'update', 'delete'],
        staff: ['create', 'read', 'update', 'delete'],
        attendance: ['create', 'read', 'update', 'delete'],
        leaves: ['create', 'read', 'update', 'delete'],
        users: ['create', 'read', 'update', 'delete'],
        schools: ['create', 'read', 'update', 'delete'],
    },
    manager: {
        teachers: ['create', 'read', 'update', 'delete'],
        staff: ['create', 'read', 'update', 'delete'],
        attendance: ['create', 'read', 'update', 'delete'],
        leaves: ['create', 'read', 'update', 'delete'],
        users: ['read'],
        schools: ['create', 'read', 'update', 'delete'],
    },
    viewer: {
        teachers: ['read'],
        staff: ['read'],
        attendance: ['read'],
        leaves: ['read'],
        users: [],
        schools: ['read'],
    },
};

/**
 * Check if a user has permission to perform an action on a resource
 * @param {string} role - User role
 * @param {string} resource - Resource name (e.g., 'teachers', 'staff')
 * @param {string} action - Action (e.g., 'create', 'read', 'update', 'delete')
 * @returns {boolean} - True if user has permission
 */
function hasPermission(role, resource, action) {
    if (!PERMISSIONS[role]) {
        return false;
    }
    if (!PERMISSIONS[role][resource]) {
        return false;
    }
    return PERMISSIONS[role][resource].includes(action);
}

/**
 * Middleware to check if user has permission for a resource action
 * @param {string} resource - Resource name
 * @param {string} action - Action (create, read, update, delete)
 */
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

/**
 * Check if user can view a resource (read permission)
 */
function canRead(role, resource) {
    return hasPermission(role, resource, 'read');
}

/**
 * Check if user can create on a resource
 */
function canCreate(role, resource) {
    return hasPermission(role, resource, 'create');
}

/**
 * Check if user can update a resource
 */
function canUpdate(role, resource) {
    return hasPermission(role, resource, 'update');
}

/**
 * Check if user can delete a resource
 */
function canDelete(role, resource) {
    return hasPermission(role, resource, 'delete');
}

module.exports = {
    PERMISSIONS,
    hasPermission,
    requirePermission,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
};
