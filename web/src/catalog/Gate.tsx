import { useState } from 'react';
import { login } from '../api';
import { useI18n } from '../i18n';
import { useCatalog } from './CatalogContext';
import { LOGO } from '../assets';

// One-time unlock per shop device, so the catalog isn't publicly browsable.
export function Gate() {
  const { t } = useI18n();
  const { reload } = useCatalog();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login('shop', code);
      reload();
    } catch {
      setError(true);
    }
  }

  return (
    <div className="gate">
      <img src={LOGO} alt="" className="gate-logo" />
      <form onSubmit={submit} className="gate-form">
        <label htmlFor="code">{t('enterCode')}</label>
        <input id="code" type="password" inputMode="numeric" autoFocus value={code} onChange={(e) => (setCode(e.target.value), setError(false))} />
        {error && <div className="error">{t('wrongCode')}</div>}
        <button className="btn primary">{t('unlock')}</button>
      </form>
    </div>
  );
}
