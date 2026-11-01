import {
  telegramEditorAdapter,
  findFocusedTelegramComposer,
  findTelegramComposer,
  findTelegramComposerPositioningAnchor,
} from '../src/adapters/telegram';
import { startFloatingTranslator } from '../src/content/floating-translator';

export default defineContentScript({
  matches: ['https://web.telegram.org/*'],
  main(ctx) {
    startFloatingTranslator(ctx, {
      name: 'Telegram',
      adapter: telegramEditorAdapter,
      findComposer: findTelegramComposer,
      findFocusedComposer: findFocusedTelegramComposer,
      findPositioningAnchor: findTelegramComposerPositioningAnchor,
    });
  },
});
