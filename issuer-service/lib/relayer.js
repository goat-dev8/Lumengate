const { ChannelsClient } = require('@openzeppelin/relayer-plugin-channels');
const { normalizeSignedSorobanXdr } = require('./relayerXdrNormalize');

let clientCache = null;

function isRelayerEnabled(env = process.env) {
  const raw = String(env.RELAYER_ENABLED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function resolveChannelsBaseUrl(env = process.env) {
  return (
    String(env.CHANNELS_BASE_URL || '').trim() ||
    'https://channels.openzeppelin.com/testnet'
  );
}

function getChannelsClient(env = process.env) {
  if (!isRelayerEnabled(env)) {
    throw new Error('Relayer is disabled (RELAYER_ENABLED=false)');
  }
  const apiKey = String(env.CHANNELS_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('CHANNELS_API_KEY is not configured');
  }
  const baseUrl = resolveChannelsBaseUrl(env);
  const cacheKey = `${baseUrl}:${apiKey.slice(0, 8)}`;
  if (clientCache?.key === cacheKey) {
    return clientCache.client;
  }
  const client = new ChannelsClient({ baseUrl, apiKey });
  clientCache = { key: cacheKey, client };
  return client;
}

function relayerStatus(env = process.env) {
  return {
    enabled: isRelayerEnabled(env),
    configured: Boolean(String(env.CHANNELS_API_KEY || '').trim()),
    baseUrl: resolveChannelsBaseUrl(env),
  };
}

/**
 * Accept smart-account-kit RelayerClient payloads: { xdr } or { func, auth }.
 * Returns { success, hash?, transactionId?, status?, error?, errorCode? }.
 */
async function submitViaChannels(body, env = process.env) {
  const client = getChannelsClient(env);
  const xdr = typeof body?.xdr === 'string' ? body.xdr.trim() : '';
  const func = typeof body?.func === 'string' ? body.func.trim() : '';
  const auth = Array.isArray(body?.auth) ? body.auth.filter((a) => typeof a === 'string' && a.trim()) : [];

  if (xdr) {
    const normalizedXdr = await normalizeSignedSorobanXdr(xdr, env);
    const result = await client.submitTransaction({ xdr: normalizedXdr });
    return {
      success: true,
      transactionId: result.transactionId,
      hash: result.hash,
      status: result.status,
    };
  }

  if (func) {
    const result = await client.submitSorobanTransaction({ func, auth });
    return {
      success: true,
      transactionId: result.transactionId,
      hash: result.hash,
      status: result.status,
    };
  }

  throw new Error('Provide either xdr or func (+ optional auth)');
}

module.exports = {
  isRelayerEnabled,
  relayerStatus,
  submitViaChannels,
};
