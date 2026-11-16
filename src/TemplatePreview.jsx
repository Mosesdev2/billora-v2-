import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import DocumentRenderer from './DocumentRenderer.jsx';
import { templateTypeFor } from './BusinessTypePicker.jsx';

const samples = {
  minimarket: {
    number: '012384',
    discount: 0,
    paid: 2000,
    items: [
      { item: 'Maize flour 2kg', qty: 2, price: 150 },
      { item: 'Milk 500ml', qty: 4, price: 65 },
      { item: 'Tomatoes 1kg', qty: 1, price: 120 },
      { item: 'Bread 400g', qty: 2, price: 65 },
    ],
    extras: { cashier: 'Grace', payment_mode: 'Cash', mpesa_ref: '' },
  },
  retail: {
    number: '004512',
    discount: 0,
    paid: 1500,
    items: [
      { item: 'Sugar 2kg', qty: 2, price: 330 },
      { item: 'Cooking Oil 1L', qty: 1, price: 310 },
      { item: 'Bread 400g', qty: 3, price: 65 },
    ],
    extras: { payment_mode: 'Cash', mpesa_ref: 'QWE123RTY', served_by: 'Faith' },
  },
  wholesale: {
    number: 'INV-0231',
    customer: { name: 'Njeri Supplies', phone: '0712 000 000', pin: 'P051234567X', lpo: 'LPO-884' },
    items: [
      { code: 'RC-25', item: 'Rice 25kg bag', unit: 'Bag', qty: 20, price: 3100 },
      { code: 'SG-50', item: 'Sugar 50kg bag', unit: 'Bag', qty: 10, price: 6400 },
    ],
    extras: { payment_terms: '30 days', due_date: '14/12/2026' },
  },
  hardware: {
    number: 'CS-1180',
    customer: { name: 'Walk-in customer', phone: '0700 000 000' },
    items: [
      { code: 'CM-50', item: 'Cement 50kg', unit: 'Bag', qty: 10, price: 750 },
      { code: 'NL-4', item: 'Nails 4 inch', unit: 'Kg', qty: 5, price: 200 },
      { code: 'IS-30', item: 'Iron sheet gauge 30', unit: 'Pc', qty: 12, price: 780 },
    ],
    extras: { payment_mode: 'M-Pesa', served_by: 'Brian' },
  },
  electronics: {
    number: 'R-0907',
    customer: { name: 'Walk-in customer', phone: '0700 000 000' },
    items: [
      { item: 'Samsung Galaxy A15', serial: '356789012345678', warranty: '12 months', qty: 1, price: 19500 },
      { item: 'Fast charger 25W', serial: '-', warranty: '3 months', qty: 1, price: 1200 },
    ],
    extras: { payment_mode: 'M-Pesa', mpesa_ref: 'QWE123RTY', served_by: 'Mercy' },
  },
  logistics: {
    number: 'DN-0042',
    customer: { name: 'Mwangi Traders', address: 'Industrial Area, Nairobi', phone: '0711 000 000' },
    items: [
      { item: 'Cartons of soap', unit: 'Carton', qty: 40 },
      { item: 'Sacks of flour 24kg', unit: 'Sack', qty: 25 },
    ],
    extras: { vehicle_reg: 'KDA 123A', driver: 'Peter' },
  },
};

const DOC_LABEL = { receipt: 'Receipts', invoice: 'Invoices', delivery_note: 'Delivery notes' };
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
const box = { border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16 };
const row = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };

export default function TemplatePreview() {
  const [biz, setBiz] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [name, setName] = useState('');
  const [newExtra, setNewExtra] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load(pickId) {
    const b = await supabase
      .from('businesses')
      .select('id,name,address,phone,tax_pin,till_number,business_type,active_templates')
      .order('created_at', { ascending: true })
      .limit(1);
    if (b.error) return setError(b.error.message);
    const biz0 = b.data[0] || null;
    setBiz(biz0);

    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return setError(error.message);
    setError('');
    setTemplates(data || []);

    const mine = biz0 ? templateTypeFor(biz0.business_type || '') : '';
    const list = data || [];
    const found =
      list.find((t) => t.id === pickId) ||
      list.find((t) => t.business_type === mine) ||
      list[0];
    if (found) pick(found);
  }

  useEffect(() => {
    load();
  }, []);

  function pick(t) {
    setSelected(t);
    setDraft(JSON.parse(JSON.stringify(t.config)));
    setName(t.is_system ? t.name + ' (my copy)' : t.name);
    setMsg('');
  }

  function change(fn) {
    const next = JSON.parse(JSON.stringify(draft));
    fn(next);
    setDraft(next);
  }

  async function save() {
    setMsg('');
    setError('');
    if (!biz) return setError('Set up your business first (Business tab).');
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return setError('Please sign in again.');

    let savedId;
    if (selected.is_system) {
      const { data, error } = await supabase
        .from('templates')
        .insert({
          name,
          business_type: selected.business_type,
          doc_type: selected.doc_type,
          config: draft,
          is_system: false,
          owner_id: uid,
        })
        .select()
        .single();
      if (error) return setError(error.message);
      savedId = data.id;
    } else {
      const { error } = await supabase
        .from('templates')
        .update({ name, config: draft })
        .eq('id', selected.id);
      if (error) return setError(error.message);
      savedId = selected.id;
    }

    const next = { ...(biz.active_templates || {}), [selected.doc_type]: savedId };
    const up = await supabase.from('businesses').update({ active_templates: next }).eq('id', biz.id);
    if (up.error) return setError(up.error.message);

    setMsg('Saved. Your ' + DOC_LABEL[selected.doc_type].toLowerCase() + ' now use this template.');
    load(savedId);
  }

  async function remove() {
    if (!selected || selected.is_system) return;
    if (!window.confirm('Delete this template?')) return;
    const { error } = await supabase.from('templates').delete().eq('id', selected.id);
    if (error) return setError(error.message);
    if (biz && (biz.active_templates || {})[selected.doc_type] === selected.id) {
      const next = { ...biz.active_templates };
      delete next[selected.doc_type];
      await supabase.from('businesses').update({ active_templates: next }).eq('id', biz.id);
    }
    setMsg('Deleted.');
    load();
  }

  function addExtra() {
    const label = newExtra.trim();
    if (!label) return;
    change((c) => {
      c.extras = c.extras || [];
      c.extras.push({ key: slug(label), label, type: 'text', enabled: true });
    });
    setNewExtra('');
  }

  const active = (biz && biz.active_templates) || {};
  const myType = biz ? templateTypeFor(biz.business_type || '') : '';
  const isMine = (t) => !t.is_system || !myType || t.business_type === myType;
  const primary = templates.filter(isMine);
  const others = templates.filter((t) => !isMine(t));
  const preview = selected ? { ...selected, config: draft } : null;
  const sample = samples[selected?.business_type] || samples.retail;
  const previewBiz = biz
    ? {
        name: biz.name,
        address: biz.address,
        phone: biz.phone,
        kraPin: biz.tax_pin,
        till: biz.till_number,
      }
    : { name: 'Your Business', address: 'Nairobi, Kenya', phone: '07XX XXX XXX' };

  const tplButton = (t) => (
    <button
      key={t.id}
      type="button"
      onClick={() => pick(t)}
      style={{ fontWeight: selected?.id === t.id ? 700 : 400 }}
    >
      {t.name}
      {t.is_system ? '' : ' ★'}
      {Object.values(active).includes(t.id) ? ' ✓' : ''}
    </button>
  );

  return (
    <div>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {msg && <p style={{ color: 'green' }}>{msg}</p>}
      {!biz && <p>Set up your business first (Business tab) so you can save a template.</p>}

      {biz && (
        <div style={box}>
          <strong>Your documents use</strong>
          {['receipt', 'invoice', 'delivery_note'].map((k) => {
            const t = templates.find((x) => x.id === active[k]);
            return (
              <div key={k}>
                {DOC_LABEL[k]}: {t ? t.name : 'not set'}
              </div>
            );
          })}
        </div>
      )}

      <p>
        Pick a template, adjust it, then save. Saving makes it the template your documents use. ✓ means in
        use.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {primary.map(tplButton)}
      </div>
      {others.length > 0 && (
        <>
          <strong>More templates (invoices, delivery notes and others)</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
            {others.map(tplButton)}
          </div>
        </>
      )}

      {selected && draft && (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Customize</h3>

            <div style={row}>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div style={row}>
              <label>Title on document</label>
              <input
                value={draft.title || ''}
                onChange={(e) => change((c) => (c.title = e.target.value))}
              />
            </div>

            <div style={row}>
              <label>Layout</label>
              <select
                value={draft.layout || 'a4'}
                onChange={(e) => change((c) => (c.layout = e.target.value))}
              >
                <option value="thermal">Till roll (narrow)</option>
                <option value="a4">Full page (A4)</option>
              </select>
            </div>

            <div style={row}>
              <label>Accent colour</label>
              <input
                type="color"
                value={draft.accent || '#1f1f1f'}
                onChange={(e) => change((c) => (c.accent = e.target.value))}
              />
            </div>

            <div style={row}>
              <label>Footer</label>
              <input
                value={draft.footer || ''}
                onChange={(e) => change((c) => (c.footer = e.target.value))}
              />
            </div>

            <div style={row}>
              <label>Terms</label>
              <input
                value={draft.terms || ''}
                onChange={(e) => change((c) => (c.terms = e.target.value))}
              />
            </div>

            <strong>Header</strong>
            {[
              ['showLogo', 'Logo'],
              ['showAddress', 'Address'],
              ['showPhone', 'Phone'],
              ['showKraPin', 'KRA PIN'],
              ['showTill', 'Till number'],
            ].map(([k, l]) => (
              <div key={k} style={row}>
                <input
                  type="checkbox"
                  checked={!!draft.header?.[k]}
                  onChange={(e) =>
                    change((c) => {
                      c.header = c.header || {};
                      c.header[k] = e.target.checked;
                    })
                  }
                />
                <span>{l}</span>
              </div>
            ))}

            <strong>Columns</strong>
            {(draft.fields || []).map((f, i) => (
              <div key={f.key} style={row}>
                <input
                  type="checkbox"
                  checked={f.enabled !== false}
                  onChange={(e) => change((c) => (c.fields[i].enabled = e.target.checked))}
                />
                <input
                  value={f.label}
                  onChange={(e) => change((c) => (c.fields[i].label = e.target.value))}
                />
              </div>
            ))}

            <strong>Customer details</strong>
            {(draft.customer || []).map((x, i) => (
              <div key={x.key} style={row}>
                <input
                  type="checkbox"
                  checked={!!x.enabled}
                  onChange={(e) => change((c) => (c.customer[i].enabled = e.target.checked))}
                />
                <input
                  value={x.label}
                  onChange={(e) => change((c) => (c.customer[i].label = e.target.value))}
                />
              </div>
            ))}

            <strong>Totals</strong>
            {[
              ['showTax', 'VAT 16%'],
              ['showDiscount', 'Discount'],
              ['showChange', 'Cash and change'],
            ].map(([k, l]) => (
              <div key={k} style={row}>
                <input
                  type="checkbox"
                  checked={!!draft.totals?.[k]}
                  onChange={(e) =>
                    change((c) => {
                      c.totals = c.totals || {};
                      c.totals[k] = e.target.checked;
                    })
                  }
                />
                <span>{l}</span>
              </div>
            ))}

            <strong>Extra fields</strong>
            {(draft.extras || []).map((x, i) => (
              <div key={x.key} style={row}>
                <input
                  type="checkbox"
                  checked={!!x.enabled}
                  onChange={(e) => change((c) => (c.extras[i].enabled = e.target.checked))}
                />
                <input
                  value={x.label}
                  onChange={(e) => change((c) => (c.extras[i].label = e.target.value))}
                />
                <button type="button" onClick={() => change((c) => c.extras.splice(i, 1))}>
                  ✕
                </button>
              </div>
            ))}
            <div style={row}>
              <input
                placeholder="New field, e.g. Plot number"
                value={newExtra}
                onChange={(e) => setNewExtra(e.target.value)}
              />
              <button type="button" onClick={addExtra}>
                Add
              </button>
            </div>

            <div style={row}>
              <button type="button" onClick={save}>
                {selected.is_system ? 'Use this template' : 'Save changes'}
              </button>
              {!selected.is_system && (
                <button type="button" onClick={remove}>
                  Delete
                </button>
              )}
            </div>
          </div>

          <DocumentRenderer template={preview} business={previewBiz} data={sample} />
        </>
      )}
    </div>
  );
}