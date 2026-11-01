import type { TranslationRequest, TranslationResult } from '../types';

export interface TranslationProvider {
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export type ProviderErrorKind =
  /** The provider did not answer within the timeout. It may still bill the request. */
  | 'timeout'
  /** The provider throttled us or a provider-side quota was exhausted. */
  | 'rate_limited'
  /** Network failure or provider-side server error. */
  | 'unavailable'
  /** The provider refused the request (bad key, disabled API, bad input). */
  | 'rejected'
  | 'invalid_response';

/** Provider failure. Never carries provider response bodies or credentials. */
export class ProviderError extends Error {
  constructor(readonly kind: ProviderErrorKind, readonly status?: number) {
    super(`Translation provider error: ${kind}`);
    this.name = 'ProviderError';
  }
}
