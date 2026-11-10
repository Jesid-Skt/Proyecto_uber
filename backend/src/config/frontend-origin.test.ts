import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedFrontendOrigin } from './frontend-origin.js';

const configuredOrigins = ['http://localhost:8081', 'http://localhost:19006'];

test('allows an Expo web client on a private LAN address in development', () => {
  assert.equal(
    isAllowedFrontendOrigin('http://192.168.1.121:8081', configuredOrigins, true),
    true,
  );
  assert.equal(
    isAllowedFrontendOrigin('exp://192.168.1.121:8081', configuredOrigins, true),
    true,
  );
  assert.equal(
    isAllowedFrontendOrigin('http://10.0.2.2:19006', configuredOrigins, true),
    true,
  );
});

test('rejects unconfigured origins outside Expo development LAN ports', () => {
  for (const origin of [
    'http://192.168.1.121:4000',
    'https://192.168.1.121:8081',
    'exp://192.168.1.121:4000',
    'http://8.8.8.8:8081',
    'not-an-origin',
  ]) {
    assert.equal(isAllowedFrontendOrigin(origin, configuredOrigins, true), false, origin);
  }
});

test('only allows explicitly configured origins in production', () => {
  assert.equal(
    isAllowedFrontendOrigin('http://localhost:8081', configuredOrigins, false),
    true,
  );
  assert.equal(
    isAllowedFrontendOrigin('http://192.168.1.121:8081', configuredOrigins, false),
    false,
  );
});
