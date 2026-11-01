import { readConfig } from './config';
import { ApiError } from './errors';
import { parseTokenHashes } from './middleware/security';
import { GoogleCloudTranslationProvider } from './providers/google';
import type { TranslateDependencies } from './routes/translate';

export function createDependencies(env: Env): TranslateDependencies {
  const config = readConfig(env);
  const tokenHashes = parseTokenHashes(env.API_ACCESS_TOKEN_HASHES);
  if (!env.GOOGLE_TRANSLATE_API_KEY) {
    throw new ApiError(500, 'server_misconfigured', 'The translation service is not configured correctly.');
  }

  const usageLimiter = env.USAGE_LIMITER.get(env.USAGE_LIMITER.idFromName('global'));
  return {
    config,
    tokenHashes,
    rateLimiter: env.TRANSLATE_RATE_LIMITER,
    usage: {
      reserve: (characters, limit) => usageLimiter.reserve(characters, limit),
      release: (characters, period) => usageLimiter.release(characters, period),
    },
    provider: new GoogleCloudTranslationProvider(env.GOOGLE_TRANSLATE_API_KEY, config.providerTimeoutMs),
  };
}
