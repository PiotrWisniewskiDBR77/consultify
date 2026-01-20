const isAdminRole = (role) => {
  if (!role) return false;
  const normalized = String(role).toLowerCase();
  return ['admin', 'administrator', 'superadmin', 'owner'].includes(normalized);
};

export const verifyAdmin = (req, res, next) => {
  const role = req.user?.role || req.userRole;
  if (!isAdminRole(role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

export default verifyAdmin;
