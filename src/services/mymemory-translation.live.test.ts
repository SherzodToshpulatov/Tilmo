import { describe, expect, it } from 'vitest';
import { MyMemoryTranslationService } from './mymemory-translation';

// Calls the real MyMemory API with fixed sample sentences, never user drafts.
// Opt-in so the regular suite stays offline: `npm run test:live`.
describe.skipIf(!process.env.MYMEMORY_LIVE)('MyMemory live API', () => {
  const translator = new MyMemoryTranslationService({ timeoutMs: 20000 });

  it.each([
    ['uz', 'en', 'Salom, yaxshimisan?', /\b(hello|hi)\b/i],
    ['en', 'uz', 'Thank you very much', /rahmat/i],
    ['ru', 'en', 'Привет, как дела?', /\b(hello|hi)\b/i],
    ['en', 'ru', 'Good morning, my friend', /(утр|друг)/i],
  ])('%s → %s: %j', async (source, target, text, expected) => {
    const result = await translator.translate({ text, source, target });
    expect(result.provider).toBe('mymemory');
    expect(result.translatedText).toMatch(expected);
    expect(result.translatedText).not.toMatch(/<x\b|MYMEMORY WARNING/i);
  }, 30000);

  it('reports an invalid pair as unavailable instead of returning the error text', async () => {
    await expect(translator.translate({ text: 'Hello', source: 'en', target: 'xx' }))
      .rejects.toMatchObject({ code: 'language_pair_unavailable' });
  }, 30000);
});
