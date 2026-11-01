export type ApiErrorCode =
  | 'invalid_json'
  | 'invalid_request'
  | 'empty_text'
  | 'text_too_long'
  | 'unsupported_language'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'unauthorized'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'not_found'
  | 'method_not_allowed'
  | 'provider_error'
  | 'provider_rate_limited'
  | 'provider_timeout'
  | 'server_misconfigured'
  | 'internal_error';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

/** An error whose code and message are safe to return to the client. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function errorResponse(error: ApiError): Response {
  const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
  return jsonResponse(body, error.status, error.headers);
}
