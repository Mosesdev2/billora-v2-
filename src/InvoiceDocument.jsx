import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './document.css';

const BLUE = '#002ca0';
const COLORS = [
  { name: 'Blue', hex: BLUE },
  { name: 'Red', hex: '#c0201f' },
  { name: 'Green', hex: '#1b7f4b' },
  { name: 'Black', hex: '#171914' },
];
const HEX = /^#[0-9a-fA-F]{6}$/;
const MIN_ROWS = 10;

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function split(n) {
  const [w, c] = Number(n || 0).toFixed(2).split('.');
  return [Number(w).toLocaleString('en-KE'), c];
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Amount({ value }) {
  const [w, c] = split(value);
  return (
    <>
      <td className="r">{w}</td>
      <td className="c">{c}</td>
    </>
  );
}

export default function InvoiceDocument({ bizId, id, onBack }) {
  const [biz, setBiz] = useState(null);
  const [doc, setDoc] = useState(null);
  const [deliveryNos, setDeliveryNos] = useState('');
  const [color, setColor] = useState(BLUE);
  const [savedColor, setSavedColor] = useState(BLUE);
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
      supabase
        .from('delivery_notes')
        .select('note_number')
        .eq('invoice_id', id)
        .order('created_at', { ascending: true }),
    ]).then(([b, d, n]) => {
      if (cancelled) return;
      if (b.error) return setError(b.error.message);
      if (d.error) return setError(d.error.message);
      setBiz(b.data);
      setDoc(d.data);
      if (!n.error && n.data) {
        setDeliveryNos(n.data.map((x) => x.note_number).join(', '));
      }
      const c = HEX.test(b.data.brand_color || '') ? b.data.brand_color : BLUE;
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
  const unit = cur === 'KES' ? 'Kshs' : cur;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const blanks = Math.max(0, MIN_ROWS - items.length);
  const balance = Number(doc.total) - Number(doc.amount_paid);
  const showExtra =
    Number(doc.discount) > 0 || Number(doc.tax) > 0 || Number(doc.amount_paid) > 0;
  const stamp = doc.status === 'paid' ? 'Paid' : doc.status === 'cancelled' ? 'Cancelled' : '';
  const contact = [
    biz.phone && 'Cell: ' + biz.phone,
    biz.email && 'Email: ' + biz.email,
    biz.tax_pin && 'PIN: ' + biz.tax_pin,
  ]
    .filter(Boolean)
    .join('   ');

  return (
    <div className="doc-wrap">
      <div className="doc-bar no-print">
        <button className="btn-ghost small" type="button" onClick={onBack}>Back</button>
        <div className="chips">
          {COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={c.hex === color ? 'chip on' : 'chip'}
              onClick={() => setColor(c.hex)}
            >
              <i style={{ background: c.hex }} />
              {c.name}
            </button>
          ))}
        </div>
        {color !== savedColor && (
          <button className="btn-ghost small" type="button" disabled={saving} onClick={saveColor}>
            {saving ? 'Saving...' : 'Save colour'}
          </button>
        )}
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 16px' }}
          type="button"
          onClick={() => window.print()}
        >
          Download PDF
        </button>
      </div>

      <article className="doc-sheet" style={{ '--ink': color }}>
        <header className="doc-head">
          <span className="doc-pill">INVOICE</span>
          <h2 className="doc-biz">{biz.name}</h2>
          {biz.address && <p className="doc-line">{biz.address}</p>}
          {contact && <p className="doc-line">{contact}</p>}
        </header>

        <section className="doc-boxes">
          <div className="doc-box">
            <div className="doc-row"><b>Ms:</b><span>{doc.customer_name}</span></div>
            <div className="doc-row"><span>{doc.customer_phone}</span></div>
            <div className="doc-row"><span>{doc.customer_email}</span></div>
          </div>
          <div className="doc-box">
            <div className="doc-row"><b>Date:</b><span>{fmtDate(doc.issue_date)}</span></div>
            <div className="doc-row"><b>Delivery No.</b><span>{deliveryNos}</span></div>
            <div className="doc-row"><b>L.P.O No.</b><span /></div>
          </div>
        </section>

        <div className="doc-grid-wrap">
          {stamp && <span className="doc-stamp">{stamp}</span>}
          <table className="doc-grid">
            <colgroup>
              <col style={{ width: '11%' }} />
              <col />
              <col style={{ width: '17%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Qty</th>
                <th>Description</th>
                <th>Unit Price</th>
                <th>{unit}</th>
                <th>cts</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="c">{it.qty}</td>
                  <td>{it.description}</td>
                  <td className="r">{money(it.price)}</td>
                  <Amount value={it.amount ?? it.qty * it.price} />
                </tr>
              ))}
              {Array.from({ length: blanks }).map((_, i) => (
                <tr key={'b' + i}>
                  <td>&nbsp;</td>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td className="small">E.&amp;O.E</td>
                <td>
                  No. <span className="no">{doc.doc_number}</span>
                </td>
                <td className="lbl">TOTAL</td>
                <Amount value={doc.total} />
              </tr>
            </tfoot>
          </table>
        </div>

        {showExtra && (
          <div className="doc-extra">
            <div className="line">
              <span>Subtotal</span>
              <span>{money(doc.subtotal)}</span>
            </div>
            {Number(doc.discount) > 0 && (
              <div className="line">
                <span>Discount</span>
                <span>- {money(doc.discount)}</span>
              </div>
            )}
            {Number(doc.tax) > 0 && (
              <div className="line">
                <span>Tax</span>
                <span>{money(doc.tax)}</span>
              </div>
            )}
            {Number(doc.amount_paid) > 0 && (
              <>
                <div className="line">
                  <span>Amount paid</span>
                  <span>{money(doc.amount_paid)}</span>
                </div>
                <div className="line strong">
                  <span>Balance</span>
                  <span>{money(balance)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {doc.notes && <p className="doc-notes">{doc.notes}</p>}

        <div className="doc-foot">Accounts are due on Demand</div>
      </article>
    </div>
  );
}