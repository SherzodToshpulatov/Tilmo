import type { ApiConfig } from '../config';
import { ApiError, jsonResponse } from '../errors';
import { authenticate, enforceRateLimit, type RateLimiter } from '../middleware/security';
import { readJsonBody, validateTranslationRequest } from '../middleware/validation';
import { ProviderError, type TranslationProvider } from '../providers/types';
import type { UsageReservation } from '../usage/usage-ledger';

export interface UsageCounter {
  reserve(characters: number, limit: number): Promise<UsageReservation>;
  release(characters: number, period: string): Promise<void>;
}

export interface TranslateDependencies {
  config: ApiConfig;
  tokenHashes: readonly string[];
  rateLimiter: RateLimiter;
  usage: UsageCounter;
  provider: TranslationProvider;
}

function toApiError(error: ProviderError): ApiError {
  switch (error.kind) {
    case 'timeout':
      return new ApiError(504, 'provider_timeout', 'The translation provider did not respond in time.');
    case 'rate_limited':
      return new ApiError(503, 'provider_rate_limited', 'The translation provider is busy. Try again shortly.', {
        'retry-after': '30',
      });
    default:
      return new ApiError(502, 'provider_error', 'The translation provider could not complete the request.');
  }
}

export async function handleTranslate(request: Request, deps: TranslateDependencies): Promise<Response> {
  // Cheap checks first: unauthenticated or throttled callers never reach the body or Google.
  const client = await authenticate(request, deps.tokenHashes);
  await enforceRateLimit(deps.rateLimiter, client);

  const body = await readJsonBody(request, deps.config.maxBodyBytes);
  const translationRequest = validateTranslationRequest(body, deps.config);

  const characters = translationRequest.text.length;
  const reservation = await deps.usage.reserve(characters, deps.config.monthlyCharacterLimit);
  if (!reservation.allowed) {
    throw new ApiError(429, 'quota_exceeded', 'The monthly translation quota has been reached.');
  }

  try {
    return jsonResponse(await deps.provider.translate(translationRequest));
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    // A timed-out request may still have been billed, so keep it counted.
    if (error.kind !== 'timeout') await deps.usage.release(characters, reservation.period);
    // Status and kind only: never the text, provider body, or credentials.
    console.warn('translation_provider_error', { kind: error.kind, status: error.status });
    throw toApiError(error);
  }
}
