import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './document.css';

const BLUE = '#002ca0';
const HEX = /^#[0-9a-fA-F]{6}$/;
const MIN_ROWS = 6;

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function split(n) {
  const [w, c] = Number(n || 0).toFixed(2).split('.');
  return [Number(w).toLocaleString('en-KE'), c];
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-KE', {
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

export default function ReceiptDocument({ bizId, id, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const b = await supabase
        .from('businesses')
        .select('id,name,email,phone,address,tax_pin,currency,brand_color')
        .eq('id', bizId)
        .single();
      if (b.error) return !cancelled && setError(b.error.message);

      const p = await supabase.from('payments').select('*').eq('id', id).single();
      if (p.error) return !cancelled && setError(p.error.message);

      const [inv, all] = await Promise.all([
        supabase
          .from('documents')
          .select('doc_number,customer_name,customer_phone,total,currency')
          .eq('id', p.data.document_id)
          .single(),
        supabase
          .from('payments')
          .select('id,amount')
          .eq('document_id', p.data.document_id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      ]);
      if (inv.error) return !cancelled && setError(inv.error.message);
      if (all.error) return !cancelled && setError(all.error.message);

      let paidTo = 0;
      for (const row of all.data) {
        paidTo += Number(row.amount);
        if (row.id === id) break;
      }

      if (!cancelled) setData({ biz: b.data, pay: p.data, inv: inv.data, paidTo });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [bizId, id]);

  useEffect(() => {
    if (!data) return;
    const old = document.title;
    document.title = 'Receipt ' + data.pay.receipt_number;
    return () => {
      document.title = old;
    };
  }, [data]);

  if (error) {
    return (
      <div>
        <p className="notice error" role="alert">{error}</p>
        <button className="btn-ghost" type="button" onClick={onBack}>Back</button>
      </div>
    );
  }
  if (!data) return <p>Loading...</p>;

  const { biz, pay, inv, paidTo } = data;
  const color = HEX.test(biz.brand_color || '') ? biz.brand_color : BLUE;
  const cur = inv.currency || biz.currency;
  const unit = cur === 'KES' ? 'Kshs' : cur;
  const balance = Math.max(0, Number(inv.total) - paidTo);
  const blanks = Array.from({ length: MIN_ROWS });
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
          <span className="doc-pill">RECEIPT</span>
          <h2 className="doc-biz">{biz.name}</h2>
          {biz.address && <p className="doc-line">{biz.address}</p>}
          {contact && <p className="doc-line">{contact}</p>}
        </header>

        <section className="doc-boxes">
          <div className="doc-box">
            <div className="doc-row"><b>Received from:</b><span>{inv.customer_name}</span></div>
            <div className="doc-row"><b>Tel:</b><span>{inv.customer_phone}</span></div>
            <div className="doc-row"><b>Invoice No.</b><span>{inv.doc_number}</span></div>
          </div>
          <div className="doc-box">
            <div className="doc-row"><b>Date:</b><span>{fmtDate(pay.paid_at)}</span></div>
            <div className="doc-row"><b>Method:</b><span>{pay.method}</span></div>
            <div className="doc-row"><b>Reference:</b><span>{pay.reference}</span></div>
          </div>
        </section>

        <div className="doc-grid-wrap">
          {balance <= 0 && <span className="doc-stamp">Paid in full</span>}
          <table className="doc-grid">
            <colgroup>
              <col />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Description</th>
                <th>Method</th>
                <th>{unit}</th>
                <th>cts</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Payment for Invoice {inv.doc_number}</td>
                <td className="c">{pay.method}</td>
                <Amount value={pay.amount} />
              </tr>
              {blanks.map((_, i) => (
                <tr key={i}>
                  <td>&nbsp;</td>
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td>
                  No. <span className="no">{pay.receipt_number}</span>
                </td>
                <td className="lbl">TOTAL PAID</td>
                <Amount value={pay.amount} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="doc-extra">
          <div className="line">
            <span>Invoice total</span>
            <span>
              {cur} {money(inv.total)}
            </span>
          </div>
          <div className="line">
            <span>Paid to date</span>
            <span>{money(paidTo)}</span>
          </div>
          <div className="line strong">
            <span>Balance remaining</span>
            <span>{money(balance)}</span>
          </div>
        </div>

        <div className="doc-foot">Thank you for your payment.</div>
      </article>
    </div>
  );
}