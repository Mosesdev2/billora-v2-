import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import './business.css';
import './invoices.css';

const PAGE = 20;

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const blankItem = () => ({
  key: Math.random().toString(36).slice(2),
  description: '',
  qty: '1',
  price: '',
});

function computeStatus(total, paid, current) {
  if (current === 'cancelled') return current;
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

function label(r) {
  if (r.status === 'paid' || r.status === 'cancelled') return r.status;
  if (r.due_date && r.due_date < today()) return 'overdue';
  return r.status;
}

export default function Invoices() {
  const [biz, setBiz] = useState(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
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
      .from('documents')
      .select('id,doc_number,customer_name,total,amount_paid,status,due_date', { count: 'exact' })
      .eq('business_id', biz.id)
      .eq('doc_type', 'invoice')
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
  if (!biz) return <p>Create your business profile first (Business tab), then create invoices here.</p>;

  if (view === 'form') {
    return (
      <InvoiceForm
        biz={biz}
        editId={editId}
        onDone={() => setView('list')}
        onCancel={() => setView('list')}
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
          setEditId(null);
          setMsg(null);
          setView('form');
        }}
      >
        New invoice
      </button>

      {rows.length === 0 ? (
        <p>No invoices yet.</p>
      ) : (
        <ul className="inv-list">
          {rows.map((r) => {
            const l = label(r);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="inv-row"
                  onClick={() => {
                    setEditId(r.id);
                    setMsg(null);
                    setView('form');
                  }}
                >
                  <span className="inv-main">
                    <strong>{r.doc_number}</strong>
                    <span>
                      {r.customer_name}
                      {r.due_date ? ' · due ' + r.due_date : ''}
                    </span>
                  </span>
                  <span className="inv-side">
                    <strong>
                      {biz.currency} {money(r.total)}
                    </strong>
                    <em className={'badge ' + l}>{l}</em>
                  </span>
                </button>
              </li>
            );
          })}
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

function InvoiceForm({ biz, editId, onDone, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [existing, setExisting] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const custQ = supabase
        .from('customers')
        .select('id,name,phone,email')
        .eq('business_id', biz.id)
        .order('name')
        .limit(500);
      const docQ = editId ? supabase.from('documents').select('*').eq('id', editId).single() : null;
      const [c, d] = await Promise.all([custQ, docQ]);
      if (cancelled) return;

      if (c.error) setMsg({ type: 'error', text: c.error.message });
      else setCustomers(c.data);

      if (d) {
        if (d.error) setMsg({ type: 'error', text: d.error.message });
        else {
          const r = d.data;
          setExisting({
            doc_number: r.doc_number,
            amount_paid: Number(r.amount_paid),
            status: r.status,
          });
          setCustomerId(r.customer_id || '');
          setName(r.customer_name || '');
          setPhone(r.customer_phone || '');
          setEmail(r.customer_email || '');
          setIssueDate(r.issue_date);
          setDueDate(r.due_date || '');
          setNotes(r.notes || '');
          setDiscount(String(r.discount ?? 0));
          const base = Number(r.subtotal) - Number(r.discount);
          setTaxRate(base > 0 ? String(round2((Number(r.tax) / base) * 100)) : '0');
          const loaded = (r.items || []).map((it) => ({
            key: Math.random().toString(36).slice(2),
            description: it.description || '',
            qty: String(it.qty ?? 1),
            price: String(it.price ?? ''),
          }));
          setItems(loaded.length ? loaded : [blankItem()]);
        }
      }
      setLoading(false);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [biz.id, editId]);

  const totals = useMemo(() => {
    const sub = round2(
      items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    );
    const disc = Math.max(0, Number(discount) || 0);
    const base = Math.max(0, round2(sub - disc));
    const rate = Math.min(100, Math.max(0, Number(taxRate) || 0));
    const tax = round2((base * rate) / 100);
    return { sub, disc, tax, total: round2(base + tax) };
  }, [items, discount, taxRate]);

  function pickCustomer(id) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setName(c.name || '');
      setPhone(c.phone || '');
      setEmail(c.email || '');
    }
  }

  function setItem(key, field, value) {
    setItems(items.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;

    const cleanName = name.trim();
    if (!cleanName) return setMsg({ type: 'error', text: 'Enter the customer name.' });

    const lines = [];
    for (const it of items) {
      const desc = it.description.trim();
      if (!desc) {
        if (it.price) return setMsg({ type: 'error', text: 'Add a description for every item.' });
        continue;
      }
      const qty = Number(it.qty);
      const price = Number(it.price || 0);
      if (!(qty > 0)) return setMsg({ type: 'error', text: 'Quantity must be more than zero.' });
      if (!(price >= 0)) return setMsg({ type: 'error', text: 'Price cannot be negative.' });
      lines.push({ description: desc, qty, price, amount: round2(qty * price) });
    }
    if (!lines.length) return setMsg({ type: 'error', text: 'Add at least one item.' });
    if (totals.disc > totals.sub)
      return setMsg({ type: 'error', text: 'Discount cannot be more than the subtotal.' });
    if (Number(taxRate) < 0 || Number(taxRate) > 100)
      return setMsg({ type: 'error', text: 'Tax rate must be between 0 and 100.' });
    if (dueDate && dueDate < issueDate)
      return setMsg({ type: 'error', text: 'Due date cannot be before the issue date.' });
    if (existing && totals.total < existing.amount_paid)
      return setMsg({ type: 'error', text: 'Total cannot be less than the amount already paid.' });

    setBusy(true);
    setMsg(null);

    const paid = existing ? existing.amount_paid : 0;
    const body = {
      customer_id: customerId || null,
      customer_name: cleanName,
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      issue_date: issueDate,
      due_date: dueDate || null,
      currency: biz.currency,
      subtotal: totals.sub,
      tax: totals.tax,
      discount: totals.disc,
      total: totals.total,
      notes: notes.trim(),
      items: lines,
      status: computeStatus(totals.total, paid, existing ? existing.status : 'unpaid'),
    };

    let error = null;
    if (editId) {
      ({ error } = await supabase.from('documents').update(body).eq('id', editId));
    } else {
      for (let i = 0; i < 3; i++) {
        const num = await supabase.rpc('next_doc_number', {
          p_business: biz.id,
          p_type: 'invoice',
        });
        if (num.error) {
          error = num.error;
          break;
        }
        ({ error } = await supabase.from('documents').insert({
          ...body,
          business_id: biz.id,
          doc_type: 'invoice',
          doc_number: num.data,
          amount_paid: 0,
        }));
        if (!error || error.code !== '23505') break;
      }
    }

    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else onDone();
  }

  if (loading) return <p>Loading...</p>;

  return (
    <form className="biz-form inv-form" onSubmit={save}>
      <h2>{editId ? 'Edit ' + (existing ? existing.doc_number : 'invoice') : 'New invoice'}</h2>

      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      <label>
        <span>Saved customer (optional)</span>
        <select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
          <option value="">Type details below</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Customer name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </label>

      <div className="row">
        <label>
          <span>Phone</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>

      <div className="row">
        <label>
          <span>Issue date</span>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
        </label>
        <label>
          <span>Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>

      <h2 style={{ marginTop: 24 }}>Items</h2>
      {items.map((it, i) => (
        <div className="inv-item-card" key={it.key}>
          <label>
            <span>Description</span>
            <input
              value={it.description}
              onChange={(e) => setItem(it.key, 'description', e.target.value)}
              placeholder={'Item ' + (i + 1)}
            />
          </label>
          <div className="row">
            <label>
              <span>Quantity</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={it.qty}
                onChange={(e) => setItem(it.key, 'qty', e.target.value)}
              />
            </label>
            <label>
              <span>Unit price ({biz.currency})</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={it.price}
                onChange={(e) => setItem(it.key, 'price', e.target.value)}
              />
            </label>
          </div>
          <div className="inv-item-foot">
            <span>
              Amount:{' '}
              <strong>
                {money((Number(it.qty) || 0) * (Number(it.price) || 0))}
              </strong>
            </span>
            {items.length > 1 && (
              <button
                type="button"
                className="btn-ghost small"
                onClick={() => setItems(items.filter((x) => x.key !== it.key))}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setItems([...items, blankItem()])}
      >
        Add item
      </button>

      <div className="totals">
        <div className="inputs">
          <label>
            <span>Discount ({biz.currency})</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </label>
          <label>
            <span>Tax rate (%)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </label>
        </div>
        <div className="line">
          <span>Subtotal</span>
          <span>{money(totals.sub)}</span>
        </div>
        <div className="line">
          <span>Discount</span>
          <span>- {money(totals.disc)}</span>
        </div>
        <div className="line">
          <span>Tax</span>
          <span>{money(totals.tax)}</span>
        </div>
        <div className="line grand">
          <span>Total</span>
          <span>
            {biz.currency} {money(totals.total)}
          </span>
        </div>
        {existing && existing.amount_paid > 0 && (
          <div className="line">
            <span>Already paid</span>
            <span>{money(existing.amount_paid)}</span>
          </div>
        )}
      </div>

      <label>
        <span>Notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : editId ? 'Save changes' : 'Create invoice'}
      </button>
      <button className="btn-ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}