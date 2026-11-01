import { readConfig } from '../src/config';
import { sha256Hex } from '../src/middleware/security';
import type { TranslationProvider } from '../src/providers/types';
import type { TranslateDependencies, UsageCounter } from '../src/routes/translate';
import { releaseCharacters, reserveCharacters, type UsageStorage } from '../src/usage/usage-ledger';

export const TEST_TOKEN = 'btk_test-token-for-unit-tests-only';

export function memoryStorage(): UsageStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      values.set(key, value);
    },
  };
}

export function memoryUsage(storage = memoryStorage()): UsageCounter & { storage: ReturnType<typeof memoryStorage> } {
  return {
    storage,
    reserve: (characters, limit) => reserveCharacters(storage, characters, limit, new Date()),
    release: (characters, period) => releaseCharacters(storage, characters, period),
  };
}

export async function testDependencies(overrides: Partial<TranslateDependencies> = {}): Promise<TranslateDependencies> {
  return {
    config: readConfig({}),
    tokenHashes: [await sha256Hex(TEST_TOKEN)],
    rateLimiter: { limit: async () => ({ success: true }) },
    usage: memoryUsage(),
    provider: echoProvider(),
    ...overrides,
  };
}

export function echoProvider(): TranslationProvider {
  return {
    name: 'test',
    translate: async ({ text, target }) => ({ translatedText: `[${target}] ${text}`, detectedSourceLanguage: 'uz', provider: 'test' }),
  };
}

export function translateRequest(
  body: unknown,
  { token = TEST_TOKEN, contentType = 'application/json' }: { token?: string | null; contentType?: string } = {},
): Request {
  const headers: Record<string, string> = { 'content-type': contentType };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request('https://api.example.test/v1/translate', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
