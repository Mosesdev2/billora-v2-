import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import Icon from './Icon.jsx';
import './overview.css';

const num = (n) => Number(n || 0);

function fmt(n) {
  const v = num(n);
  return v.toLocaleString('en-KE', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusLabel(r) {
  if (r.status === 'paid' || r.status === 'cancelled') return r.status;
  if (r.due_date && r.due_date < todayISO()) return 'overdue';
  return r.status;
}

const dmy = (d) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

function headline(s, months) {
  if (!num(s.invoice_count)) {
    return {
      a: "Let's get",
      b: 'started',
      sub: 'Create your first invoice and your numbers will appear here.',
    };
  }
  const cur = num(months[months.length - 1] && months[months.length - 1].collected);
  const prev = num(months[months.length - 2] && months[months.length - 2].collected);
  if (prev > 0 && cur > prev) {
    return {
      a: 'Your business is',
      b: 'growing',
      sub: 'You have collected more this month than last month.',
    };
  }
  if (num(s.overdue_count) > 0) {
    return {
      a: 'Some invoices need',
      b: 'attention',
      sub: plural(num(s.overdue_count), 'invoice') + ' overdue. Time to follow up.',
    };
  }
  return {
    a: 'Your business at a',
    b: 'glance',
    sub: "Here's what's happening with your business today.",
  };
}

export default function Overview({ onNavigate }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const b = await supabase
        .from('businesses')
        .select('id,name,currency')
        .order('created_at', { ascending: true })
        .limit(1);
      if (cancelled) return;
      if (b.error) return setState({ error: b.error.message });
      if (!b.data.length) return setState({ biz: null });

      const biz = b.data[0];
      const [s, inv] = await Promise.all([
        supabase.rpc('dashboard_summary', { p_business: biz.id }),
        supabase
          .from('documents')
          .select('id,doc_number,customer_name,issue_date,total,status,due_date')
          .eq('business_id', biz.id)
          .eq('doc_type', 'invoice')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;

      const failed = [s, inv].find((x) => x.error);
      if (failed) return setState({ error: failed.error.message });

      setState({ biz, summary: s.data, invoices: inv.data });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) return <p>Loading...</p>;

  if (state.error) {
    return (
      <p className="notice error" role="alert">
        {state.error}
      </p>
    );
  }

  if (!state.biz) {
    return (
      <div className="ov">
        <section className="ov-welcome">
          <h2>Welcome to Billora</h2>
          <p>
            Start by setting up your business profile. Your name, address and phone appear on
            every invoice, receipt and delivery note.
          </p>
          <button className="btn-primary" type="button" onClick={() => onNavigate('Business')}>
            Set up your business
          </button>
        </section>
      </div>
    );
  }

  const { biz, summary: s, invoices } = state;
  const cur = biz.currency;
  const months = Array.isArray(s.months) ? s.months : [];
  const head = headline(s, months);
  const overdueCount = num(s.overdue_count);

  const steps = [
    { text: 'Set up your business profile', done: true, go: 'Business' },
    { text: 'Add your first customer', done: num(s.customer_count) > 0, go: 'Customers' },
    { text: 'Create your first invoice', done: num(s.invoice_count) > 0, go: 'Invoices' },
    { text: 'Record your first payment', done: num(s.collected_total) > 0, go: 'Payments' },
  ];
  const allDone = steps.every((x) => x.done);

  const actions = [
    { icon: 'invoices', title: 'Create Invoice', sub: 'Generate a new invoice', go: 'Invoices' },
    { icon: 'customers', title: 'Add Customer', sub: 'Register a new customer', go: 'Customers' },
    { icon: 'delivery', title: 'New Delivery Note', sub: 'Record goods delivered', go: 'Delivery notes' },
    { icon: 'payments', title: 'Record Payment', sub: 'Log a payment received', go: 'Payments' },
  ];

  return (
    <div className="ov">
      <section className="ov-hero">
        <div>
          <p className="ov-kicker">
            {greeting()} · {biz.name}
          </p>
          <h1 className="ov-title">
            {head.a} <em>{head.b}</em>
          </h1>
          <p className="ov-sub">{head.sub}</p>
          {num(s.invoice_count) > 0 && (
            <p className="ov-meta">
              Outstanding{' '}
              <strong>
                {cur} {fmt(s.outstanding)}
              </strong>
              {' · '}
              {plural(num(s.open_count), 'unpaid invoice')}
              {overdueCount > 0 && (
                <>
                  {' · '}
                  <span className="ov-late">{overdueCount} overdue</span>
                </>
              )}
            </p>
          )}
        </div>
        <button className="ov-new" type="button" onClick={() => onNavigate('Invoices')}>
          <Icon name="plus" size={16} />
          New invoice
        </button>
      </section>

      <section className="ov-kpis" aria-label="Key figures">
        <div className="ov-kpi">
          <span className="ov-ico">
            <Icon name="payments" size={18} />
          </span>
          <p className="ov-kpi-label">Collected this month</p>
          <p className="ov-kpi-value">
            {cur} {fmt(s.collected_month)}
          </p>
          <p className="ov-kpi-sub">
            All time {cur} {fmt(s.collected_total)}
          </p>
        </div>
        <div className="ov-kpi">
          <span className="ov-ico">
            <Icon name="invoices" size={18} />
          </span>
          <p className="ov-kpi-label">Invoiced this month</p>
          <p className="ov-kpi-value">
            {cur} {fmt(s.invoiced_month)}
          </p>
        </div>
        <div className="ov-kpi">
          <span className="ov-ico">
            <Icon name="quotations" size={18} />
          </span>
          <p className="ov-kpi-label">Invoices</p>
          <p className="ov-kpi-value">{num(s.invoice_count)}</p>
          <p className="ov-kpi-sub">Cancelled not counted</p>
        </div>
        <div className="ov-kpi">
          <span className="ov-ico">
            <Icon name="user" size={18} />
          </span>
          <p className="ov-kpi-label">Customers</p>
          <p className="ov-kpi-value">{num(s.customer_count)}</p>
        </div>
      </section>

      {!allDone && (
        <section className="ov-card">
          <div className="ov-card-head">
            <h2 className="ov-h">Get started</h2>
          </div>
          <ul className="ov-steps">
            {steps.map((st) => (
              <li key={st.text} className={st.done ? 'ov-step done' : 'ov-step'}>
                <span className="ov-box" aria-hidden="true" />
                <span className="ov-step-text">{st.text}</span>
                {!st.done && (
                  <button className="ov-do" type="button" onClick={() => onNavigate(st.go)}>
                    Start
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ov-two">
        <section className="ov-card">
          <div className="ov-card-head">
            <h2 className="ov-h">Recent Invoices</h2>
            {invoices.length > 0 && (
              <button className="ov-link" type="button" onClick={() => onNavigate('Invoices')}>
                View all <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
          {invoices.length === 0 ? (
            <p className="ov-empty-note">No invoices yet.</p>
          ) : (
            <table className="ov-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th className="hide-sm">Date</th>
                  <th className="r">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((r) => {
                  const l = statusLabel(r);
                  return (
                    <tr key={r.id}>
                      <td>{r.doc_number}</td>
                      <td>{r.customer_name}</td>
                      <td className="hide-sm">{dmy(r.issue_date)}</td>
                      <td className="r">
                        {cur} {fmt(r.total)}
                      </td>
                      <td>
                        <span className={'pill ' + l}>{l}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="ov-card">
          <div className="ov-card-head">
            <h2 className="ov-h">Quick Actions</h2>
          </div>
          <ul className="ov-qa-list">
            {actions.map((a) => (
              <li key={a.title}>
                <button className="ov-qa" type="button" onClick={() => onNavigate(a.go)}>
                  <span className="ov-ico">
                    <Icon name={a.icon} size={18} />
                  </span>
                  <span className="ov-qa-text">
                    <strong>{a.title}</strong>
                    <span>{a.sub}</span>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="ov-banner">
        <span className="ov-ico">
          <Icon name="shield" size={20} />
        </span>
        <div>
          <strong>Your records are private</strong>
          <span>Each business can only see its own customers, invoices and payments.</span>
        </div>
      </section>
    </div>
  );
}