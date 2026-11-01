// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  findFocusedInstagramComposer,
  findInstagramComposer,
  findInstagramComposerPositioningAnchor,
  instagramEditorAdapter,
} from '../adapters/instagram';
import type { TranslationRequest } from '../services/translation';
import { TRANSLATE_DRAFT_MESSAGE, isTranslateTextMessage, type TranslateTextResponse } from '../utils/messaging';
import { FLOATING_HOST_ID, startFloatingTranslator } from './floating-translator';

const instagram = {
  name: 'Instagram',
  adapter: instagramEditorAdapter,
  findComposer: findInstagramComposer,
  findFocusedComposer: findFocusedInstagramComposer,
  findPositioningAnchor: findInstagramComposerPositioningAnchor,
};

let contexts: ContentScriptContext[] = [];
let requests: TranslationRequest[] = [];
let respond: (request: TranslationRequest) => Promise<TranslateTextResponse>;

function start() {
  const ctx = new ContentScriptContext('instagram');
  contexts.push(ctx);
  startFloatingTranslator(ctx, instagram);
  return ctx;
}

function mountComposer(value = 'Salom, yaxshimisan?') {
  document.body.innerHTML = `
    <div class="composer-bar">
      <div role="button" aria-label="Choose an emoji">🙂</div>
      <textarea placeholder="Message..."></textarea>
      <div role="button">Send</div>
    </div>
    <input id="elsewhere" aria-label="Search">`;
  const textarea = document.querySelector('textarea')!;
  textarea.value = value;
  return textarea;
}

const hosts = () => document.querySelectorAll<HTMLElement>(`#${FLOATING_HOST_ID}`);
const shadow = () => hosts()[0]!.shadowRoot!;
const button = (selector: string) => shadow().querySelector<HTMLButtonElement>(selector);
const buttonByText = (label: string) =>
  Array.from(shadow().querySelectorAll('button')).find((element) => element.textContent?.includes(label)) ?? null;

function focus(element: HTMLElement) {
  element.focus();
  element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

beforeEach(() => {
  fakeBrowser.reset();
  history.pushState({}, '', '/direct/t/1234567890/');
  requests = [];
  respond = async (request) => ({
    ok: true,
    result: { translatedText: 'Hello, how are you?', detectedSourceLanguage: request.source === 'auto' ? 'uz' : request.source, provider: 'mymemory' },
  });
  // Stands in for the background service worker, with the same sendResponse protocol.
  fakeBrowser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isTranslateTextMessage(message)) return undefined;
    requests.push(message.request);
    void respond(message.request).then(sendResponse);
    return true;
  });
});

afterEach(() => {
  contexts.forEach((ctx) => ctx.abort());
  contexts = [];
  document.body.innerHTML = '';
  history.pushState({}, '', '/');
});

describe('floating translator lifecycle', () => {
  it('creates one Shadow DOM host that stays hidden until a composer is focused', async () => {
    const textarea = mountComposer();
    start();

    expect(hosts()).toHaveLength(1);
    expect(hosts()[0]!.shadowRoot).not.toBeNull();
    expect(hosts()[0]!.style.getPropertyValue('display')).toBe('none');

    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());
    expect(hosts()[0]!.style.getPropertyValue('display')).toBe('block');
    expect(hosts()[0]!.style.getPropertyValue('position')).toBe('fixed');
  });

  it('keeps a single set of controls when a second instance starts', () => {
    mountComposer();
    start();
    start();
    expect(hosts()).toHaveLength(1);
  });

  it('hides the controls when focus moves to an unrelated field', async () => {
    const textarea = mountComposer();
    start();
    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());

    focus(document.querySelector<HTMLElement>('#elsewhere')!);
    await vi.waitFor(() => expect(button('.translate')).toBeNull());
    expect(hosts()[0]!.style.getPropertyValue('display')).toBe('none');
  });

  it('does not activate outside Instagram Direct', async () => {
    history.pushState({}, '', '/explore/');
    const textarea = mountComposer();
    start();
    focus(textarea);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(button('.translate')).toBeNull();
  });

  it('translates, replaces and undoes the draft only on explicit clicks', async () => {
    const textarea = mountComposer('Salom, yaxshimisan?');
    start();
    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());
    expect(requests).toHaveLength(0);

    button('.translate')!.click();
    await vi.waitFor(() => expect(shadow().querySelector('.result')?.textContent).toBe('Hello, how are you?'));
    expect(requests).toEqual([{ text: 'Salom, yaxshimisan?', source: 'auto', target: 'en' }]);
    expect(textarea.value).toBe('Salom, yaxshimisan?');

    buttonByText('Replace')!.click();
    await vi.waitFor(() => expect(buttonByText('Undo')).not.toBeNull());
    expect(textarea.value).toBe('Hello, how are you?');

    buttonByText('Undo')!.click();
    await vi.waitFor(() => expect(textarea.value).toBe('Salom, yaxshimisan?'));
  });

  it('runs on the keyboard shortcut message', async () => {
    const textarea = mountComposer('nima gap');
    start();
    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());

    await fakeBrowser.runtime.onMessage.trigger({ type: TRANSLATE_DRAFT_MESSAGE }, {}, () => {});
    await vi.waitFor(() => expect(shadow().querySelector('.result')).not.toBeNull());
    expect(requests.map((request) => request.text)).toEqual(['nima gap']);
  });

  it('does not offer Replace when the draft changes while the translation is pending', async () => {
    const textarea = mountComposer('Salom');
    let finish!: () => void;
    respond = (request) => new Promise((resolve) => {
      finish = () => resolve({ ok: true, result: { translatedText: 'Hello', detectedSourceLanguage: request.source, provider: 'mymemory' } });
    });
    start();
    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());

    button('.translate')!.click();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    textarea.value = 'Salom, qalaysan?';
    finish();

    await vi.waitFor(() => expect(shadow().querySelector('.error')?.textContent).toMatch(/draft changed/i));
    expect(buttonByText('Replace')).toBeNull();
    expect(textarea.value).toBe('Salom, qalaysan?');
  });

  it('drops a pending translation and hides the controls on conversation navigation', async () => {
    const textarea = mountComposer('Salom');
    let finish!: () => void;
    respond = (request) => new Promise((resolve) => {
      finish = () => resolve({ ok: true, result: { translatedText: 'Hello', detectedSourceLanguage: request.source, provider: 'mymemory' } });
    });
    start();
    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());
    button('.translate')!.click();
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    // Another conversation; the old composer is gone.
    history.pushState({}, '', '/direct/t/9876543210/');
    textarea.remove();
    window.dispatchEvent(new Event('wxt:locationchange'));
    finish();

    await vi.waitFor(() => expect(button('.translate')).toBeNull());
    expect(shadow().querySelector('.result')).toBeNull();
  });

  it('removes its controls and listeners when the content script is invalidated', async () => {
    const textarea = mountComposer();
    const ctx = start();
    focus(textarea);
    await vi.waitFor(() => expect(button('.translate')).not.toBeNull());

    ctx.abort();
    expect(hosts()).toHaveLength(0);

    await fakeBrowser.runtime.onMessage.trigger({ type: TRANSLATE_DRAFT_MESSAGE }, {}, () => {});
    expect(requests).toHaveLength(0);
  });
});
