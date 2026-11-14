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
  extras: { mpesa_ref: 'QWE123RTY' },
};

export default function TemplatePreview() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('templates')
      .select('*')
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setTemplates(data || []);
        setSelected((data && data[0]) || null);
      });
  }, []);

  return (
    <div>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {templates.map((t) => (
          <button key={t.id} type="button" onClick={() => setSelected(t)}>
            {t.name}
          </button>
        ))}
      </div>
      {selected && (
        <DocumentRenderer
          template={selected}
          business={{ name: 'Your Business', address: 'Nairobi, Kenya', phone: '07XX XXX XXX' }}
          data={sample}
        />
      )}
    </div>
  );
}