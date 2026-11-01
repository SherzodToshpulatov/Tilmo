import {
  findFocusedInstagramComposer,
  findInstagramComposer,
  findInstagramComposerPositioningAnchor,
  instagramEditorAdapter,
} from '../src/adapters/instagram';
import { startFloatingTranslator } from '../src/content/floating-translator';

export default defineContentScript({
  // Instagram navigates client-side, so the script runs on every page and the
  // adapter only activates on /direct/ routes.
  matches: ['https://www.instagram.com/*'],
  main(ctx) {
    startFloatingTranslator(ctx, {
      name: 'Instagram',
      adapter: instagramEditorAdapter,
      findComposer: findInstagramComposer,
      findFocusedComposer: findFocusedInstagramComposer,
      findPositioningAnchor: findInstagramComposerPositioningAnchor,
    });
  },
});
