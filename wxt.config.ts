import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    commands: {
      'translate-draft': {
        suggested_key: {
          default: 'Ctrl+Shift+Y',
        },
        description: 'Translate the current Telegram draft',
      },
    },
  },
});
