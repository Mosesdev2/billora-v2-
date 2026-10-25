import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './document.css';

const BLUE = '#002ca0';
const HEX = /^#[0-9a-fA-F]{6}$/;
const MIN_ROWS = 10;

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DeliveryDocument({ bizId, id, onBack }) {
  const [biz, setBiz] = useState(null);
  const [note, setNote] = useState(null);
  const [invNo, setInvNo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from('businesses')
        .select('id,name,email,phone,address,tax_pin,currency,brand_color')
        .eq('id', bizId)
        .single(),
      supabase.from('delivery_notes').select('*').eq('id', id).single(),
    ]).then(async ([b, n]) => {
      if (cancelled) return;
      if (b.error) return setError(b.error.message);
      if (n.error) return setError(n.error.message);
      let num = '';
      if (n.data.invoice_id) {
        const inv = await supabase
          .from('documents')
          .select('doc_number')
          .eq('id', n.data.invoice_id)
          .maybeSingle();
        if (!inv.error && inv.data) num = inv.data.doc_number;
      }
      if (cancelled) return;
      setBiz(b.data);
      setNote(n.data);
      setInvNo(num);
    });
    return () => {
      cancelled = true;
    };
  }, [bizId, id]);

  useEffect(() => {
    if (!note) return;
    const old = document.title;
    document.title = 'Delivery note ' + note.note_number;
    return () => {
      document.title = old;
    };
  }, [note]);

  if (error) {
    return (
      <div>
        <p className="notice error" role="alert">{error}</p>
        <button className="btn-ghost" type="button" onClick={onBack}>Back</button>
      </div>
    );
  }
  if (!biz || !note) return <p>Loading...</p>;

  const color = HEX.test(biz.brand_color || '') ? biz.brand_color : BLUE;
  const items = Array.isArray(note.items) ? note.items : [];
  const blanks = Math.max(0, MIN_ROWS - items.length);
  const fee = Number(note.delivery_fee);
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
          <span className="doc-pill">DELIVERY NOTE</span>
          <h2 className="doc-biz">{biz.name}</h2>
          {biz.address && <p className="doc-line">{biz.address}</p>}
          {contact && <p className="doc-line">{contact}</p>}
        </header>

        <section className="doc-boxes">
          <div className="doc-box">
            <div className="doc-row"><b>Ms:</b><span>{note.customer_name}</span></div>
            <div className="doc-row"><b>Tel:</b><span>{note.customer_phone}</span></div>
            <div className="doc-row"><b>Deliver to:</b><span>{note.delivery_address}</span></div>
          </div>
          <div className="doc-box">
            <div className="doc-row"><b>Date:</b><span>{fmtDate(note.issue_date)}</span></div>
            <div className="doc-row"><b>Invoice No.</b><span>{invNo}</span></div>
            <div className="doc-row"><b>Expected:</b><span>{fmtDate(note.expected_date)}</span></div>
          </div>
        </section>

        <div className="doc-grid-wrap">
          <table className="doc-grid">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Qty</th>
                <th>Description of goods</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="c">{it.qty}</td>
                  <td>{it.description}</td>
                </tr>
              ))}
              {Array.from({ length: blanks }).map((_, i) => (
                <tr key={'b' + i}>
                  <td>&nbsp;</td>
                  <td />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td className="small">No.</td>
                <td>
                  <span className="no">{note.note_number}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {fee > 0 && (
          <div className="doc-extra">
            <div className="line strong">
              <span>Delivery fee</span>
              <span>
                {biz.currency} {money(fee)}
              </span>
            </div>
          </div>
        )}

        {note.instructions && (
          <p className="doc-notes">
            <b>Delivery instructions:</b> {note.instructions}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            marginTop: 40,
          }}
        >
          {['Received by', 'Signature', 'Date'].map((l) => (
            <div
              key={l}
              style={{
                paddingTop: 4,
                fontSize: 12,
                color: 'var(--ink)',
                borderTop: '1px solid var(--ink)',
              }}
            >
              {l}
            </div>
          ))}
        </div>

        <div className="doc-foot">Goods received in good order and condition.</div>
      </article>
    </div>
  );
}