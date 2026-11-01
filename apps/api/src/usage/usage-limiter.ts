import { DurableObject } from 'cloudflare:workers';
import { releaseCharacters, reserveCharacters, type UsageReservation } from './usage-ledger';

/**
 * One global instance holds the monthly character count. Durable Objects
 * process requests one at a time, which makes the budget a strict cap.
 */
export class UsageLimiter extends DurableObject<Env> {
  reserve(characters: number, limit: number): Promise<UsageReservation> {
    return reserveCharacters(this.ctx.storage, characters, limit, new Date());
  }

  release(characters: number, period: string): Promise<void> {
    return releaseCharacters(this.ctx.storage, characters, period);
  }
}
