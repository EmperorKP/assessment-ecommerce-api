const jwt = require('jsonwebtoken');
require('@dotenvx/dotenvx').config();
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function authenticate(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
