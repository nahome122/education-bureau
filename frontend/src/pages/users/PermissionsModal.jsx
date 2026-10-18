import React, { useState, useEffect } from 'react';
import { MdClose, MdShield, MdRefresh, MdSave, MdCheck } from 'react-icons/md';
import toast from 'react-hot-toast';
import { getUserPermissions, saveUserPermissions } from '../../utils/apiCall';
import { DEFAULT_PERMISSION_MATRIX } from '../../utils/mockData';
import './PermissionsModal.css';

const MODULES = [
  { key: 'dashboard',            label: 'Dashboard'            },
  { key: 'users',                label: 'User Management'      },
  { key: 'schools',              label: 'Schools'              },
  { key: 'teachers',             label: 'Teachers'             },
  { key: 'staff',                label: 'Staff'                },
  { key: 'attendance',           label: 'Attendance'           },
  { key: 'departments',          label: 'Departments'          },
  { key: 'transfer',             label: 'Transfer'             },
  { key: 'reports',              label: 'Reports'              },
  { key: 'settings',             label: 'System Settings'      },
  { key: 'profile',              label: 'Profile'              },
];

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

const PermissionsModal = ({ user, onClose }) => {
  const [matrix,  setMatrix]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await getUserPermissions(user.id);
        if (data.success) {
          setMatrix(data.data || DEFAULT_PERMISSION_MATRIX[user.role_name] || {});
        }
      } catch {
        // Fall back to role defaults
        setMatrix(DEFAULT_PERMISSION_MATRIX[user.role_name] || {});
      }
      setLoading(false);
    };
    fetch();
  }, [user.id, user.role_name]);

  const toggle = (mod, action) => {
    setMatrix(m => ({
      ...m,
      [mod]: { ...(m[mod] || {}), [action]: !m[mod]?.[action] }
    }));
  };

  const resetToDefaults = () => {
    const defaults = DEFAULT_PERMISSION_MATRIX[user.role_name] || {};
    setMatrix(JSON.parse(JSON.stringify(defaults)));
    toast.success('Reset to role defaults. Click Save to apply.');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserPermissions(user.id, matrix);
      toast.success('Permissions saved successfully.');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions.');
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl animate-scale-in perm-modal">
        <div className="modal-header">
          <div>
            <div className="perm-modal-title-row">
              <MdShield className="perm-modal-shield" />
              <h3 className="modal-title">Permission Matrix</h3>
            </div>
            <p className="text-muted text-xs" style={{ marginTop: 3 }}>
              Customising permissions for <strong>{user.full_name}</strong>
              &nbsp;—&nbsp;<span className={`badge ${roleBadge(user.role_name)}`}>{user.role_label || user.role_name}</span>
            </p>
          </div>
          <button className="btn btn-icon" onClick={onClose}><MdClose /></button>
        </div>

        <div className="modal-body perm-modal-body">
          {loading ? (
            <div className="perm-skeleton">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton skeleton-text" style={{ height: 40 }} />)}
            </div>
          ) : (
            <div className="perm-table-wrap">
              <table className="perm-matrix-table">
                <thead>
                  <tr>
                    <th className="perm-module-col">Module</th>
                    {ACTIONS.map(a => (
                      <th key={a} className="perm-action-col">{a.charAt(0).toUpperCase() + a.slice(1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod.key} className="perm-row">
                      <td className="perm-module-name">{mod.label}</td>
                      {ACTIONS.map(action => {
                        const checked = !!(matrix?.[mod.key]?.[action]);
                        return (
                          <td key={action} className="perm-action-cell">
                            <label className="perm-checkbox-label">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(mod.key, action)}
                                className="perm-checkbox-input"
                              />
                              <span className={`perm-checkbox ${checked ? 'perm-checkbox--checked' : ''}`}>
                                {checked && <MdCheck />}
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={resetToDefaults} disabled={loading}>
            <MdRefresh /> Reset to Role Defaults
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? <span className="spinner-sm" /> : <MdSave />}
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};

const roleBadge = (name) => ({
  Administrator:     'badge-danger',
  SchoolManager:     'badge-primary',
  AttendanceOfficer: 'badge-warning',

  Teacher:           'badge-success',
  Staff:             'badge-info',
}[name] || 'badge-gray');

export default PermissionsModal;
