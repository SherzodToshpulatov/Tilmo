import { useEffect, useState, type FormEvent } from 'react';
import { TRANSLATION_PROVIDERS, type TranslationProviderId } from '@/src/services/providers';
import {
  apiAccessTokenSetting,
  apiBaseUrlSetting,
  apiOriginPattern,
  isValidContactEmail,
  myMemoryEmailSetting,
  translationProviderSetting,
  type TranslationProviderSetting,
} from '@/src/utils/settings';
import './App.css';

type Status = { kind: 'idle' | 'saved' | 'error'; message: string };

function App() {
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<TranslationProviderSetting>('remote');
  const [baseUrl, setBaseUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });

  useEffect(() => {
    void Promise.all([
      translationProviderSetting.getValue(),
      apiBaseUrlSetting.getValue(),
      apiAccessTokenSetting.getValue(),
      myMemoryEmailSetting.getValue(),
    ]).then(([storedProvider, storedUrl, storedToken, storedEmail]) => {
      setProvider(storedProvider);
      setBaseUrl(storedUrl);
      setAccessToken(storedToken);
      setEmail(storedEmail);
      setLoaded(true);
    });
  }, []);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const url = baseUrl.trim();
    const token = accessToken.trim();
    const contactEmail = email.trim();
    const originPattern = apiOriginPattern(url);

    if (provider === 'mymemory') {
      if (contactEmail && !isValidContactEmail(contactEmail)) {
        setStatus({ kind: 'error', message: 'Enter a valid email address, or leave it empty.' });
        return;
      }
      // MyMemory needs no URL, token, or host permission.
      void Promise.all([
        translationProviderSetting.setValue(provider),
        myMemoryEmailSetting.setValue(contactEmail),
      ]).then(
        () => setStatus({ kind: 'saved', message: 'Saved. Choose your draft’s language in the Telegram panel before translating.' }),
        () => setStatus({ kind: 'error', message: 'Could not save the settings.' }),
      );
      return;
    }

    if (provider === 'remote') {
      if (!originPattern) {
        setStatus({ kind: 'error', message: 'Enter an https:// server URL (http:// is allowed only for localhost).' });
        return;
      }
      if (!token) {
        setStatus({ kind: 'error', message: 'Enter the access token for your translation server.' });
        return;
      }
    }

    // Start saving before the permission prompt: Chrome may close the popup
    // while the prompt is open, so nothing below can depend on staying open.
    const saved = Promise.all([
      translationProviderSetting.setValue(provider),
      apiBaseUrlSetting.setValue(url),
      apiAccessTokenSetting.setValue(token),
    ]);

    if (provider === 'mock' || !originPattern) {
      void saved.then(() => setStatus({ kind: 'saved', message: 'Saved. The demo translator works offline and is not a real translation.' }));
      return;
    }

    // Must run in the click handler so Chrome treats it as a user gesture.
    void Promise.all([saved, browser.permissions.request({ origins: [originPattern] })]).then(([, granted]) => {
      setStatus(granted
        ? { kind: 'saved', message: 'Saved. Translate a Telegram draft to test the connection.' }
        : { kind: 'error', message: 'Saved, but access to the server was not allowed. Save again and allow it.' });
    }, () => setStatus({ kind: 'error', message: 'Could not save the settings.' }));
  };

  return (
    <main>
      <h1>Browser Translator</h1>
      <form onSubmit={save} aria-busy={!loaded}>
        <fieldset disabled={!loaded}>
          <label>
            Translator
            <select value={provider} onChange={(event) => setProvider(event.target.value as TranslationProviderSetting)}>
              {(Object.keys(TRANSLATION_PROVIDERS) as TranslationProviderId[]).map((id) => (
                <option key={id} value={id}>{TRANSLATION_PROVIDERS[id].label}</option>
              ))}
            </select>
          </label>

          {provider === 'mymemory' && (
            <>
              <label>
                Contact email (optional)
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <p className="hint">
                No account or key needed. Drafts are sent to MyMemory (Translated) only when you press Translate,
                up to 500 bytes each. An email raises MyMemory’s free daily limit; it is stored only in this browser.
              </p>
            </>
          )}

          {provider === 'remote' && (
            <>
              <label>
                Server URL
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://browser-translator-api.example.workers.dev"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <label>
                Access token
                <input
                  type="password"
                  autoComplete="off"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <p className="hint">Stored only in this browser. Drafts are sent to the server only when you press Translate.</p>
            </>
          )}

          <button type="submit">Save</button>
        </fieldset>
      </form>
      {status.message && <p className={`status ${status.kind}`} role="status">{status.message}</p>}
    </main>
  );
}

export default App;
