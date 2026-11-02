import { useEffect, useState, type FormEvent } from 'react';
import { SwapIcon, TilmoMark } from '@/src/components/icons';
import {
  LANGUAGES,
  resolveSourceLanguage,
  type LanguageCode,
  type SourceLanguage,
} from '@/src/core/languages';
import { TRANSLATION_PROVIDERS, type TranslationProviderId } from '@/src/services/providers';
import {
  apiAccessTokenSetting,
  apiBaseUrlSetting,
  apiOriginPattern,
  isValidContactEmail,
  myMemoryEmailSetting,
  sourceLanguageSetting,
  targetLanguageSetting,
  translationProviderSetting,
} from '@/src/utils/settings';
import './App.css';

const PRIVACY_URL = 'https://github.com/SherzodToshpulatov/Tilmo/blob/main/PRIVACY.md';

type Status = { kind: 'idle' | 'saved' | 'error'; message: string };
type FieldErrors = Partial<Record<'email' | 'url' | 'token', string>>;

const PROVIDER_IDS = Object.keys(TRANSLATION_PROVIDERS) as TranslationProviderId[];

const RECIPIENT: Record<TranslationProviderId, string> = {
  mymemory: 'MyMemory (Translated srl)',
  remote: 'your Tilmo server and Google Cloud Translation',
  mock: 'nowhere — the demo works offline',
};

function App() {
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<TranslationProviderId>('mymemory');
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('auto');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('en');
  const [email, setEmail] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });

  useEffect(() => {
    void Promise.all([
      translationProviderSetting.getValue(),
      sourceLanguageSetting.getValue(),
      targetLanguageSetting.getValue(),
      myMemoryEmailSetting.getValue(),
      apiBaseUrlSetting.getValue(),
      apiAccessTokenSetting.getValue(),
    ]).then(([storedProvider, storedSource, storedTarget, storedEmail, storedUrl, storedToken]) => {
      setProvider(storedProvider);
      setSourceLanguage(storedSource);
      setTargetLanguage(storedTarget);
      setEmail(storedEmail);
      setBaseUrl(storedUrl);
      setAccessToken(storedToken);
      setLoaded(true);
    });
  }, []);

  const info = TRANSLATION_PROVIDERS[provider];
  const shownSource = resolveSourceLanguage(sourceLanguage, targetLanguage, info.supportsAutoDetect);
  const edited = () => setStatus({ kind: 'idle', message: '' });

  const changeSource = (language: SourceLanguage) => {
    if (language === targetLanguage) setTargetLanguage(shownSource !== 'auto' ? shownSource : language === 'en' ? 'uz' : 'en');
    setSourceLanguage(language);
    edited();
  };
  const changeTarget = (language: LanguageCode) => {
    if (language === shownSource) setSourceLanguage(targetLanguage);
    setTargetLanguage(language);
    edited();
  };
  const swap = () => {
    if (shownSource === 'auto') return;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(shownSource);
    edited();
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const contactEmail = email.trim();
    const url = baseUrl.trim();
    const token = accessToken.trim();
    const originPattern = apiOriginPattern(url);

    const nextErrors: FieldErrors = {};
    if (provider === 'mymemory' && contactEmail && !isValidContactEmail(contactEmail)) {
      nextErrors.email = 'Enter a valid email address, or leave this empty.';
    }
    if (provider === 'remote' && !originPattern) {
      nextErrors.url = 'Use an https:// address (http:// only for localhost).';
    }
    if (provider === 'remote' && !token) nextErrors.token = 'Enter the access token for your server.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ kind: 'error', message: 'Check the highlighted fields.' });
      return;
    }

    // Start saving before any permission prompt: Chrome may close the popup
    // while the prompt is open, so nothing below can depend on staying open.
    const saved = Promise.all([
      translationProviderSetting.setValue(provider),
      sourceLanguageSetting.setValue(shownSource),
      targetLanguageSetting.setValue(targetLanguage),
      myMemoryEmailSetting.setValue(contactEmail),
      apiBaseUrlSetting.setValue(url),
      apiAccessTokenSetting.setValue(token),
    ]);

    if (provider !== 'remote' || !originPattern) {
      void saved.then(
        () => setStatus({ kind: 'saved', message: 'Saved.' }),
        () => setStatus({ kind: 'error', message: 'Could not save the settings.' }),
      );
      return;
    }

    // Must run in the click handler so Chrome treats it as a user gesture.
    void Promise.all([saved, browser.permissions.request({ origins: [originPattern] })]).then(([, granted]) => {
      setStatus(granted
        ? { kind: 'saved', message: 'Saved. Translate a draft to test the connection.' }
        : { kind: 'error', message: 'Saved, but access to the server was not allowed. Save again and allow it.' });
    }, () => setStatus({ kind: 'error', message: 'Could not save the settings.' }));
  };

  const describedBy = (field: keyof FieldErrors, hint: string) => (errors[field] ? `${field}-error ${hint}` : hint);

  return (
    <main>
      <header className="brand">
        <TilmoMark size={36} />
        <div>
          <h1>Tilmo</h1>
          <p>Translate where you type.</p>
        </div>
      </header>

      <form onSubmit={save} aria-busy={!loaded} noValidate>
        <fieldset disabled={!loaded}>
          <div className="field">
            <label htmlFor="provider">Translator</label>
            <select
              id="provider"
              value={provider}
              aria-describedby="provider-hint"
              onChange={(event) => { setProvider(event.target.value as TranslationProviderId); setErrors({}); edited(); }}
            >
              {PROVIDER_IDS.map((id) => <option key={id} value={id}>{TRANSLATION_PROVIDERS[id].label}</option>)}
            </select>
            <p className="hint" id="provider-hint">{info.description}</p>
          </div>

          {provider === 'mymemory' && (
            <div className="field">
              <label htmlFor="email">Contact email <span className="optional">optional</span></label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                spellCheck={false}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describedBy('email', 'email-hint')}
                onChange={(event) => { setEmail(event.target.value); edited(); }}
              />
              {errors.email && <p className="field-error" id="email-error">{errors.email}</p>}
              <p className="hint" id="email-hint">
                Sent to MyMemory to raise its free daily limit. MyMemory needs no server URL or access token.
              </p>
            </div>
          )}

          {provider === 'remote' && (
            <>
              <div className="field">
                <label htmlFor="url">Server URL</label>
                <input
                  id="url"
                  type="url"
                  inputMode="url"
                  placeholder="https://browser-translator-api.example.workers.dev"
                  value={baseUrl}
                  spellCheck={false}
                  aria-invalid={Boolean(errors.url)}
                  aria-describedby={describedBy('url', 'url-hint')}
                  onChange={(event) => { setBaseUrl(event.target.value); edited(); }}
                />
                {errors.url && <p className="field-error" id="url-error">{errors.url}</p>}
                <p className="hint" id="url-hint">Your deployed Tilmo server (see the README).</p>
              </div>
              <div className="field">
                <label htmlFor="token">Access token</label>
                <input
                  id="token"
                  type="password"
                  autoComplete="off"
                  value={accessToken}
                  spellCheck={false}
                  aria-invalid={Boolean(errors.token)}
                  aria-describedby={describedBy('token', 'token-hint')}
                  onChange={(event) => { setAccessToken(event.target.value); edited(); }}
                />
                {errors.token && <p className="field-error" id="token-error">{errors.token}</p>}
                <p className="hint" id="token-hint">Stored only in this browser.</p>
              </div>
            </>
          )}

          {provider === 'mock' && (
            <p className="notice">The demo shows labelled placeholder output so you can try the interface. It does not translate.</p>
          )}

          <div className="field">
            <span className="label" id="languages-label">Default languages</span>
            <div className="languages" role="group" aria-labelledby="languages-label">
              <select aria-label="Translate from" value={shownSource} onChange={(event) => changeSource(event.target.value as SourceLanguage)}>
                {info.supportsAutoDetect && <option value="auto">Detect language</option>}
                {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
              </select>
              <button className="icon-button" type="button" aria-label="Swap languages" title="Swap languages" disabled={shownSource === 'auto'} onClick={swap}>
                <SwapIcon />
              </button>
              <select aria-label="Translate to" value={targetLanguage} onChange={(event) => changeTarget(event.target.value as LanguageCode)}>
                {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
              </select>
            </div>
            <p className="hint">You can also change these in the Translate panel.</p>
          </div>

          <div className="save-row">
            <button className="primary" type="submit">Save</button>
            <p className={`status ${status.kind}`} role="status">{status.message}</p>
          </div>
        </fieldset>
      </form>

      <footer className="privacy">
        <p>
          Text is sent to {RECIPIENT[provider]} only when you press Translate. Drafts are not stored and messages are
          never sent automatically. <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy</a>
        </p>
      </footer>
    </main>
  );
}

export default App;
