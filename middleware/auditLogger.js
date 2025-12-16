const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs/audit.log');


fs.mkdirSync(path.dirname(logFile), { recursive: true });

function auditLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const log = {
      time: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id || 'anonymous',
      ip: req.ip
    };

    fs.appendFile(
      logFile,
      JSON.stringify(log) + '\n',
      () => {} // never block request
    );
  });

  next();
}

module.exports = auditLogger;
