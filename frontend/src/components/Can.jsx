/**
 * Can.jsx — Permission-aware wrapper component.
 *
 * Usage:
 *   <Can module="teachers" action="delete">
 *     <button>Delete</button>
 *   </Can>
 *
 *   <Can module="teachers" action="create" fallback={<span className="text-muted">No access</span>}>
 *     <button>Add Teacher</button>
 *   </Can>
 */
import React from 'react';
import { usePermission } from '../hooks/usePermission';

const Can = ({ module, action = 'view', children, fallback = null }) => {
  const allowed = usePermission(module, action);
  return allowed ? children : fallback;
};

export default Can;
