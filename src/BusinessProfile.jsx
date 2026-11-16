import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import BusinessTypePicker, { businessTypes } from './BusinessTypePicker.jsx';
import './business.css';

const EMPTY = {
  name: '',
  tagline: '',
  email: '',
  phone: '',
  address: '',
  tax_pin: '',
  till_number: '',
  currency: 'KES',
  business_type: '',
};
const FIELDS =
  'id,name,tagline,email,phone,address,tax_pin,till_number,currency,business_type';

function fromRow(row) {
  const out = { ...EMPTY };
  Object.keys(EMPTY).forEach((k) => {
    if (row[k] != null) out[k] = row[k];
  });
  return out;
}

export default function BusinessProfile() {
  const [id, setId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from('businesses')
        .select(FIELDS)
        .order('created_at', { ascending: true })
        .limit(1);
      if (cancelled) return;
      if (error) setMsg({ type: 'error', text: error.message });
      else if (data.length) {
        setId(data[0].id);
        setForm(fromRow(data[0]));
      } else {
        setStep('type');
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function set(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const pin = form.tax_pin.trim().toUpperCase();
    if (!form.business_type) {
      setMsg({ type: 'error', text: 'Choose your business type first.' });
      return;
    }
    if (!name) {
      setMsg({ type: 'error', text: 'Enter your business name.' });
      return;
    }
    if (pin && !/^[A-Z]\d{9}[A-Z]$/.test(pin)) {
      setMsg({ type: 'error', text: 'KRA PIN looks wrong. Example: A123456789B.' });
      return;
    }

    setBusy(true);
    setMsg(null);

    const payload = {
      name,
      tagline: form.tagline.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      tax_pin: pin,
      till_number: form.till_number.trim(),
      currency: form.currency,
      business_type: form.business_type,
    };

    const query = id
      ? supabase.from('businesses').update(payload).eq('id', id)
      : supabase.from('businesses').insert(payload);
    const { data, error } = await query.select(FIELDS).single();

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setId(data.id);
      setForm(fromRow(data));
      setMsg({ type: 'info', text: 'Business profile saved.' });
    }
    setBusy(false);
  }

  if (loading) return <p>Loading...</p>;

  if (step === 'type') {
    return (
      <div className="biz-form">
        <BusinessTypePicker
          value={form.business_type}
          onChange={(v) => setForm({ ...form, business_type: v })}
        />
        <button
          className="btn-primary"
          type="button"
          disabled={!form.business_type}
          onClick={() => setStep('form')}
          style={{ marginTop: 16 }}
        >
          Continue
        </button>
        {id && (
          <button type="button" onClick={() => setStep('form')} style={{ marginTop: 8 }}>
            Cancel
          </button>
        )}
      </div>
    );
  }

  const typeInfo = businessTypes.find((t) => t.id === form.business_type);

  return (
    <form className="biz-form" onSubmit={save}>
      <p>
        {id
          ? 'These details will appear on your documents.'
          : 'Almost done. Add your business details.'}
      </p>

      <p>
        Business type:{' '}
        <strong>{typeInfo ? typeInfo.icon + ' ' + typeInfo.title : 'Not set'}</strong>{' '}
        <button type="button" onClick={() => setStep('type')}>
          Change
        </button>
      </p>

      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      <label>
        <span>Business name</span>
        <input value={form.name} onChange={set('name')} maxLength={100} required />
      </label>

      <label>
        <span>Business description (optional)</span>
        <input
          value={form.tagline}
          onChange={set('tagline')}
          maxLength={80}
          placeholder="e.g. Dealers in all electronics"
        />
      </label>

      <label>
        <span>Email</span>
        <input type="email" value={form.email} onChange={set('email')} />
      </label>

      <div className="row">
        <label>
          <span>Phone</span>
          <input type="tel" value={form.phone} onChange={set('phone')} />
        </label>
        <label>
          <span>Currency</span>
          <select value={form.currency} onChange={set('currency')}>
            <option value="KES">KES</option>
            <option value="UGX">UGX</option>
            <option value="TZS">TZS</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      <label>
        <span>Address</span>
        <textarea value={form.address} onChange={set('address')} />
      </label>

      <div className="row">
        <label>
          <span>KRA PIN (optional)</span>
          <input value={form.tax_pin} onChange={set('tax_pin')} maxLength={11} />
        </label>
        <label>
          <span>Till number (optional)</span>
          <input value={form.till_number} onChange={set('till_number')} maxLength={12} />
        </label>
      </div>

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : id ? 'Save changes' : 'Create business'}
      </button>
    </form>
  );
}