const test = require('node:test');
const assert = require('node:assert/strict');
const { allowRelayerRequest } = require('../lib/relayerRateLimit');

function mockReq(ip) {
  return {
    headers: {},
    socket: { remoteAddress: ip },
  };
}

test('relayer rate limit allows first request', () => {
  assert.equal(allowRelayerRequest(mockReq('10.0.0.1')), true);
});

test('relayer rate limit blocks after 30 requests in window', () => {
  const req = mockReq('10.0.0.99');
  for (let i = 0; i < 30; i += 1) {
    assert.equal(allowRelayerRequest(req), true);
  }
  assert.equal(allowRelayerRequest(req), false);
});
