// Generates a random API access token and the SHA-256 hash the Worker stores.
// The token goes into the extension settings; only the hash goes to Cloudflare.
import { createHash, randomBytes } from 'node:crypto';

const token = `btk_${randomBytes(32).toString('base64url')}`;
const hash = createHash('sha256').update(token).digest('hex');

console.log(`Access token (paste into the extension settings, keep private):\n  ${token}\n`);
console.log(`SHA-256 hash (add to API_ACCESS_TOKEN_HASHES, comma-separated):\n  ${hash}`);
