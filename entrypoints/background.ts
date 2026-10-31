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
});
