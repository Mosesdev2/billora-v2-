import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import DocumentRenderer from './DocumentRenderer.jsx';
import './business.css';
import './invoices.css';

const WORD = { invoice: 'invoice', receipt: 'receipt', delivery_note: 'delivery note' };
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const uid = () => Math.random().toString(36).slice(2);
const niceDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-KE');
const rBiz = (b) => ({
  name: b.name,
  address: b.address,
  phone: b.phone,
  kraPin: b.tax_pin,
  till: b.till_number,
});
const inputFields = (t) =>
  (t.config.fields || []).filter(
    (f) => f.enabled !== false && f.type !== 'index' && f.type !== 'amount'
  );
const blankItem = (fields) => {
  const o = { key: uid() };
  fields.forEach((f) => {
    o[f.key] = f.key === 'qty' ? '1' : '';
  });
  return o;
};

function calc(template, items, discount) {
  const t = template.config.totals || {};
  const sub = round2(
    items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  );
  const disc = t.showDiscount ? Math.max(0, Number(discount) || 0) : 0;
  const base = Math.max(0, round2(sub - disc));
  const tax = t.showTax ? round2(base * 0.16) : 0;
  return { sub, disc, tax, total: round2(base + tax) };
}

function statusFor(total, paid, current) {
  if (current === 'cancelled') return current;
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

export default function TemplateDocs({ biz, docType, templateId, onNavigate }) {
  const [template, setTemplate] = useState(null);
  const [state, setState] = useState('loading');
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTemplate(data);
          setState('ok');
        } else setState('missing');
      });
  }, [templateId]);

  if (state === 'loading') return <p>Loading...</p>;
  if (state === 'missing') {
    return (
      <div className="biz-form">
        <p>Your template was removed. Choose another one in the Templates tab.</p>
        <button className="btn-primary" type="button" onClick={() => onNavigate('Templates')}>
          Choose template
        </button>
      </div>
    );
  }

  if (view === 'form') {
    return (
      <DocForm
        biz={biz}
        template={template}
        docType={docType}
        editId={editId}
        onDone={() => setView('list')}
        onCancel={() => setView('list')}
      />
    );
  }
  if (view === 'view') {
    return (
      <DocView
        biz={biz}
        template={template}
        id={editId}
        onBack={() => setView('list')}
        onEdit={() => setView('form')}
      />
    );
  }
  return (
    <DocList
      biz={biz}
      docType={docType}
      onNew={() => {
        setEditId(null);
        setView('form');
      }}
      onOpen={(id) => {
        setEditId(id);
        setView('view');
      }}
    />
  );
}

function DocList({ biz, docType, onNew, onOpen }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase
      .from('documents')
      .select('id,doc_number,customer_name,issue_date,total')
      .eq('business_id', biz.id)
      .eq('doc_type', docType)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows(data);
      });
  }, [biz.id, docType]);

  return (
    <div>
      {err && (
        <p className="notice error" role="alert">
          {err}
        </p>
      )}
      <button className="btn-primary" type="button" style={{ marginBottom: 16 }} onClick={onNew}>
        New {WORD[docType]}
      </button>
      {rows && rows.length === 0 && <p>No {WORD[docType]}s yet.</p>}
      <ul className="inv-list">
        {(rows || []).map((r) => (
          <li key={r.id} className="inv-li">
            <button type="button" className="inv-row" onClick={() => onOpen(r.id)}>
              <span className="inv-main">
                <strong>{r.doc_number}</strong>
                <span>
                  {r.customer_name} · {r.issue_date}
                </span>
              </span>
              <span className="inv-side">
                {Number(r.total) > 0 && (
                  <strong>
                    {biz.currency} {money(r.total)}
                  </strong>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocView({ biz, template, id, onBack, onEdit }) {
  const [row, setRow] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRow(data);
      });
  }, [id]);

  if (err) {
    return (
      <p className="notice error" role="alert">
        {err}
      </p>
    );
  }
  if (!row) return <p>Loading...</p>;

  const m = row.meta || {};
  const data = {
    number: row.doc_number,
    date: niceDate(row.issue_date),
    customer: { name: row.customer_name, phone: row.customer_phone, ...(m.customer || {}) },
    discount: Number(row.discount || 0),
    paid: Number(m.paid || 0),
    items: row.items || [],
    extras: m.extras || {},
  };

  return (
    <div>
      <style>{`@media print{body *{visibility:hidden}#print-area,#print-area *{visibility:visible}#print-area{position:absolute;left:0;top:0;width:100%}}`}</style>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className="btn-ghost small" type="button" onClick={onBack}>
          Back
        </button>
        <button className="btn-ghost small" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="btn-primary" type="button" onClick={() => window.print()}>
          Download PDF
        </button>
      </div>
      <div id="print-area">
        <DocumentRenderer template={template} business={rBiz(biz)} data={data} />
      </div>
    </div>
  );
}

function DocForm({ biz, template, docType, editId, onDone, onCancel }) {
  const c = template.config;
  const fields = inputFields(template);
  const custF = (c.customer || []).filter((x) => x.enabled);
  const extraF = (c.extras || []).filter((x) => x.enabled);
  const t = c.totals || {};
  const hasPrice = fields.some((f) => f.key === 'price');

  const [loading, setLoading] = useState(!!editId);
  const [existing, setExisting] = useState(null);
  const [cust, setCust] = useState({});
  const [extras, setExtras] = useState({});
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([blankItem(fields)]);
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!editId) return;
    supabase
      .from('documents')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data: r, error }) => {
        if (error) {
          setMsg({ type: 'error', text: error.message });
          setLoading(false);
          return;
        }
        const m = r.meta || {};
        setExisting({
          doc_number: r.doc_number,
          amount_paid: Number(r.amount_paid || 0),
          status: r.status,
        });
        setCust({ name: r.customer_name || '', phone: r.customer_phone || '', ...(m.customer || {}) });
        setExtras(m.extras || {});
        setIssueDate(r.issue_date);
        setDueDate(r.due_date || '');
        setDiscount(String(r.discount ?? 0));
        setPaid(m.paid ? String(m.paid) : '');
        const loaded = (r.items || []).map((it) => {
          const o = { key: uid() };
          fields.forEach((f) => {
            o[f.key] =
              it[f.key] != null
                ? String(it[f.key])
                : f.key === 'item' && it.description
                ? it.description
                : '';
          });
          return o;
        });
        setItems(loaded.length ? loaded : [blankItem(fields)]);
        setLoading(false);
      });
  }, [editId]);

  const totals = useMemo(() => calc(template, items, discount), [template, items, discount]);

  function setItem(key, field, value) {
    setItems(items.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  }

  function toLines() {
    return items
      .filter((it) => (it.item || '').trim() || it.price)
      .map((it) => {
        const o = {};
        fields.forEach((f) => {
          const v = it[f.key];
          o[f.key] =
            f.type === 'number' || f.type === 'money'
              ? v === '' || v == null
                ? null
                : Number(v)
              : (v || '').trim();
        });
        o.description = o.item || '';
        o.amount = round2((Number(o.qty) || 0) * (Number(o.price) || 0));
        return o;
      });
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;

    const lines = toLines();
    if (!lines.length) return setMsg({ type: 'error', text: 'Add at least one item.' });
    for (const l of lines) {
      if (!l.item) return setMsg({ type: 'error', text: 'Add a name for every item.' });
      if (fields.some((f) => f.key === 'qty') && !(Number(l.qty) > 0))
        return setMsg({ type: 'error', text: 'Quantity must be more than zero.' });
    }
    if (docType === 'invoice' && dueDate && dueDate < issueDate)
      return setMsg({ type: 'error', text: 'Due date cannot be before the issue date.' });
    if (existing && docType === 'invoice' && totals.total < existing.amount_paid)
      return setMsg({ type: 'error', text: 'Total cannot be less than the amount already paid.' });

    setBusy(true);
    setMsg(null);

    const amountPaid =
      docType === 'receipt' ? totals.total : existing ? existing.amount_paid : 0;
    const status =
      docType === 'receipt'
        ? 'paid'
        : docType === 'invoice'
        ? statusFor(totals.total, amountPaid, existing ? existing.status : 'unpaid')
        : 'unpaid';

    const body = {
      customer_id: null,
      customer_name: (cust.name || '').trim() || 'Walk-in customer',
      customer_email: '',
      customer_phone: (cust.phone || '').trim(),
      issue_date: issueDate,
      due_date: docType === 'invoice' && dueDate ? dueDate : null,
      currency: biz.currency,
      subtotal: totals.sub,
      tax: totals.tax,
      discount: totals.disc,
      total: totals.total,
      notes: '',
      items: lines,
      status,
      amount_paid: amountPaid,
      template_id: template.id,
      meta: { customer: cust, extras, paid: Number(paid) || 0 },
    };

    let error = null;
    if (editId) {
      ({ error } = await supabase.from('documents').update(body).eq('id', editId));
    } else {
      for (let i = 0; i < 3; i++) {
        const num = await supabase.rpc('next_tdoc_number', {
          p_business: biz.id,
          p_type: docType,
        });
        if (num.error) {
          error = num.error;
          break;
        }
        ({ error } = await supabase.from('documents').insert({
          ...body,
          business_id: biz.id,
          doc_type: docType,
          doc_number: num.data,
        }));
        if (!error || error.code !== '23505') break;
      }
    }

    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else onDone();
  }

  if (loading) return <p>Loading...</p>;

  const previewData = {
    number: existing ? existing.doc_number : 'NEW',
    date: niceDate(issueDate),
    customer: cust,
    discount: totals.disc,
    paid: Number(paid) || 0,
    items: toLines(),
    extras,
  };

  return (
    <form className="biz-form inv-form" onSubmit={save}>
      <h2>
        {editId
          ? 'Edit ' + (existing ? existing.doc_number : WORD[docType])
          : 'New ' + WORD[docType]}
      </h2>

      {msg && (
        <p className={'notice ' + msg.type} role="alert">
          {msg.text}
        </p>
      )}

      {custF.map((x) => (
        <label key={x.key}>
          <span>{x.label}</span>
          <input
            value={cust[x.key] || ''}
            onChange={(e) => setCust({ ...cust, [x.key]: e.target.value })}
          />
        </label>
      ))}

      <div className="row">
        <label>
          <span>Date</span>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
        </label>
        {docType === 'invoice' && (
          <label>
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        )}
      </div>

      <h2 style={{ marginTop: 24 }}>Items</h2>
      {items.map((it, i) => (
        <div className="inv-item-card" key={it.key}>
          {fields.map((f) => (
            <label key={f.key}>
              <span>{f.label}</span>
              <input
                type={f.type === 'text' ? 'text' : 'number'}
                inputMode={f.type === 'text' ? undefined : 'decimal'}
                min={f.type === 'text' ? undefined : '0'}
                step={f.type === 'money' ? '0.01' : f.type === 'number' ? 'any' : undefined}
                placeholder={f.key === 'item' ? 'Item ' + (i + 1) : ''}
                value={it[f.key] ?? ''}
                onChange={(e) => setItem(it.key, f.key, e.target.value)}
              />
            </label>
          ))}
          <div className="inv-item-foot">
            {hasPrice ? (
              <span>
                Amount: <strong>{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</strong>
              </span>
            ) : (
              <span />
            )}
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
        onClick={() => setItems([...items, blankItem(fields)])}
      >
        Add item
      </button>

      {hasPrice && (
        <div className="totals">
          {t.showDiscount && (
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
          )}
          <div className="line">
            <span>Subtotal</span>
            <span>{money(totals.sub)}</span>
          </div>
          {totals.tax > 0 && (
            <div className="line">
              <span>VAT 16%</span>
              <span>{money(totals.tax)}</span>
            </div>
          )}
          <div className="line grand">
            <span>Total</span>
            <span>
              {biz.currency} {money(totals.total)}
            </span>
          </div>
        </div>
      )}

      {t.showChange && (
        <label>
          <span>Cash received ({biz.currency})</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
      )}

      {extraF.map((x) => (
        <label key={x.key}>
          <span>{x.label}</span>
          <input
            value={extras[x.key] || ''}
            onChange={(e) => setExtras({ ...extras, [x.key]: e.target.value })}
          />
        </label>
      ))}

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving...' : editId ? 'Save changes' : 'Create ' + WORD[docType]}
      </button>
      <button className="btn-ghost" type="button" onClick={onCancel}>
        Cancel
      </button>

      <h2 style={{ marginTop: 24 }}>Preview</h2>
      <DocumentRenderer template={template} business={rBiz(biz)} data={previewData} />
    </form>
  );
}