import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './business.css';

const PAGE = 20;
const EMPTY = { name: '', phone: '', email: '', address: '' };

export default function Customers() {
  const [businessId, setBusinessId] = useState(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from('businesses')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (error) setMsg({ type: 'error', text: error.message });
        else if (data.length) setBusinessId(data[0].id);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!businessId) return;
    let q = supabase
      .from('customers')
      .select('id,name,phone,email,address', { count: 'exact' })
      .eq('business_id', businessId)
      .order('name')
      .range(page * PAGE, page * PAGE + PAGE - 1);

    const t = term.replace(/[,()%*]/g, ' ').trim();
    if (t) q = q.or(`name.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%`);

    const { data, error, count: total } = await q;
    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setRows(data);
      setCount(total || 0);
    }
  }, [businessId, page, term]);

  useEffect(() => {
    load();
  }, [load]);

  function set(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  function startNew() {
    setEditId(null);
    setForm(EMPTY);
    setMsg(null);
    setShowForm(true);
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({
      name: r.name || '',
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
    });
    setMsg(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancel() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY);
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    if (!name) {
      setMsg({ type: 'error', text: 'Enter the customer name.' });
      return;
    }
    setBusy(true);
    setMsg(null);

    const payload = {
      name,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
    };

    const { error } = editId
      ? await supabase.from('customers').update(payload).eq('id', editId)
      : await supabase.from('customers').insert({ ...payload, business_id: businessId });

    if (error) setMsg({ type: 'error', text: error.message });
    else {
      setMsg({ type: 'info', text: editId ? 'Customer updated.' : 'Customer added.' });
      cancel();
      await load();
    }
    setBusy(false);
  }

  if (!ready) return <p>Loading...</p>;

  if (!businessId) {
    return <p>Create your business profile first (Business tab), then add customers here.</p>;
  }

  const lastPage = Math.max(0, Math.ceil(count / PAGE) - 1);

  return (
    <div className="cust">
      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      {showForm ? (
        <form className="biz-form" onSubmit={save}>
          <h2>{editId ? 'Edit customer' : 'New customer'}</h2>
          <label>
            <span>Name</span>
            <input value={form.name} onChange={set('name')} maxLength={100} required />
          </label>
          <div className="row">
            <label>
              <span>Phone</span>
              <input type="tel" value={form.phone} onChange={set('phone')} />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={set('email')} />
            </label>
          </div>
          <label>
            <span>Address</span>
            <textarea value={form.address} onChange={set('address')} />
          </label>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving...' : editId ? 'Save changes' : 'Add customer'}
          </button>
          <button className="btn-ghost" type="button" onClick={cancel}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Search name, phone or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-primary add" type="button" onClick={startNew}>
              Add customer
            </button>
          </div>

          {rows.length === 0 ? (
            <p>{term ? 'No customers match your search.' : 'No customers yet.'}</p>
          ) : (
            <ul className="cust-list">
              {rows.map((r) => (
                <li key={r.id} className="cust-item">
                  <div>
                    <strong>{r.name}</strong>
                    <span>{[r.phone, r.email].filter(Boolean).join(' · ') || 'No contact details'}</span>
                  </div>
                  <button type="button" className="btn-ghost small" onClick={() => startEdit(r)}>
                    Edit
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
        </>
      )}
    </div>
  );
}