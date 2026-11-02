# Manual testing

Automated tests cannot sign in to Telegram or Instagram, so these checks need a
real browser session. Use test accounts and conversations without private
content. The DevTools snippets print page structure and text lengths only —
never message text.

## Manual checklist: Instagram Direct

1. `npm run build`, reload the extension at `chrome://extensions`, then reload
   the Instagram tab.
2. Open `https://www.instagram.com/direct/inbox/` and pick a conversation.
3. Click the message box and type `Salom, yaxshimisan?`. The controls appear
   above the message bar without covering Send, emoji, or attachment buttons.
4. Choose a source (Oʻzbekcha for MyMemory) and target, press **Translate**:
   a preview appears and the message is **not** sent.
5. Press **Replace**: the message box shows the translation. Type one letter to
   check Instagram still accepts input, delete it, then press **Undo**.
6. Repeat with a two-line draft (Shift+Enter) and with emoji.
7. Edit the draft after pressing Translate, then press Replace: it is refused.
8. Press Translate, then switch to another conversation before it finishes: no
   stale preview appears in the new conversation.
9. Click the Instagram search box, a post's comment field, and the
   share/forward dialog: no Translate controls appear.
10. Open the home feed or a profile without a chat panel: no controls appear.

If the controls do not appear or Replace is unavailable for plain text, run this
in DevTools on the conversation (it prints structure and text lengths only):

```js
(function () {
  var ed = document.activeElement;
  var out = [];
  (function walk(n, d) {
    var pad = new Array(d + 1).join('  ');
    if (n.nodeType === 3) { out.push(pad + '#text len=' + n.data.length); return; }
    if (n.nodeType !== 1) return;
    out.push(pad + '<' + n.tagName.toLowerCase() + '> attrs=[' + n.getAttributeNames().join(',') + ']');
    for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i], d + 1);
  })(ed, 0);
  console.log(out.join('\n'));
})();
```

## Manual checklist: floating DM panels

1. Open a Reel, then open a chat from the Messages button so a floating panel
   appears. Click its message box and type `nima gap`: the controls appear
   above that panel's message bar, not in a page corner.
2. Translate, Replace, and Undo as above. Nothing is sent until you press Send.
3. Repeat over a profile page and a post page.
4. With two panels open, click into one, then the other: the controls follow
   the focused message box and Translate uses that panel's draft.
5. Minimize and close a panel: the controls disappear. Reopen it: they return
   when you click its message box.
6. Press Translate with an empty message box: an error asks you to type a
   draft; no request is made.
7. Click the comment box of the Reel behind the panel and the search box: no
   controls appear.

If a floating panel's composer gets no controls, click its message box and run
this in DevTools. It prints only element names, roles, positioning and which
detection rules match — no message text, names or labels:

```js
(function () {
  var ed = document.activeElement, rows = [];
  var markers = '[role="grid"],[role="log"],[role="row"],[data-scope="messages_table"],[aria-label*="message" i],[aria-label*="conversation" i],[aria-label*="chat" i]';
  var pickers = 'input[type="checkbox"],[role="checkbox"],input[type="search"],input[aria-label*="search" i],input[placeholder*="search" i],[role="searchbox"]';
  rows.push('editor: <' + ed.tagName.toLowerCase() + '> role=' + ed.getAttribute('role') +
    ' lexical=' + ed.hasAttribute('data-lexical-editor') +
    ' messageLabel=' + /\bmessages?\b|сообщени|xabar/i.test([ed.getAttribute('aria-label'), ed.getAttribute('placeholder'), ed.getAttribute('aria-placeholder')].join(' ')));
  for (var n = ed.parentElement, d = 1; n && n !== document.body && d <= 15; n = n.parentElement, d++) {
    var fixed = getComputedStyle(n).position === 'fixed', dialog = n.matches('[role="dialog"],[aria-modal="true"]');
    if (!fixed && !dialog) continue;
    var threadCount = Array.from(n.querySelectorAll(markers)).filter(function (m) { return m !== ed && !m.contains(ed) && !ed.contains(m); }).length;
    rows.push('ancestor ' + d + ': <' + n.tagName.toLowerCase() + '> fixed=' + fixed + ' dialog=' + dialog +
      ' threadMarkers=' + threadCount + ' pickers=' + n.querySelectorAll(pickers).length +
      ' conversationLabel=' + /\b(conversation|chat|messages)\b/i.test(n.getAttribute('aria-label') || ''));
  }
  console.log(rows.join('\n'));
})();
```

Run `npm run cf-typegen` in `apps/api` after changing `wrangler.jsonc` bindings
or vars.
