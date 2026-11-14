import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import DocumentRenderer from './DocumentRenderer.jsx';

const sample = {
  number: '001',
  customer: 'Walk-in customer',
  discount: 0,
  items: [
    { item: 'Sample item', qty: 2, price: 500 },
    { item: 'Another item', qty: 1, price: 1200 },
  ],
  extras: {
    mpesa_ref: 'QWE123RTY',
    served_by: 'Jane',
    vehicle_plate: 'KDA 123A',
    mileage: '84,000 km',
    table_no: '5',
    received_by: 'John',
    driver: 'Peter',
  },
};

const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
const box = { border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16 };
const row = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };

export default function TemplatePreview() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [name, setName] = useState('');
  const [newExtra, setNewExtra] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load(pickId) {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return setError(error.message);
    setError('');
    setTemplates(data || []);
    const found = (data || []).find((t) => t.id === pickId) || (data || [])[0];
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
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return setError('Please sign in again.');
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
      setMsg('Saved as your template.');
      load(data.id);
    } else {
      const { error } = await supabase
        .from('templates')
        .update({ name, config: draft })
        .eq('id', selected.id);
      if (error) return setError(error.message);
      setMsg('Changes saved.');
      load(selected.id);
    }
  }

  async function remove() {
    if (!selected || selected.is_system) return;
    if (!window.confirm('Delete this template?')) return;
    const { error } = await supabase.from('templates').delete().eq('id', selected.id);
    if (error) return setError(error.message);
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

  const preview = selected ? { ...selected, config: draft } : null;

  return (
    <div>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {msg && <p style={{ color: 'green' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t)}
            style={{ fontWeight: selected?.id === t.id ? 700 : 400 }}
          >
            {t.name}
            {t.is_system ? '' : ' ★'}
          </button>
        ))}
      </div>

      {selected && draft && (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Customize</h3>

            <div style={row}>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div style={row}>
              <label>Accent colour</label>
              <input
                type="color"
                value={draft.accent || '#B8F34A'}
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

            <strong>Header</strong>
            {[
              ['showLogo', 'Logo'],
              ['showAddress', 'Address'],
              ['showPhone', 'Phone'],
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

            <strong>Totals</strong>
            {[
              ['showTax', 'VAT 16%'],
              ['showDiscount', 'Discount'],
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

            <strong>Column names</strong>
            {(draft.fields || []).map((f, i) => (
              <div key={f.key} style={row}>
                <input
                  value={f.label}
                  onChange={(e) => change((c) => (c.fields[i].label = e.target.value))}
                />
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
                <button
                  type="button"
                  onClick={() => change((c) => c.extras.splice(i, 1))}
                >
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
                {selected.is_system ? 'Save as my template' : 'Save changes'}
              </button>
              {!selected.is_system && (
                <button type="button" onClick={remove}>
                  Delete
                </button>
              )}
            </div>
          </div>

          <DocumentRenderer
            template={preview}
            business={{
              name: 'Your Business',
              address: 'Nairobi, Kenya',
              phone: '07XX XXX XXX',
            }}
            data={sample}
          />
        </>
      )}
    </div>
  );
}