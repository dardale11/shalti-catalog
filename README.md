# Shalti HaZaken — in-shop catalog (PWA)

Touch catalog for the shop screen (brands → products → product page) plus an admin interface for
managing brands, products and categories, with an AI "fill from the web" helper.

Hebrew (RTL) by default with an English toggle. Works offline on the shop device once loaded.

## Run locally

```bash
npm install
npm run seed          # first time only: creates data/db.json from the shop website's e-cig listings
npm run build
npm start             # http://localhost:8840
```

Dev mode with hot reload: `npm run dev` (Vite on :5173, API on :8840).

| URL | What | Default secret |
| --- | --- | --- |
| `/` | Catalog (shop screen) | shop code `1234` |
| `/admin` | Admin | password `shalti` |

Override with env vars: `SHOP_CODE`, `ADMIN_PASSWORD`, `TOKEN_SECRET`, `PORT`, `DATA_DIR`, `AI_MODEL`.

## AI fill

"✨ Add with AI" / "Fill with AI" / "AI fill missing" run the locally installed **Claude Code CLI** headless
(`claude -p`, web tools only), so it uses whichever Claude account is logged in on this machine — no API key
in the app. Each lookup takes ~20–60s. Results are drafts: single lookups need **Save**; bulk-filled products
are tagged **review** until someone opens and saves them.

## Data

- `data/db.json` — everything (categories, brands, products, settings). Back it up.
- `data/uploads/` — images (resized in the browser before upload).
- `shared/specs.json` — spec fields per category template, flavour families, labels. Add a new
  template there to support new product types (e.g. vaporizers), then create a category using it.

## Shop screen setup

1. Open the catalog URL on the tablet, enter the shop code once.
2. Install it (Chrome: ⋮ → Install app / Safari: Share → Add to Home Screen).
3. For a locked kiosk: Fully Kiosk Browser (Android) or Guided Access (iPad).

Service workers need HTTPS (or `localhost`), so a tablet hitting `http://<laptop-ip>:8840` gets the catalog
but not offline mode / install. For real use, deploy behind HTTPS (see below).

## Next steps (not done yet)

- Hosting: move `db.json` → Supabase (Postgres + Storage + Auth), deploy the PWA to Vercel/Netlify.
  The AI lookup would then need an Anthropic API key in a server function instead of the local CLI.
- Admin UI is English only.
