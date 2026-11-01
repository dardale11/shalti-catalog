import { admin } from '../api';
import type { Settings as S } from '../types';
import { useAdmin } from './AdminContext';

export function Settings() {
  const { data, refresh } = useAdmin();
  const s = data!.settings;
  const save = async (patch: Partial<S>) => (await admin.put('/settings', patch), refresh());

  return (
    <div>
      <div className="admin-head"><h1>Settings</h1></div>
      <section className="card narrow">
        <label className="check big">
          <input type="checkbox" checked={s.showPrices} onChange={(e) => save({ showPrices: e.target.checked })} />
          Show prices in the catalog
        </label>
        <p className="muted small">When off, prices stay saved here but aren’t sent to the shop screens.</p>

        <label className="field">
          <span>Return to start screen after (seconds idle)</span>
          <input type="number" min={15} defaultValue={s.idleSeconds} onBlur={(e) => save({ idleSeconds: Math.max(15, Number(e.target.value) || 60) })} />
        </label>

        <label className="field">
          <span>Currency symbol</span>
          <input defaultValue={s.currency} onBlur={(e) => save({ currency: e.target.value || '₪' })} />
        </label>
      </section>

      <section className="card narrow">
        <h2>Shop screens</h2>
        <p className="small">
          Open the catalog on the tablet, enter the shop code once, then use the browser’s “Add to Home screen / Install app”.
          For a locked-down kiosk use a kiosk browser (e.g. Fully Kiosk on Android, Guided Access on iPad).
          Screens update automatically when you save here.
        </p>
      </section>
    </div>
  );
}
