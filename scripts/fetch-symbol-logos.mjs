// Populates web/public/images/symbols/ with one logo per tradable symbol, so the app
// serves its own marks instead of hotlinking them at render time.
//
//   npm run logos            fetch anything not already on disk
//   npm run logos -- --force re-fetch everything, replacing what is there
//
// The source is a URL template carrying {symbol}; override it for whichever host you have
// rights to pull from:
//
//   SYMBOL_LOGO_SOURCE='https://example.com/logos/{symbol}.webp' npm run logos
//
// Files are written as <SYMBOL>.webp verbatim — `M&M.webp`, `BAJAJ-AUTO.webp` — because
// components/SymbolAvatar.tsx builds the URL with encodeURIComponent on the raw symbol.
// Whatever is missing stays missing; those rows fall back to the initials chip.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..');
const API = path.join(WEB, '..', 'api');
const OUT = path.join(WEB, 'public', 'images', 'symbols');

const SOURCE = process.env.SYMBOL_LOGO_SOURCE
  || 'https://tradefinder.b-cdn.net/assets/fno_symbol_curved/{symbol}.webp';

const FORCE = process.argv.includes('--force');
const CONCURRENCY = 8;

/* ---------------------------------------------------------------- the universe --- */

const read = async (p) => { try { return await readFile(p, 'utf8'); } catch { return null; } };

// Every quoted string inside an array literal. Parsing the arrays rather than the whole
// file keeps the sector *keys* out — "METAL" and "PSU BANK" are buckets, not tickers.
function symbolsInArrays(src) {
  const out = [];
  for (const [, body] of src.matchAll(/\[([^\]]*)\]/g))
    for (const [, sym] of body.matchAll(/['"]([A-Z0-9][A-Z0-9&.\-]{0,14})['"]/g)) out.push(sym);
  return out;
}

async function universe() {
  const found = new Set();

  // The F&O list the API actually trades off, when it has been fetched at least once.
  const cache = await read(path.join(API, '.cache', 'instruments.json'));
  if (cache) { try { for (const s of JSON.parse(cache).fno ?? []) found.add(s); } catch { /* fall through */ } }

  // Plus the pinned baskets, so a cold checkout with no cache still gets most of the board.
  for (const f of ['sectors.ts', 'indices.ts']) {
    const src = await read(path.join(API, 'src', f));
    if (src) for (const s of symbolsInArrays(src)) found.add(s);
  }

  return [...found].sort();
}

/* ------------------------------------------------------------------ the fetching --- */

async function grab(symbol) {
  const url = SOURCE.replace('{symbol}', encodeURIComponent(symbol));
  const res = await fetch(url, { headers: { accept: 'image/webp,image/*' } });
  if (!res.ok) return { symbol, status: res.status };

  // A host that answers 200 with an HTML error page would otherwise leave a .webp on disk
  // that every browser renders as a broken image — worse than no file at all.
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return { symbol, status: `not an image (${type || 'no type'})` };

  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) return { symbol, status: 'empty' };

  await writeFile(path.join(OUT, `${symbol}.webp`), bytes);
  return { symbol, ok: true, bytes: bytes.length };
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}

/* -------------------------------------------------------------------------- main --- */

await mkdir(OUT, { recursive: true });

const all = await universe();
if (!all.length) {
  console.error('No symbols found. Expected api/.cache/instruments.json or api/src/sectors.ts.');
  process.exit(1);
}

const onDisk = new Set((await readdir(OUT)).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
const todo = FORCE ? all : all.filter((s) => !onDisk.has(s));

console.log(`${all.length} symbols · ${onDisk.size} already on disk · fetching ${todo.length}`);
console.log(`source: ${SOURCE}\n`);

if (!todo.length) { console.log('Nothing to do.'); process.exit(0); }

const results = await inBatches(todo, CONCURRENCY, async (s) => {
  try { return await grab(s); } catch (e) { return { symbol: s, status: e.message }; }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nsaved ${results.length - failed.length} → ${path.relative(WEB, OUT)}`);
if (failed.length) {
  console.log(`no logo for ${failed.length} (these keep the initials chip):`);
  for (const f of failed) console.log(`  ${f.symbol.padEnd(14)} ${f.status}`);
}
