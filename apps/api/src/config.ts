import { ApiError } from './errors';

export interface ApiConfig {
  supportedLanguages: ReadonlySet<string>;
  maxTextChars: number;
  maxBodyBytes: number;
  monthlyCharacterLimit: number;
  providerTimeoutMs: number;
}

export interface ConfigEnv {
  SUPPORTED_LANGUAGES?: string;
  MAX_TEXT_CHARS?: string;
  MAX_BODY_BYTES?: string;
  MONTHLY_CHARACTER_LIMIT?: string;
  PROVIDER_TIMEOUT_MS?: string;
}

const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

function misconfigured(): ApiError {
  return new ApiError(500, 'server_misconfigured', 'The translation service is not configured correctly.');
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw misconfigured();
  return parsed;
}

export function parseLanguageList(value: string | undefined): ReadonlySet<string> {
  const codes = (value ?? 'uz,en,ru').split(',').map((code) => code.trim().toLowerCase()).filter(Boolean);
  if (!codes.length || !codes.every((code) => LANGUAGE_CODE.test(code))) throw misconfigured();
  return new Set(codes);
}

// Invalid values fail closed instead of silently falling back to defaults,
// so a typo cannot lift a cost limit.
export function readConfig(env: ConfigEnv): ApiConfig {
  return {
    supportedLanguages: parseLanguageList(env.SUPPORTED_LANGUAGES),
    maxTextChars: readPositiveInteger(env.MAX_TEXT_CHARS, 2000),
    maxBodyBytes: readPositiveInteger(env.MAX_BODY_BYTES, 16384),
    monthlyCharacterLimit: readPositiveInteger(env.MONTHLY_CHARACTER_LIMIT, 400000),
    providerTimeoutMs: readPositiveInteger(env.PROVIDER_TIMEOUT_MS, 8000),
  };
}
