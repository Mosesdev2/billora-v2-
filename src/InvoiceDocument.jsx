import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './document.css';

const SWATCHES = ['#171914', '#1b7f4b', '#1f4fd8', '#c0392b', '#6b3fa0', '#d9730d'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ink(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#171914' : '#ffffff';
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function InvoiceDocument({ bizId, id, onBack }) {
  const [biz, setBiz] = useState(null);
  const [doc, setDoc] = useState(null);
  const [color, setColor] = useState('#171914');
  const [savedColor, setSavedColor] = useState('#171914');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from('businesses')
        .select('id,name,email,phone,address,tax_pin,currency,brand_color')
        .eq('id', bizId)
        .single(),
      supabase.from('documents').select('*').eq('id', id).single(),
    ]).then(([b, d]) => {
      if (cancelled) return;
      if (b.error) return setError(b.error.message);
      if (d.error) return setError(d.error.message);
      setBiz(b.data);
      setDoc(d.data);
      const c = HEX.test(b.data.brand_color || '') ? b.data.brand_color : '#171914';
      setColor(c);
      setSavedColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [bizId, id]);

  useEffect(() => {
    if (!doc) return;
    const old = document.title;
    document.title = 'Invoice ' + doc.doc_number;
    return () => {
      document.title = old;
    };
  }, [doc]);

  async function saveColor() {
    if (saving || !HEX.test(color)) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('businesses')
      .update({ brand_color: color })
      .eq('id', bizId);
    if (err) setError(err.message);
    else setSavedColor(color);
    setSaving(false);
  }

  if (error) {
    return (
      <div>
        <p className="notice error" role="alert">{error}</p>
        <button className="btn-ghost" type="button" onClick={onBack}>Back</button>
      </div>
    );
  }
  if (!biz || !doc) return <p>Loading...</p>;

  const cur = doc.currency || biz.currency;
  const balance = Number(doc.total) - Number(doc.amount_paid);
  const items = Array.isArray(doc.items) ? doc.items : [];
  const stamp = doc.status === 'paid' ? 'Paid' : doc.status === 'cancelled' ? 'Cancelled' : '';
  const contact = [biz.phone, biz.email].filter(Boolean).join('  |  ');

  return (
    <div className="doc-wrap">
      <div className="doc-bar no-print">
        <button className="btn-ghost small" type="button" onClick={onBack}>Back</button>
        <div className="swatches">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={'Use colour ' + c}
              className={c === color ? 'swatch on' : 'swatch'}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Pick a custom colour"
          />
        </div>
        {color !== savedColor && (
          <button className="btn-ghost small" type="button" disabled={saving} onClick={saveColor}>
            {saving ? 'Saving...' : 'Save colour'}
          </button>
        )}
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }} type="button" onClick={() => window.print()}>
          Download PDF
        </button>
      </div>

      <article className="doc-sheet" style={{ '--accent': color, '--on-accent': ink(color) }}>
        <header className="doc-head">
          <div>
            <h2 className="doc-biz">{biz.name}</h2>
            {biz.address && <p className="doc-small">{biz.address}</p>}
            {contact && <p className="doc-small">{contact}</p>}
            {biz.tax_pin && <p className="doc-small">KRA PIN: {biz.tax_pin}</p>}
          </div>
          <div className="doc-title">
            <strong>INVOICE</strong>
            <span>{doc.doc_number}</span>
            {stamp && <span className="doc-stamp">{stamp}</span>}
          </div>
        </header>

        <div className="doc-body">
          <section className="doc-meta">
            <div>
              <h4>Bill to</h4>
              <p><strong>{doc.customer_name}</strong></p>
              {doc.customer_phone && <p>{doc.customer_phone}</p>}
              {doc.customer_email && <p>{doc.customer_email}</p>}
            </div>
            <div>
              <h4>Issued</h4>
              <p>{fmtDate(doc.issue_date)}</p>
            </div>
            <div>
              <h4>Due</h4>
              <p>{fmtDate(doc.due_date)}</p>
            </div>
          </section>

          <table className="doc-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.description}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{money(it.price)}</td>
                  <td className="num">{money(it.amount ?? it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="doc-totals">
            <div className="line"><span>Subtotal</span><span>{money(doc.subtotal)}</span></div>
            {Number(doc.discount) > 0 && (
              <div className="line"><span>Discount</span><span>- {money(doc.discount)}</span></div>
            )}
            <div className="line"><span>Tax</span><span>{money(doc.tax)}</span></div>
            <div className="line"><span>Total</span><span>{cur} {money(doc.total)}</span></div>
            <div className="line"><span>Amount paid</span><span>{money(doc.amount_paid)}</span></div>
            <div className="line grand"><span>Balance due</span><span>{cur} {money(balance)}</span></div>
          </div>

          {doc.notes && <p className="doc-notes">{doc.notes}</p>}
        </div>

        <footer className="doc-foot">Thank you for your business.</footer>
      </article>
    </div>
  );
}