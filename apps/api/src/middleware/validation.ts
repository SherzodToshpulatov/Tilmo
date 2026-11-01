import type { ApiConfig } from '../config';
import { ApiError } from '../errors';
import type { TranslationRequest } from '../types';

function payloadTooLarge(): ApiError {
  return new ApiError(413, 'payload_too_large', 'The request body is too large.');
}

/** Reads a JSON body without buffering more than `maxBytes`. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(contentType)) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the request as application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw payloadTooLarge();
  if (!request.body) throw new ApiError(400, 'invalid_json', 'The request body must be valid JSON.');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw payloadTooLarge();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
}

function invalid(message: string): ApiError {
  return new ApiError(400, 'invalid_request', message);
}

function readLanguage(value: unknown, field: string, config: ApiConfig, allowAuto: boolean): string {
  if (typeof value !== 'string') throw invalid(`"${field}" must be a language code.`);
  const code = value.trim().toLowerCase();
  if (allowAuto && code === 'auto') return code;
  if (!config.supportedLanguages.has(code)) {
    throw new ApiError(400, 'unsupported_language', `"${field}" must be one of: ${[...config.supportedLanguages].join(', ')}.`);
  }
  return code;
}

export function validateTranslationRequest(body: unknown, config: ApiConfig): TranslationRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('The request body must be a JSON object.');
  }

  const { text, source = 'auto', target } = body as Record<string, unknown>;
  if (typeof text !== 'string') throw invalid('"text" must be a string.');
  if (!text.trim()) throw new ApiError(400, 'empty_text', '"text" must not be empty.');
  // Billing is per character; UTF-16 length is a conservative upper bound.
  if (text.length > config.maxTextChars) {
    throw new ApiError(413, 'text_too_long', `"text" must be at most ${config.maxTextChars} characters.`);
  }
  if (!text.isWellFormed()) throw invalid('"text" contains invalid Unicode.');

  const sourceLanguage = readLanguage(source, 'source', config, true);
  const targetLanguage = readLanguage(target, 'target', config, false);
  if (sourceLanguage === targetLanguage) throw invalid('"source" and "target" must differ.');

  return { text, source: sourceLanguage, target: targetLanguage };
}
