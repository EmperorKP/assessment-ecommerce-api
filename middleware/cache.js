const NodeCache = require('node-cache');

// TTL = 60 seconds, check every 120 seconds
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const cacheResponse = (req, res, next) => {
  const key = req.originalUrl;

  const cachedData = cache.get(key);
  if (cachedData) {
    return res.json(cachedData);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    cache.set(key, body);
    originalJson(body);
  };

  next();
};

cacheResponse.cache = cache;
module.exports = cacheResponse;
