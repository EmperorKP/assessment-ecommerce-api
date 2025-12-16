const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');

// Sanitize strings to prevent XSS attacks
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return xss(str.trim());
};

// Recursively sanitize objects
const sanitizeObject = obj => {
  if (!obj || typeof obj !== 'object') return obj;
  
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  });
  
  return obj;
};

// Validate that input doesn't contain malicious patterns
const isSafeInput = (value) => {
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /DROP\s+TABLE/gi,
    /DELETE\s+FROM/gi,
    /INSERT\s+INTO/gi,
    /UPDATE\s+\w+\s+SET/gi,
    /<iframe/gi,
    /eval\(/gi,
    /expression\(/gi
  ];
  
  const strValue = String(value);
  return !dangerousPatterns.some(pattern => pattern.test(strValue));
};

// Custom validator for product IDs
const isValidProductId = (value) => {
  return /^[a-zA-Z0-9-_]+$/.test(value) && value.length <= 50;
};

// Custom validator for safe strings
const isSafeString = (value) => {
  return typeof value === 'string' && isSafeInput(value);
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid input',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }

  // Sanitize all inputs
  sanitizeObject(req.body);
  sanitizeObject(req.params);
  sanitizeObject(req.query);

  next();
};

module.exports = {
  body,
  param,
  query,
  handleValidation,
  sanitizeString,
  sanitizeObject,
  isSafeInput,
  isValidProductId,
  isSafeString
};
