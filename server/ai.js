// "Add with AI": looks a product up on the web and returns a draft for the admin to review.
// Runs the locally logged-in Claude Code CLI headless (`claude -p`), restricted to web tools,
// so it uses the owner's Claude account with no API key in this app.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const specsDef = JSON.parse(fs.readFileSync(new URL('../shared/specs.json', import.meta.url), 'utf8'));
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const TIMEOUT_MS = 4 * 60_000;

const bi = { type: 'object', properties: { he: { type: 'string' }, en: { type: 'string' } }, required: ['he', 'en'] };

const specProps = Object.fromEntries(
  Object.entries(specsDef.specs).map(([k, d]) => [
    k,
    d.type === 'number' ? { type: 'number' }
      : d.type === 'boolean' ? { type: 'boolean' }
      : d.type === 'enum' ? { type: 'string', enum: d.options }
      : { type: 'string' },
  ]),
);

const SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    brand: bi,
    category: { type: 'string', enum: ['disposable', 'pod', 'mod', 'liquid', 'accessory'] },
    name: bi,
    description: bi,
    specs: { type: 'object', properties: specProps },
    flavorFamilies: { type: 'array', items: { type: 'string', enum: Object.keys(specsDef.flavorFamilies) } },
    variants: { type: 'array', items: bi },
    imageUrls: { type: 'array', items: { type: 'string' } },
    sourceUrls: { type: 'array', items: { type: 'string' } },
  },
  required: ['found', 'brand', 'category', 'name', 'description', 'specs', 'variants', 'imageUrls', 'sourceUrls'],
};

function buildPrompt(query, hint) {
  return `You are filling a product record for an in-store electronic-cigarette catalog in an Israeli shop (Hebrew first, English second).

Product to look up: "${query}"
${hint ? `Extra context from the shop: ${hint}\n` : ''}
Steps:
1. Search the web and find the official manufacturer page and/or reputable retailer pages for this exact product.
2. Extract technical specs. Only fill a spec if a source states it; omit unknown specs rather than guessing.
   Units: puffs as an integer, ml as numbers, nicotine in mg/ml (5% = 50), battery in mAh, power in W.
3. Category: "disposable" (single-use / prefilled, sold by puff count), "pod" (refillable pod system, usually MTL),
   "mod" (larger DL kits / box mods), "liquid", or "accessory".
4. Variants: available colours (devices) or flavours (disposables/liquids). Max 20.
5. flavorFamilies: only for disposables/liquids, from the allowed list.
6. Description: 2-3 short neutral sentences describing the device (what it is, key features). No health claims,
   no marketing superlatives, no prices. Write a natural Hebrew version and an English version.
7. Hebrew name: brand + model transliterated the way Israeli shops write it (e.g. "אספייר מיניקאן 4"), English name as the manufacturer writes it.
8. imageUrls: up to 5 DIRECT image file URLs (jpg/png/webp) of the product itself, preferably on a clean/white background,
   taken from the manufacturer or retailer pages you visited. Verify they are direct image links.
9. If you cannot identify the product, set found=false and fill what you can.

Return only the structured result.`;
}

export function aiLookup(query, hint) {
  return new Promise((resolve, reject) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'shalti-ai-'));
    const args = [
      '-p', buildPrompt(query, hint),
      '--output-format', 'json',
      '--json-schema', JSON.stringify(SCHEMA),
      '--tools', 'WebSearch', 'WebFetch',
      '--allowedTools', 'WebSearch', 'WebFetch',
      '--strict-mcp-config',
      '--no-session-persistence',
    ];
    if (process.env.AI_MODEL) args.push('--model', process.env.AI_MODEL);

    const child = spawn(CLAUDE_BIN, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);

    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not run "${CLAUDE_BIN}": ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.rmSync(cwd, { recursive: true, force: true });
      try {
        const env = JSON.parse(out);
        if (env.is_error) throw new Error(env.result || 'Claude returned an error');
        const data = env.structured_output ?? extractJson(env.result);
        withPageImages(data, query).then((imageUrls) => resolve({ ...data, imageUrls, costUsd: env.total_cost_usd }));
      } catch (e) {
        reject(new Error(`AI lookup failed (exit ${code}): ${e.message}\n${err.slice(-500)}`));
      }
    });
  });
}

// Claude's page reader drops <img> tags, so it often can't return image links. Scrape the source
// pages it found for og:image + product-looking images, and keep only URLs that really serve an image.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const MAX_IMAGES = 8;

async function withPageImages(data, query) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const candidates = [...(data.imageUrls ?? [])];
  for (const page of (data.sourceUrls ?? []).slice(0, 3)) {
    try {
      const r = await fetch(page, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) continue;
      const html = await r.text();
      const abs = (u) => { try { return new URL(u.replace(/&amp;/g, '&'), page).href; } catch { return null; } };
      const og = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/gi)].map((m) => m[1]);
      const imgs = [...html.matchAll(/<img[^>]+(?:data-src|data-large_image|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi)]
        .map((m) => m[1])
        // Prefer images whose filename mentions the model; skip logos/icons/thumbnails.
        .filter((u) => !/logo|icon|banner|sprite|avatar|payment|-\d{2,3}x\d{2,3}\./i.test(u))
        .filter((u) => words.some((w) => u.toLowerCase().includes(w)));
      candidates.push(...og, ...imgs);
    } catch { /* source page unreachable */ }
  }
  // Same image is often listed at several sizes (?MaxWidth=...): keep one per file path.
  const byPath = new Map();
  for (const raw of candidates) {
    try {
      const u = new URL(raw.replace(/&amp;/g, '&'));
      const key = u.origin + u.pathname;
      if (!byPath.has(key)) byPath.set(key, u.href);
    } catch { /* not a URL */ }
  }
  const ok = [];
  for (const u of byPath.values()) {
    if (ok.length >= MAX_IMAGES) break;
    if (await isImage(u)) ok.push(u);
  }
  return ok;
}

async function isImage(url) {
  try {
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, signal: AbortSignal.timeout(10_000) });
    r.body?.cancel();
    return r.ok && /^image\//.test(r.headers.get('content-type') || '');
  } catch {
    return false;
  }
}

function extractJson(text = '') {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in response');
  return JSON.parse(m[0]);
}
