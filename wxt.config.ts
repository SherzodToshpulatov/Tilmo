import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Browser Translator',
    description: 'Translate your Telegram Web and Instagram Direct drafts before you send them.',
    permissions: ['storage'],
    // Requested at runtime for the one backend origin saved in the popup.
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
  },
});
