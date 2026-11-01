import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { admin } from '../api';
import { CATEGORY_SPECS, ENUM_LABELS, FLAVOR_FAMILIES, SPECS } from '../i18n';
import type { AiDraft, Bi, Product } from '../types';
import { useAdmin } from './AdminContext';
import { importImages, mergeDraft, resolveBrand, resolveCategory, runAiLookup } from './aiApply';
import { uploadImage } from './images';

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};
const rid = () => Math.random().toString(36).slice(2, 10);

const blank = (brandId = '', categoryId = ''): Partial<Product> => ({
  brandId, categoryId, name: { he: '', en: '' }, description: { he: '', en: '' }, price: null, images: [],
  status: 'active', featured: false, specs: {}, flavorFamilies: [], variants: [],
});

export function ProductForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data, refresh } = useAdmin();
  const existing = data!.products.find((p) => p.id === id);
  const isNew = !existing;
  const [p, setP] = useState<Partial<Product>>(() => existing ?? blank(data!.brands[0]?.id, data!.categories[0]?.id));
  const [saving, setSaving] = useState(false);
  const [showAi, setShowAi] = useState(params.get('ai') === '1');

  useEffect(() => {
    if (existing) setP(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const setBi = (k: 'name' | 'description', lang: keyof Bi, v: string) => setP((cur) => ({ ...cur, [k]: { ...cur[k]!, [lang]: v } }));
  const setSpec = (k: string, v: unknown) =>
    setP((cur) => {
      const specs = { ...cur.specs };
      if (v === '' || v === undefined) delete specs[k];
      else specs[k] = v as string;
      return { ...cur, specs };
    });

  const template = data!.categories.find((c) => c.id === p.categoryId)?.template ?? '';
  const specKeys = [...new Set([...(CATEGORY_SPECS[template] ?? []), ...Object.keys(p.specs ?? {})])].filter((k) => SPECS[k]);

  async function save() {
    if (!p.name?.he && !p.name?.en) return alert('Name is required');
    if (!p.brandId) return alert('Pick a brand');
    setSaving(true);
    try {
      const body = { ...p, needsReview: false };
      const saved = isNew ? await admin.post<Product>('/products', body) : await admin.put<Product>(`/products/${existing!.id}`, body);
      await refresh();
      navigate(isNew ? `/admin/product/${saved.id}` : '/admin', { replace: isNew });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing || !confirm(`Delete "${existing.name.en || existing.name.he}"? This cannot be undone.`)) return;
    await admin.del(`/products/${existing.id}`);
    await refresh();
    navigate('/admin');
  }

  async function applyDraft(draft: AiDraft, images: string[], overwrite: boolean) {
    const brandId = isNew || !p.brandId ? await resolveBrand(data!, draft) : p.brandId;
    const categoryId = isNew ? resolveCategory(data!, draft) ?? p.categoryId : p.categoryId;
    const imported = await importImages(images, images.length);
    setP((cur) => ({
      ...mergeDraft(cur, draft, { overwrite }),
      brandId,
      categoryId,
      images: [...(cur.images ?? []), ...imported],
      aiSources: draft.sourceUrls,
    }));
    await refresh();
    setShowAi(false);
  }

  const brandOf = data!.brands.find((b) => b.id === p.brandId);

  return (
    <div className="form-page">
      <div className="admin-head">
        <button className="link" onClick={() => navigate('/admin')}>← Products</button>
        <h1>{isNew ? 'New product' : p.name?.en || p.name?.he}</h1>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowAi((s) => !s)}>✨ {showAi ? 'Hide AI' : 'Fill with AI'}</button>
        {!isNew && <button className="btn danger" onClick={remove}>Delete</button>}
        <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      {existing?.needsReview && <div className="notice warn">Filled automatically by AI — check the details, then Save to mark as reviewed.</div>}

      {showAi && (
        <AiPanel
          initialQuery={[brandOf?.name.en, p.name?.en].filter(Boolean).join(' ')}
          hint={p.name?.he ? `Hebrew listing name: ${p.name.he}` : undefined}
          hasData={!isNew}
          onApply={applyDraft}
        />
      )}

      <div className="form-grid">
        <section className="card">
          <h2>Basics</h2>
          <div className="two">
            <Field label="Name (Hebrew)"><input dir="rtl" value={p.name?.he ?? ''} onChange={(e) => setBi('name', 'he', e.target.value)} /></Field>
            <Field label="Name (English)"><input value={p.name?.en ?? ''} onChange={(e) => setBi('name', 'en', e.target.value)} /></Field>
          </div>
          <div className="three">
            <Field label="Brand">
              <select value={p.brandId} onChange={(e) => set('brandId', e.target.value)}>
                <option value="">—</option>
                {data!.brands.map((b) => <option key={b.id} value={b.id}>{b.name.en}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select value={p.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                {data!.categories.map((c) => <option key={c.id} value={c.id}>{c.name.en}</option>)}
              </select>
            </Field>
            <Field label={`Price (${data!.settings.currency})`}>
              <input type="number" value={p.price ?? ''} onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))} />
            </Field>
          </div>
          <div className="three">
            <Field label="Status">
              <select value={p.status} onChange={(e) => set('status', e.target.value as Product['status'])}>
                <option value="active">Active</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
            <label className="check"><input type="checkbox" checked={!!p.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured (home + screensaver)</label>
          </div>
          <Field label="Description (Hebrew)"><textarea dir="rtl" rows={4} value={p.description?.he ?? ''} onChange={(e) => setBi('description', 'he', e.target.value)} /></Field>
          <Field label="Description (English)"><textarea rows={4} value={p.description?.en ?? ''} onChange={(e) => setBi('description', 'en', e.target.value)} /></Field>
        </section>

        <section className="card">
          <h2>Images</h2>
          <ImageList images={p.images ?? []} onChange={(imgs) => set('images', imgs)} />
        </section>

        <section className="card">
          <h2>Specifications</h2>
          <div className="spec-form">
            {specKeys.map((k) => {
              const d = SPECS[k];
              const v = p.specs?.[k];
              return (
                <Field key={k} label={`${d.en}${d.unit ? ` (${d.unit})` : ''}`}>
                  {d.type === 'boolean' ? (
                    <select value={v === undefined ? '' : String(v)} onChange={(e) => setSpec(k, e.target.value === '' ? '' : e.target.value === 'true')}>
                      <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                    </select>
                  ) : d.type === 'enum' ? (
                    <select value={String(v ?? '')} onChange={(e) => setSpec(k, e.target.value)}>
                      <option value="">—</option>
                      {d.options!.map((o) => <option key={o} value={o}>{ENUM_LABELS[o]?.en ?? o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={d.type === 'number' ? 'number' : 'text'}
                      value={String(v ?? '')}
                      onChange={(e) => setSpec(k, d.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
          <h3>Flavour families</h3>
          <div className="chips wrap">
            {Object.entries(FLAVOR_FAMILIES).map(([k, b]) => {
              const on = p.flavorFamilies?.includes(k);
              return (
                <button key={k} type="button" className={`chip sm ${on ? 'on' : ''}`}
                  onClick={() => set('flavorFamilies', on ? p.flavorFamilies!.filter((x) => x !== k) : [...(p.flavorFamilies ?? []), k])}>
                  {b.en}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>Variants <span className="muted small">(colours / flavours)</span></h2>
          <Variants value={p.variants ?? []} onChange={(v) => set('variants', v)} />
        </section>

        {(p.aiSources?.length || p.sourceUrl) && (
          <section className="card">
            <h2>Sources</h2>
            <ul className="sources">
              {p.sourceUrl && <li><a href={p.sourceUrl} target="_blank" rel="noreferrer">Shop website listing</a></li>}
              {p.aiSources?.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function ImageList({ images, onChange }: { images: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all([...files].map(uploadImage));
      onChange([...images, ...urls]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addUrl() {
    if (!url) return;
    setBusy(true);
    const got = await importImages([url], 1);
    setBusy(false);
    if (!got.length) return alert('Could not download that image');
    onChange([...images, ...got]);
    setUrl('');
  }

  const move = (i: number, d: number) => {
    const next = [...images];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div
        className="image-list"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), addFiles(e.dataTransfer.files))}
      >
        {images.map((src, i) => (
          <div key={src} className="image-item">
            <img src={src} alt="" />
            {i === 0 && <span className="tag">cover</span>}
            <div className="image-actions">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
              <button type="button" onClick={() => onChange(images.filter((x) => x !== src))}>✕</button>
              <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)}>›</button>
            </div>
          </div>
        ))}
        <button type="button" className="image-add" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? '…' : '+ Upload\n(or drop files)'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
      <div className="inline">
        <input placeholder="…or paste image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="btn" onClick={addUrl} disabled={busy || !url}>Add</button>
      </div>
    </div>
  );
}

function Variants({ value, onChange }: { value: Product['variants']; onChange: (v: Product['variants']) => void }) {
  const upd = (i: number, patch: Partial<Product['variants'][number]>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="variants">
      {value.map((v, i) => (
        <div key={v.id} className="variant-row">
          <input dir="rtl" placeholder="Hebrew" value={v.name.he} onChange={(e) => upd(i, { name: { ...v.name, he: e.target.value } })} />
          <input placeholder="English" value={v.name.en} onChange={(e) => upd(i, { name: { ...v.name, en: e.target.value } })} />
          <label className="check"><input type="checkbox" checked={v.inStock} onChange={(e) => upd(i, { inStock: e.target.checked })} /> in stock</label>
          <VariantImage value={v.image} onChange={(image) => upd(i, { image })} />
          <button type="button" className="icon-btn sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, { id: rid(), name: { he: '', en: '' }, inStock: true }])}>+ Add variant</button>
    </div>
  );
}

function VariantImage({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="variant-img" onClick={() => (value ? onChange(undefined) : input.current?.click())} title={value ? 'Remove image' : 'Add image'}>
        {value ? <img src={value} alt="" /> : '🖼'}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && onChange(await uploadImage(e.target.files[0]))} />
    </>
  );
}

function AiPanel({ initialQuery, hint, hasData, onApply }: {
  initialQuery: string; hint?: string; hasData: boolean;
  onApply: (d: AiDraft, images: string[], overwrite: boolean) => Promise<void>;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<'idle' | 'running' | 'applying'>('idle');
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(!hasData);
  const [error, setError] = useState('');
  const started = useRef(0);
  const [, tick] = useState(0);

  useEffect(() => {
    if (state !== 'running') return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  async function run() {
    setState('running');
    setError('');
    setDraft(null);
    started.current = Date.now();
    try {
      const d = await runAiLookup(query, hint);
      setDraft(d);
      setPicked(d.imageUrls.slice(0, 3));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState('idle');
    }
  }

  return (
    <section className="card ai-panel">
      <h2>✨ Fill with AI</h2>
      <p className="muted small">Claude searches the web for the product and drafts the details. Nothing is saved until you click Save.</p>
      <div className="inline">
        <input placeholder="Product name, e.g. Voopoo Argus P1" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        <button className="btn primary" disabled={!query || state !== 'idle'} onClick={run}>
          {state === 'running' ? `Searching… ${Math.round((Date.now() - started.current) / 1000)}s` : 'Search'}
        </button>
      </div>
      {error && <pre className="error">{error}</pre>}
      {draft && (
        <div className="ai-result">
          {!draft.found && <div className="notice warn">Claude wasn’t sure it found this exact product — check carefully.</div>}
          <div className="two">
            <div><b>{draft.name.en}</b><div dir="rtl">{draft.name.he}</div><div className="muted small">{draft.brand.en} · {draft.category}</div></div>
            <div className="muted small">{draft.description.en}</div>
          </div>
          <dl className="spec-table compact">
            {Object.entries(draft.specs).map(([k, v]) => (
              <div key={k}><dt>{SPECS[k]?.en ?? k}</dt><dd>{String(v)}{SPECS[k]?.unit ? ` ${SPECS[k].unit}` : ''}</dd></div>
            ))}
          </dl>
          {draft.variants.length > 0 && <p className="small"><b>Variants:</b> {draft.variants.map((v) => v.en).join(', ')}</p>}
          {draft.imageUrls.length > 0 && (
            <>
              <p className="small"><b>Images</b> — tap to select:</p>
              <div className="image-list">
                {draft.imageUrls.map((u) => (
                  <button key={u} type="button" className={`image-item pick ${picked.includes(u) ? 'on' : ''}`}
                    onClick={() => setPicked((cur) => (cur.includes(u) ? cur.filter((x) => x !== u) : [...cur, u]))}>
                    <img src={u} alt="" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')} />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="small muted">Sources: {draft.sourceUrls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{hostOf(u)} </a>)}</p>
          <div className="inline">
            {hasData && <label className="check"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Overwrite fields I already filled</label>}
            <div className="spacer" />
            <button className="btn primary" disabled={state !== 'idle'} onClick={async () => { setState('applying'); await onApply(draft, picked, overwrite); setState('idle'); }}>
              {state === 'applying' ? 'Applying…' : 'Apply to form'}
            </button>
          </div>
          {draft.costUsd !== undefined && <p className="muted small">Estimated cost: ${draft.costUsd.toFixed(3)} (counted against your Claude usage)</p>}
        </div>
      )}
    </section>
  );
}
