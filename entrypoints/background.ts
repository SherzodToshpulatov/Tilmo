import { isSupportedLanguage } from '../src/core/languages';
import { MyMemoryTranslationService } from '../src/services/mymemory-translation';
import { RemoteTranslationService } from '../src/services/remote-translation';
import {
  TranslationError,
  mockTranslationService,
  type TranslationRequest,
  type TranslationResult,
} from '../src/services/translation';
import { isTranslateTextMessage, type TranslateTextResponse } from '../src/utils/messaging';
import {
  apiAccessTokenSetting,
  apiBaseUrlSetting,
  apiOriginPattern,
  myMemoryEmailSetting,
  translationProviderSetting,
} from '../src/utils/settings';

async function translate(request: TranslationRequest): Promise<TranslationResult> {
  if (!request.text.trim() || !isSupportedLanguage(request.target) ||
    (request.source !== 'auto' && !isSupportedLanguage(request.source))) {
    throw new TranslationError('invalid_request');
  }

  const provider = await translationProviderSetting.getValue();
  // The demo translator is only used when explicitly selected in settings.
  if (provider === 'mock') return mockTranslationService.translate(request);

  if (provider === 'mymemory') {
    if (!navigator.onLine) throw new TranslationError('offline');
    // No key or host permission needed: MyMemory allows any origin.
    return new MyMemoryTranslationService({ email: await myMemoryEmailSetting.getValue() }).translate(request);
  }

  const [baseUrl, accessToken] = await Promise.all([apiBaseUrlSetting.getValue(), apiAccessTokenSetting.getValue()]);
  const originPattern = apiOriginPattern(baseUrl);
  if (!originPattern || !accessToken) throw new TranslationError('not_configured');
  if (!await browser.permissions.contains({ origins: [originPattern] })) throw new TranslationError('permission_missing');
  if (!navigator.onLine) throw new TranslationError('offline');

  return new RemoteTranslationService({ baseUrl, accessToken }).translate(request);
}

async function handleTranslateText(request: TranslationRequest): Promise<TranslateTextResponse> {
  try {
    return { ok: true, result: await translate(request) };
  } catch (error) {
    // Never log the request: it contains the user's private draft.
    return error instanceof TranslationError
      ? { ok: false, error: { code: error.code, message: error.message } }
      : { ok: false, error: { code: 'server_error' } };
  }
}

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    if (command !== 'translate-draft') return;

    void browser.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id || !activeTab.url?.startsWith('https://web.telegram.org/')) return;

      return browser.tabs.sendMessage(activeTab.id, { type: 'translate-draft' });
    }).catch(() => {
      console.warn('Could not deliver the Translate shortcut to the active Telegram tab.');
    });
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !isTranslateTextMessage(message)) return;

    void handleTranslateText(message.request).then(sendResponse);
    return true;
  });
});
