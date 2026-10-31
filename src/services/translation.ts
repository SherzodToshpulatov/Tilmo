export interface TranslationService {
  translate(text: string): Promise<string>;
}

const DEMO_TRANSLATIONS = new Map<string, string>([
  ['salom, yaxshimisan?', 'Hello, how are you?'],
  ['salom', 'Hello'],
  ['rahmat', 'Thank you'],
]);

export const mockTranslationService: TranslationService = {
  async translate(text) {
    const normalized = text.trim().toLocaleLowerCase();
    const knownTranslation = DEMO_TRANSLATIONS.get(normalized);
    if (knownTranslation) return knownTranslation;

    await Promise.resolve();
    return `[Demo translation — not a real translation] ${text}`;
  },
};
