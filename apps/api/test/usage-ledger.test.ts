import { describe, expect, it } from 'vitest';
import { billingPeriod, releaseCharacters, reserveCharacters } from '../src/usage/usage-ledger';
import { memoryStorage } from './helpers';

const october = new Date('2026-10-31T23:59:59Z');
const november = new Date('2026-11-01T00:00:00Z');

describe('usage ledger', () => {
  it('reserves characters up to the limit, inclusive', async () => {
    const storage = memoryStorage();
    expect(await reserveCharacters(storage, 60, 100, october)).toEqual({ allowed: true, period: '2026-10', used: 60, limit: 100 });
    expect(await reserveCharacters(storage, 40, 100, october)).toMatchObject({ allowed: true, used: 100 });
    expect(await reserveCharacters(storage, 1, 100, october)).toMatchObject({ allowed: false, used: 100 });
  });

  it('does not count rejected reservations', async () => {
    const storage = memoryStorage();
    await reserveCharacters(storage, 90, 100, october);
    await reserveCharacters(storage, 20, 100, october);
    expect(await reserveCharacters(storage, 10, 100, october)).toMatchObject({ allowed: true, used: 100 });
  });

  it('starts a new budget each UTC month', async () => {
    const storage = memoryStorage();
    await reserveCharacters(storage, 100, 100, october);
    expect(await reserveCharacters(storage, 100, 100, november)).toMatchObject({ allowed: true, period: '2026-11' });
    expect(billingPeriod(october)).toBe('2026-10');
  });

  it('releases into the reservation period and never goes negative', async () => {
    const storage = memoryStorage();
    const reservation = await reserveCharacters(storage, 30, 100, october);
    await reserveCharacters(storage, 5, 100, november);
    await releaseCharacters(storage, 30, reservation.period);
    await releaseCharacters(storage, 30, reservation.period);
    expect(storage.values.get('characters:2026-10')).toBe(0);
    expect(storage.values.get('characters:2026-11')).toBe(5);
  });
});
