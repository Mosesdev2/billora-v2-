import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './document.css';
import './blank.css';

const BLUE = '#002ca0';
const COLORS = [
  { name: 'Blue', hex: BLUE },
  { name: 'Red', hex: '#c0201f' },
  { name: 'Green', hex: '#1b7f4b' },
  { name: 'Black', hex: '#171914' },
];
const HEX = /^#[0-9a-fA-F]{6}$/;

const KINDS = [
  { id: 'invoice', label: 'Invoice', title: 'INVOICE', rows: 10 },
  { id: 'receipt', label: 'Receipt', title: 'RECEIPT', rows: 7 },
  { id: 'delivery', label: 'Delivery note', title: 'DELIVERY NOTE', rows: 10 },
];

function emptyRows(n, cols) {
  return Array.from({ length: n }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}>&nbsp;</td>
      ))}
    </tr>
  ));
}

export default function BlankForms() {
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('invoice');
  const [number, setNumber] = useState('');
  const [showBiz, setShowBiz] = useState(true);
  const [color, setColor] = useState(BLUE);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('businesses')
      .select('name,email,phone,address,tax_pin,currency,brand_color')
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else if (data.length) {
          setBiz(data[0]);
          if (HEX.test(data[0].brand_color || '')) setColor(data[0].brand_color);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const k = KINDS.find((x) => x.id === kind);

  useEffect(() => {
    const old = document.title;
    document.title = 'Blank ' + k.label.toLowerCase();
    return () => {
      document.title = old;
    };
  }, [k]);

  if (loading) return <p>Loading...</p>;
  if (error) {
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  }

  const cur = biz ? biz.currency : 'KES';
  const unit = cur === 'KES' ? 'Kshs' : cur;
  const contact = biz
    ? [
        biz.phone && 'Cell: ' + biz.phone,
        biz.email && 'Email: ' + biz.email,
        biz.tax_pin && 'PIN: ' + biz.tax_pin,
      ]
        .filter(Boolean)
        .join('   ')
    : '';
  const no = number.trim();

  return (
    <div className="doc-wrap blank">
      <div className="doc-bar no-print">
        <div className="chips">
          {KINDS.map((x) => (
            <button
              key={x.id}
              type="button"
              className={x.id === kind ? 'chip on' : 'chip'}
              onClick={() => setKind(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="blank-opts no-print">
        <label className="num">
          <span>Number (optional)</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={12}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Leave empty"
          />
        </label>
        <label className="blank-check">
          <input type="checkbox" checked={showBiz} onChange={(e) => setShowBiz(e.target.checked)} />
          Include my business name and address
        </label>
      </div>

      <div className="doc-bar no-print">
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
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 16px' }}
          type="button"
          onClick={() => window.print()}
        >
          Download PDF
        </button>
      </div>

      <p className="blank-tip no-print">
        Tap Download PDF, then choose Save as PDF in the print screen. Nothing on this page is
        saved in Billora.
      </p>

      <article className="doc-sheet" style={{ '--ink': color }}>
        <header className="doc-head">
          <span className="doc-pill">{k.title}</span>
          {showBiz && biz && (
            <>
              <h2 className="doc-biz">{biz.name}</h2>
              {biz.address && <p className="doc-line">{biz.address}</p>}
              {contact && <p className="doc-line">{contact}</p>}
            </>
          )}
        </header>

        {kind === 'invoice' && (
          <>
            <section className="doc-boxes">
              <div className="doc-box">
                <div className="doc-row"><b>Ms:</b><span /></div>
                <div className="doc-row"><span /></div>
                <div className="doc-row"><span /></div>
              </div>
              <div className="doc-box">
                <div className="doc-row"><b>Date:</b><span /></div>
                <div className="doc-row"><b>Delivery No.</b><span /></div>
                <div className="doc-row"><b>L.P.O No.</b><span /></div>
              </div>
            </section>

            <div className="doc-grid-wrap">
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
                <tbody>{emptyRows(k.rows, 5)}</tbody>
                <tfoot>
                  <tr className="total">
                    <td className="small">E.&amp;O.E</td>
                    <td>
                      No. <span className="no">{no}</span>
                    </td>
                    <td className="lbl">TOTAL</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="doc-foot">Accounts are due on Demand</div>
          </>
        )}

        {kind === 'receipt' && (
          <>
            <section className="doc-boxes">
              <div className="doc-box">
                <div className="doc-row"><b>Received from:</b><span /></div>
                <div className="doc-row"><b>Tel:</b><span /></div>
                <div className="doc-row"><b>Invoice No.</b><span /></div>
              </div>
              <div className="doc-box">
                <div className="doc-row"><b>Date:</b><span /></div>
                <div className="doc-row"><b>Method:</b><span /></div>
                <div className="doc-row"><b>Reference:</b><span /></div>
              </div>
            </section>

            <div className="doc-grid-wrap">
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
                <tbody>{emptyRows(k.rows, 4)}</tbody>
                <tfoot>
                  <tr className="total">
                    <td>
                      No. <span className="no">{no}</span>
                    </td>
                    <td className="lbl">TOTAL PAID</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="doc-foot">Thank you for your payment.</div>
          </>
        )}

        {kind === 'delivery' && (
          <>
            <section className="doc-boxes">
              <div className="doc-box">
                <div className="doc-row"><b>Ms:</b><span /></div>
                <div className="doc-row"><b>Tel:</b><span /></div>
                <div className="doc-row"><b>Deliver to:</b><span /></div>
              </div>
              <div className="doc-box">
                <div className="doc-row"><b>Date:</b><span /></div>
                <div className="doc-row"><b>Invoice No.</b><span /></div>
                <div className="doc-row"><b>Expected:</b><span /></div>
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
                <tbody>{emptyRows(k.rows, 2)}</tbody>
                <tfoot>
                  <tr className="total">
                    <td className="small">No.</td>
                    <td>
                      <span className="no">{no}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

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
          </>
        )}
      </article>
    </div>
  );
}