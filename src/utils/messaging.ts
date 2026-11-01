import {
  TRANSLATION_ERROR_MESSAGES,
  TranslationError,
  type TranslationErrorCode,
  type TranslationRequest,
  type TranslationResult,
} from '../services/translation';

export const TRANSLATE_TEXT_MESSAGE = 'translate-text';

/** Content script → background: translate text the user explicitly asked for. */
export interface TranslateTextMessage {
  type: typeof TRANSLATE_TEXT_MESSAGE;
  request: TranslationRequest;
}

export type TranslateTextResponse =
  | { ok: true; result: TranslationResult }
  // `message` is extension-authored text (never draft or API content).
  | { ok: false; error: { code: TranslationErrorCode; message?: string } };

export function isTranslateTextMessage(message: unknown): message is TranslateTextMessage {
  if (typeof message !== 'object' || message === null) return false;
  const { type, request } = message as Partial<TranslateTextMessage>;
  return type === TRANSLATE_TEXT_MESSAGE && typeof request?.text === 'string' &&
    typeof request.source === 'string' && typeof request.target === 'string';
}

/** Asks the background service worker to translate; it holds the credentials. */
export async function requestTranslation(request: TranslationRequest): Promise<TranslationResult> {
  let response: TranslateTextResponse | undefined;
  try {
    response = await browser.runtime.sendMessage<TranslateTextMessage, TranslateTextResponse>({
      type: TRANSLATE_TEXT_MESSAGE,
      request,
    });
  } catch {
    // The extension was reloaded or updated and this content script is orphaned.
    throw new TranslationError('extension_unavailable');
  }

  if (response?.ok === true) return response.result;
  const error = response?.ok === false ? response.error : undefined;
  if (!error || !(error.code in TRANSLATION_ERROR_MESSAGES)) throw new TranslationError('invalid_response');
  throw new TranslationError(error.code, typeof error.message === 'string' && error.message ? error.message : undefined);
}
