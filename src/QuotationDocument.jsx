import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './document.css';

const BLUE = '#002ca0';
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

export default function QuotationDocument({ bizId, id, onBack }) {
  const [biz, setBiz] = useState(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from('businesses')
        .select('id,name,tagline,email,phone,address,tax_pin,currency,brand_color')
        .eq('id', bizId)
        .single(),
      supabase.from('documents').select('*').eq('id', id).single(),
    ]).then(([b, d]) => {
      if (cancelled) return;
      if (b.error) return setError(b.error.message);
      if (d.error) return setError(d.error.message);
      setBiz(b.data);
      setDoc(d.data);
    });
    return () => {
      cancelled = true;
    };
  }, [bizId, id]);

  useEffect(() => {
    if (!doc) return;
    const old = document.title;
    document.title = 'Quotation ' + doc.doc_number;
    return () => {
      document.title = old;
    };
  }, [doc]);

  if (error) {
    return (
      <div>
        <p className="notice error" role="alert">{error}</p>
        <button className="btn-ghost" type="button" onClick={onBack}>Back</button>
      </div>
    );
  }
  if (!biz || !doc) return <p>Loading...</p>;

  const color = HEX.test(biz.brand_color || '') ? biz.brand_color : BLUE;
  const cur = doc.currency || biz.currency;
  const unit = cur === 'KES' ? 'Kshs' : cur;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const blanks = Math.max(0, MIN_ROWS - items.length);
  const showExtra = Number(doc.discount) > 0 || Number(doc.tax) > 0;
  const stamp =
    doc.status === 'accepted'
      ? 'Accepted'
      : doc.status === 'declined'
      ? 'Declined'
      : doc.status === 'invoiced'
      ? 'Invoiced'
      : '';
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
          <span className="doc-pill">QUOTATION</span>
          <h2 className="doc-biz">{biz.name}</h2>
          {biz.tagline && <p className="doc-tag">{biz.tagline}</p>}
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
            <div className="doc-row"><b>Valid until:</b><span>{fmtDate(doc.due_date)}</span></div>
            <div className="doc-row"><b>Ref No.</b><span /></div>
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
          </div>
        )}

        {doc.notes && <p className="doc-notes">{doc.notes}</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            marginTop: 36,
          }}
        >
          {['Accepted by', 'Signature', 'Date'].map((l) => (
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

        <div className="doc-foot">
          {doc.due_date
            ? 'This quotation is valid until ' + fmtDate(doc.due_date)
            : 'Thank you for your enquiry'}
        </div>
      </article>
    </div>
  );
}