// Renders an icon SVG (128×128 viewBox) to public/icon/{16,32,48,96,128}.png
// with a transparent background, using a local Google Chrome in headless mode.
// Usage: node scripts/render-icons.mjs assets/brand/tilmo-icon-dark.svg public/icon
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [svgPath, outDir] = process.argv.slice(2);
const source = readFileSync(svgPath, 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'render-icons-'));
const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch('http://127.0.0.1:9342/json')).json()).find((t) => t.type === 'page'); } catch {} await sleep(200); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const size of [16, 32, 48, 96, 128]) {
    const svg = source.replace('width="128" height="128"', `width="${size}" height="${size}"`)
      // Chrome Web Store: 96px artwork with 16px transparent padding in the 128px icon.
      .replace('viewBox="0 0 128 128"', size === 128 ? 'viewBox="-16 -16 160 160"' : 'viewBox="0 0 128 128"');
    const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
    await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
    await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    writeFileSync(join(outDir, `${size}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  ws.close();
} finally { chrome.kill(); }
