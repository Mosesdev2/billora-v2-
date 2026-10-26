import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './business.css';

const EMPTY = {
  name: '',
  tagline: '',
  email: '',
  phone: '',
  address: '',
  tax_pin: '',
  currency: 'KES',
};
const FIELDS = 'id,name,tagline,email,phone,address,tax_pin,currency';

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
      currency: form.currency,
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

  return (
    <form className="biz-form" onSubmit={save}>
      <p>
        {id
          ? 'These details will appear on your documents.'
          : 'Set up your business. This is the first step.'}
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

      <label>
        <span>KRA PIN (optional)</span>
        <input value={form.tax_pin} onChange={set('tax_pin')} maxLength={11} />
      </label>

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : id ? 'Save changes' : 'Create business'}
      </button>
    </form>
  );
}