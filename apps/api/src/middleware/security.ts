import { ApiError } from '../errors';

const TOKEN_HASH = /^[0-9a-f]{64}$/;
const MAX_TOKEN_LENGTH = 256;

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface AuthenticatedClient {
  /** Stable, non-secret identifier derived from the token hash. */
  clientId: string;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseTokenHashes(value: string | undefined): string[] {
  const hashes = (value ?? '').split(',').map((hash) => hash.trim().toLowerCase()).filter(Boolean);
  // Fail closed: without valid hashes nobody can authenticate.
  if (!hashes.length || !hashes.every((hash) => TOKEN_HASH.test(hash))) {
    throw new ApiError(500, 'server_misconfigured', 'The translation service is not configured correctly.');
  }
  return hashes;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function unauthorized(): ApiError {
  return new ApiError(401, 'unauthorized', 'A valid access token is required.', {
    'www-authenticate': 'Bearer',
  });
}

export async function authenticate(request: Request, tokenHashes: readonly string[]): Promise<AuthenticatedClient> {
  const match = /^Bearer ([\x21-\x7e]+)$/.exec(request.headers.get('authorization') ?? '');
  const token = match?.[1];
  if (!token || token.length > MAX_TOKEN_LENGTH) throw unauthorized();

  const hash = await sha256Hex(token);
  // Compare against every hash so timing does not reveal which one matched.
  let matched = false;
  for (const expected of tokenHashes) {
    matched = constantTimeEqual(hash, expected) || matched;
  }
  if (!matched) throw unauthorized();

  return { clientId: hash.slice(0, 16) };
}

export async function enforceRateLimit(limiter: RateLimiter, client: AuthenticatedClient): Promise<void> {
  const { success } = await limiter.limit({ key: client.clientId });
  if (!success) {
    throw new ApiError(429, 'rate_limited', 'Too many translation requests. Try again in a minute.', {
      'retry-after': '60',
    });
  }
}
