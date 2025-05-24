// middleware/adminMiddleware.js


const adminMiddleware = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. You are not an admin.' });
    }
    next();
  };
  
  module.exports = adminMiddleware;
  
