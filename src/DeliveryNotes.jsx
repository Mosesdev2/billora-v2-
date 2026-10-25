import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './business.css';
import './invoices.css';
import DeliveryDocument from './DeliveryDocument.jsx';

const PAGE = 20;

const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const fmt = (d) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
const blankItem = () => ({
  key: Math.random().toString(36).slice(2),
  description: '',
  qty: '1',
});

export default function DeliveryNotes() {
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
      .from('delivery_notes')
      .select('id,note_number,customer_name,expected_date,delivery_fee', { count: 'exact' })
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
  if (!biz) {
    return <p>Create your business profile first (Business tab), then create delivery notes here.</p>;
  }

  if (view === 'doc') {
    return <DeliveryDocument bizId={biz.id} id={editId} onBack={() => setView('list')} />;
  }

  if (view === 'form') {
    return (
      <NoteForm
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
        New delivery note
      </button>

      {rows.length === 0 ? (
        <p>No delivery notes yet.</p>
      ) : (
        <ul className="inv-list">
          {rows.map((r) => (
            <li key={r.id} className="inv-li">
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
                  <strong>{r.note_number}</strong>
                  <span>
                    {r.customer_name}
                    {r.expected_date ? ' · expected ' + fmt(r.expected_date) : ''}
                  </span>
                </span>
                <span className="inv-side">
                  {Number(r.delivery_fee) > 0 && (
                    <strong>
                      {biz.currency} {money(r.delivery_fee)}
                    </strong>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="btn-ghost small"
                onClick={() => {
                  setEditId(r.id);
                  setMsg(null);
                  setView('doc');
                }}
              >
                PDF
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

function NoteForm({ biz, editId, onDone, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [existing, setExisting] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [expected, setExpected] = useState('');
  const [fee, setFee] = useState('0');
  const [instructions, setInstructions] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const custQ = supabase
        .from('customers')
        .select('id,name,phone,address')
        .eq('business_id', biz.id)
        .order('name')
        .limit(500);
      const invQ = supabase
        .from('documents')
        .select('id,doc_number,customer_id,customer_name,customer_phone,items')
        .eq('business_id', biz.id)
        .eq('doc_type', 'invoice')
        .order('created_at', { ascending: false })
        .limit(50);
      const noteQ = editId
        ? supabase.from('delivery_notes').select('*').eq('id', editId).single()
        : null;
      const [c, i, n] = await Promise.all([custQ, invQ, noteQ]);
      if (cancelled) return;

      if (c.error) setMsg({ type: 'error', text: c.error.message });
      else setCustomers(c.data);
      if (i.error) setMsg({ type: 'error', text: i.error.message });
      else setInvoices(i.data);

      if (n) {
        if (n.error) setMsg({ type: 'error', text: n.error.message });
        else {
          const r = n.data;
          setExisting({ note_number: r.note_number });
          setCustomerId(r.customer_id || '');
          setInvoiceId(r.invoice_id || '');
          setName(r.customer_name || '');
          setPhone(r.customer_phone || '');
          setAddress(r.delivery_address || '');
          setIssueDate(r.issue_date);
          setExpected(r.expected_date || '');
          setFee(String(r.delivery_fee ?? 0));
          setInstructions(r.instructions || '');
          const loaded = (r.items || []).map((it) => ({
            key: Math.random().toString(36).slice(2),
            description: it.description || '',
            qty: String(it.qty ?? 1),
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

  function pickCustomer(id) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setName(c.name || '');
      setPhone(c.phone || '');
      if (c.address) setAddress(c.address);
    }
  }

  function pickInvoice(id) {
    setInvoiceId(id);
    const inv = invoices.find((x) => x.id === id);
    if (!inv) return;
    setName(inv.customer_name || '');
    setPhone(inv.customer_phone || '');
    setCustomerId(inv.customer_id || '');
    const c = customers.find((x) => x.id === inv.customer_id);
    if (c && c.address) setAddress(c.address);
    const lines = (inv.items || []).map((it) => ({
      key: Math.random().toString(36).slice(2),
      description: it.description || '',
      qty: String(it.qty ?? 1),
    }));
    if (lines.length) setItems(lines);
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
      if (!desc) continue;
      const qty = Number(it.qty);
      if (!(qty > 0)) return setMsg({ type: 'error', text: 'Quantity must be more than zero.' });
      lines.push({ description: desc, qty });
    }
    if (!lines.length) return setMsg({ type: 'error', text: 'Add at least one item.' });

    const feeNum = Number(fee || 0);
    if (!(feeNum >= 0)) return setMsg({ type: 'error', text: 'Delivery fee cannot be negative.' });
    if (expected && expected < issueDate) {
      return setMsg({ type: 'error', text: 'Expected date cannot be before the date issued.' });
    }

    setBusy(true);
    setMsg(null);

    const body = {
      customer_id: customerId || null,
      invoice_id: invoiceId || null,
      customer_name: cleanName,
      customer_phone: phone.trim(),
      delivery_address: address.trim(),
      issue_date: issueDate,
      expected_date: expected || null,
      instructions: instructions.trim(),
      delivery_fee: feeNum,
      items: lines,
    };

    let error = null;
    if (editId) {
      ({ error } = await supabase.from('delivery_notes').update(body).eq('id', editId));
    } else {
      for (let i = 0; i < 3; i++) {
        const num = await supabase.rpc('next_note_number', { p_business: biz.id });
        if (num.error) {
          error = num.error;
          break;
        }
        ({ error } = await supabase
          .from('delivery_notes')
          .insert({ ...body, business_id: biz.id, note_number: num.data }));
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
      <h2>
        {editId ? 'Edit ' + (existing ? existing.note_number : 'delivery note') : 'New delivery note'}
      </h2>

      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      <label>
        <span>Create from invoice (optional)</span>
        <select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)}>
          <option value="">None</option>
          {invoices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.doc_number} · {i.customer_name}
            </option>
          ))}
        </select>
      </label>

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

      <label>
        <span>Phone</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <label>
        <span>Delivery address</span>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>

      <div className="row">
        <label>
          <span>Date</span>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
        </label>
        <label>
          <span>Expected delivery</span>
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </label>
      </div>

      <h2 style={{ marginTop: 24 }}>Goods</h2>
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
          <div className="inv-item-foot">
            <label style={{ margin: 0, flex: 1 }}>
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
        style={{ marginBottom: 16 }}
        onClick={() => setItems([...items, blankItem()])}
      >
        Add item
      </button>

      <label>
        <span>Delivery fee ({biz.currency}, optional)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </label>

      <label>
        <span>Instructions and landmarks (optional)</span>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </label>

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : editId ? 'Save changes' : 'Create delivery note'}
      </button>
      <button className="btn-ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}