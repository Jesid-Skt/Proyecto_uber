import { isIP } from 'node:net';

const expoDevelopmentPorts = new Set(['8081', '19006']);

export function isAllowedFrontendOrigin(
  origin: string,
  configuredOrigins: readonly string[],
  development: boolean,
): boolean {
  if (configuredOrigins.includes(origin)) {
    return true;
  }
  if (!development) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (!['http:', 'exp:'].includes(url.protocol) || !expoDevelopmentPorts.has(url.port) || isIP(url.hostname) !== 4) {
    return false;
  }

  const [first, second] = url.hostname.split('.').map(Number);
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}
