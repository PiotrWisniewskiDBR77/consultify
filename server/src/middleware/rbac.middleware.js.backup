const normalizeRole = (role) => String(role || '').toLowerCase();

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles || roles.length === 0) return next();
  const userRole = normalizeRole(req.user?.role || req.userRole);
  const allowed = roles.map(normalizeRole).includes(userRole);
  if (!allowed) {
    return res.status(403).json({ error: 'Insufficient role' });
  }
  return next();
};

export const requireOrgAccess = () => (req, res, next) => {
  const orgId = req.user?.organizationId || req.organizationId;
  if (!orgId) {
    return res.status(403).json({ error: 'Organization access required' });
  }
  return next();
};

export const requireOrgRole = (...roles) => requireRole(...roles);

export default requireRole;
