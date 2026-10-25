import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './business.css';
import './invoices.css';
import ReceiptDocument from './ReceiptDocument.jsx';

const PAGE = 20;
const METHODS = ['M-Pesa', 'Cash', 'Bank transfer', 'Card', 'Other'];

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export default function Payments() {
  const [biz, setBiz] = useState(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [view, setView] = useState('list');
  const [payId, setPayId] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from('businesses')
      .select('id,currency')
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (error) setMsg({ type: 'error', text: error.message });
        else if (data.length) setBiz(data[0]);
        setReady(true);
      });
  }, []);

  const load = useCallback(async () => {
    if (!biz) return;
    const { data, error, count: total } = await supabase
      .from('payments')
      .select('id,receipt_number,amount,method,paid_at,documents(doc_number,customer_name)', {
        count: 'exact',
      })
      .eq('business_id', biz.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setRows(data);
      setCount(total || 0);
    }
  }, [biz, page]);

  useEffect(() => {
    if (view === 'list') load();
  }, [load, view]);

  if (!ready) return <p>Loading...</p>;
  if (!biz) return <p>Create your business profile first (Business tab), then record payments here.</p>;

  if (view === 'doc') {
    return <ReceiptDocument bizId={biz.id} id={payId} onBack={() => setView('list')} />;
  }

  if (view === 'form') {
    return (
      <PaymentForm
        biz={biz}
        onCancel={() => setView('list')}
        onDone={(id) => {
          setPayId(id);
          setView('doc');
        }}
      />
    );
  }

  const lastPage = Math.max(0, Math.ceil(count / PAGE) - 1);

  return (
    <div>
      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      <button
        className="btn-primary"
        type="button"
        style={{ marginBottom: 16 }}
        onClick={() => {
          setMsg(null);
          setView('form');
        }}
      >
        Record payment
      </button>

      {rows.length === 0 ? (
        <p>No payments yet.</p>
      ) : (
        <ul className="inv-list">
          {rows.map((r) => (
            <li key={r.id} className="inv-li">
              <button
                type="button"
                className="inv-row"
                onClick={() => {
                  setPayId(r.id);
                  setView('doc');
                }}
              >
                <span className="inv-main">
                  <strong>Receipt {r.receipt_number}</strong>
                  <span>
                    {r.documents ? r.documents.customer_name + ' · Invoice ' + r.documents.doc_number : ''}
                    {' · '}
                    {r.method}
                  </span>
                </span>
                <span className="inv-side">
                  <strong>
                    {biz.currency} {money(r.amount)}
                  </strong>
                  <em className="badge">{fmt(r.paid_at)}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {count > PAGE && (
        <div className="pager">
          <button
            type="button"
            className="btn-ghost small"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            className="btn-ghost small"
            disabled={page >= lastPage}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentForm({ biz, onDone, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('M-Pesa');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('documents')
      .select('id,doc_number,customer_name,total,amount_paid')
      .eq('business_id', biz.id)
      .eq('doc_type', 'invoice')
      .in('status', ['unpaid', 'partial'])
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setMsg({ type: 'error', text: error.message });
        else setInvoices(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [biz.id]);

  const inv = invoices.find((i) => i.id === invoiceId);
  const balance = inv ? round2(Number(inv.total) - Number(inv.amount_paid)) : 0;

  function pickInvoice(id) {
    setInvoiceId(id);
    const i = invoices.find((x) => x.id === id);
    setAmount(i ? String(round2(Number(i.total) - Number(i.amount_paid))) : '');
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    if (!inv) return setMsg({ type: 'error', text: 'Choose an invoice.' });
    const amt = round2(amount);
    if (!(amt > 0)) return setMsg({ type: 'error', text: 'Enter an amount above zero.' });
    if (amt > balance) {
      return setMsg({ type: 'error', text: 'Amount is more than the balance of ' + money(balance) + '.' });
    }
    if (date > today()) return setMsg({ type: 'error', text: 'The date cannot be in the future.' });

    setBusy(true);
    setMsg(null);

    const paidAt = date === today() ? new Date().toISOString() : new Date(date + 'T12:00:00').toISOString();

    const { data, error } = await supabase.rpc('record_payment', {
      p_document: inv.id,
      p_amount: amt,
      p_method: method,
      p_reference: reference.trim(),
      p_paid_at: paidAt,
    });

    if (error) {
      setMsg({ type: 'error', text: error.message });
      setBusy(false);
    } else {
      onDone(data);
    }
  }

  if (loading) return <p>Loading...</p>;

  if (invoices.length === 0) {
    return (
      <div>
        {msg && (
          <p className="notice error" role="alert">
            {msg.text}
          </p>
        )}
        <p>No unpaid invoices to record a payment against.</p>
        <button className="btn-ghost" type="button" onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <h2>Record payment</h2>

      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      <label>
        <span>Invoice</span>
        <select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)} required>
          <option value="">Choose an invoice</option>
          {invoices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.doc_number} · {i.customer_name}
            </option>
          ))}
        </select>
      </label>

      {inv && (
        <p>
          Invoice total {biz.currency} {money(inv.total)} · Paid {money(inv.amount_paid)} ·{' '}
          <strong>Balance {money(balance)}</strong>
        </p>
      )}

      <div className="row">
        <label>
          <span>Amount ({biz.currency})</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>Reference (optional)</span>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={60}
          placeholder="e.g. M-Pesa code"
        />
      </label>

      <label>
        <span>Date paid</span>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : 'Record payment'}
      </button>
      <button className="btn-ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}