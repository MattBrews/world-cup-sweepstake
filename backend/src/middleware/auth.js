export function requireAdmin(req, res, next) {
  if (req.session?.admin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function requireMasterAdmin(req, res, next) {
  if (req.session?.admin === 'master') {
    return next();
  }
  res.status(403).json({ error: 'Master admin access required' });
}
