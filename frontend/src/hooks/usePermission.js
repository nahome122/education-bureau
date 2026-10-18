/**
 * usePermission.js — Fine-grained permission hook.
 *
 * Usage:
 *   const canDelete = usePermission('teachers', 'delete');
 *   const matrix    = usePermissions(); // full matrix object
 */
import { useAuth } from '../context/AuthContext';

export const usePermission = (module, action = 'view') => {
  const { usePermissionCheck } = useAuth();
  return usePermissionCheck(module, action);
};

export const usePermissions = () => {
  const { user } = useAuth();
  return user?.permission_matrix || {};
};

export default usePermission;
