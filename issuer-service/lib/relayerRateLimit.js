const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const buckets = new Map();

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function allowRelayerRequest(req) {
  const key = clientKey(req);
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.startedAt > WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

module.exports = { allowRelayerRequest };
