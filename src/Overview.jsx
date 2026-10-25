import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import './invoices.css';
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

function daysLate(due) {
  const ms = new Date(todayISO() + 'T00:00:00') - new Date(due + 'T00:00:00');
  return Math.max(1, Math.round(ms / 86400000));
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

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
    : '';

export default function Overview({ email, onNavigate }) {
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
      const [s, od, pay, inv] = await Promise.all([
        supabase.rpc('dashboard_summary', { p_business: biz.id }),
        supabase
          .from('documents')
          .select('id,doc_number,customer_name,total,amount_paid,due_date')
          .eq('business_id', biz.id)
          .eq('doc_type', 'invoice')
          .in('status', ['unpaid', 'partial'])
          .lt('due_date', todayISO())
          .order('due_date', { ascending: true })
          .limit(5),
        supabase
          .from('payments')
          .select('id,receipt_number,amount,method,paid_at,documents(doc_number,customer_name)')
          .eq('business_id', biz.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('documents')
          .select('id,doc_number,customer_name,total,status,due_date')
          .eq('business_id', biz.id)
          .eq('doc_type', 'invoice')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;

      const failed = [s, od, pay, inv].find((x) => x.error);
      if (failed) return setState({ error: failed.error.message });

      setState({
        biz,
        summary: s.data,
        overdue: od.data,
        payments: pay.data,
        invoices: inv.data,
      });
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

  const { biz, summary: s, overdue, payments, invoices } = state;
  const cur = biz.currency;
  const months = Array.isArray(s.months) ? s.months : [];
  const max = Math.max(1, ...months.flatMap((m) => [num(m.invoiced), num(m.collected)]));
  const hasChart = months.some((m) => num(m.invoiced) > 0 || num(m.collected) > 0);
  const overdueCount = num(s.overdue_count);

  const steps = [
    { text: 'Set up your business profile', done: true, go: 'Business' },
    { text: 'Add your first customer', done: num(s.customer_count) > 0, go: 'Customers' },
    { text: 'Create your first invoice', done: num(s.invoice_count) > 0, go: 'Invoices' },
    { text: 'Record your first payment', done: num(s.collected_total) > 0, go: 'Payments' },
  ];
  const allDone = steps.every((x) => x.done);

  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="ov">
      <header className="ov-head">
        <p className="ov-date">{today}</p>
        <h1 className="ov-title">{greeting()}</h1>
        <p className="ov-biz">{biz.name}</p>
      </header>

      <section className="ov-hero" aria-label="Outstanding balance">
        <p className="ov-hero-label">Outstanding</p>
        <p className="ov-hero-amount">
          <small>{cur}</small>
          {fmt(s.outstanding)}
        </p>
        <p className="ov-hero-sub">
          {num(s.open_count) > 0
            ? plural(num(s.open_count), 'unpaid invoice') + ' waiting for payment'
            : num(s.invoice_count) > 0
            ? 'Every invoice is paid'
            : 'No invoices yet'}
        </p>
        {overdueCount > 0 ? (
          <span className="ov-chip bad">
            {cur} {fmt(s.overdue_amount)} overdue · {plural(overdueCount, 'invoice')}
          </span>
        ) : (
          num(s.invoice_count) > 0 && <span className="ov-chip good">Nothing overdue</span>
        )}
      </section>

      <section className="ov-kpis" aria-label="Key figures">
        <div className="ov-kpi">
          <p className="ov-kpi-label">Collected this month</p>
          <p className="ov-kpi-value">
            {cur} {fmt(s.collected_month)}
          </p>
          <p className="ov-kpi-sub">All time {cur} {fmt(s.collected_total)}</p>
        </div>
        <div className="ov-kpi">
          <p className="ov-kpi-label">Invoiced this month</p>
          <p className="ov-kpi-value">
            {cur} {fmt(s.invoiced_month)}
          </p>
        </div>
        <div className="ov-kpi">
          <p className="ov-kpi-label">Invoices</p>
          <p className="ov-kpi-value">{num(s.invoice_count)}</p>
          <p className="ov-kpi-sub">Cancelled not counted</p>
        </div>
        <div className="ov-kpi">
          <p className="ov-kpi-label">Customers</p>
          <p className="ov-kpi-value">{num(s.customer_count)}</p>
        </div>
      </section>

      <section className="ov-actions" aria-label="Quick actions">
        <button className="ov-act" type="button" onClick={() => onNavigate('Invoices')}>
          New invoice
        </button>
        <button className="ov-act" type="button" onClick={() => onNavigate('Payments')}>
          Record payment
        </button>
        <button className="ov-act" type="button" onClick={() => onNavigate('Delivery notes')}>
          Delivery note
        </button>
        <button className="ov-act" type="button" onClick={() => onNavigate('Customers')}>
          Add customer
        </button>
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

      <section className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-h">Last 6 months</h2>
        </div>
        {hasChart ? (
          <>
            <p className="ov-legend">
              <span className="l-inv">Invoiced</span>
              <span className="l-col">Collected</span>
            </p>
            <div
              className="ov-chart"
              role="img"
              aria-label={months
                .map(
                  (m) =>
                    m.m + ': invoiced ' + fmt(m.invoiced) + ', collected ' + fmt(m.collected)
                )
                .join('. ')}
            >
              {months.map((m, i) => (
                <div
                  key={m.m + i}
                  className={i === months.length - 1 ? 'ov-col now' : 'ov-col'}
                  title={m.m + ': invoiced ' + fmt(m.invoiced) + ', collected ' + fmt(m.collected)}
                >
                  <span
                    className={num(m.invoiced) > 0 ? 'ov-bar inv' : 'ov-bar inv zero'}
                    style={{ height: (num(m.invoiced) / max) * 100 + '%' }}
                  />
                  <span
                    className={num(m.collected) > 0 ? 'ov-bar col' : 'ov-bar col zero'}
                    style={{ height: (num(m.collected) / max) * 100 + '%' }}
                  />
                  <span className="ov-col-label">{m.m}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="ov-empty-note">
            Your chart appears here once you create invoices and record payments.
          </p>
        )}
      </section>

      <section className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-h">Needs attention</h2>
          {overdue.length > 0 && (
            <button className="ov-link" type="button" onClick={() => onNavigate('Invoices')}>
              All invoices
            </button>
          )}
        </div>
        {overdue.length === 0 ? (
          <p className="ov-empty-note">No overdue invoices. Nice work.</p>
        ) : (
          <ul className="ov-list">
            {overdue.map((r) => (
              <li key={r.id}>
                <button className="ov-row" type="button" onClick={() => onNavigate('Invoices')}>
                  <span className="ov-row-main">
                    <strong>{r.customer_name}</strong>
                    <span>Invoice {r.doc_number}</span>
                  </span>
                  <span className="ov-row-side">
                    <strong>
                      {cur} {fmt(num(r.total) - num(r.amount_paid))}
                    </strong>
                    <span className="late">{plural(daysLate(r.due_date), 'day')} late</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-h">Recent payments</h2>
          {payments.length > 0 && (
            <button className="ov-link" type="button" onClick={() => onNavigate('Payments')}>
              View all
            </button>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="ov-empty-note">No payments recorded yet.</p>
        ) : (
          <ul className="ov-list">
            {payments.map((p) => (
              <li key={p.id}>
                <button className="ov-row" type="button" onClick={() => onNavigate('Payments')}>
                  <span className="ov-row-main">
                    <strong>{p.documents ? p.documents.customer_name : 'Payment'}</strong>
                    <span>
                      Receipt {p.receipt_number} · {p.method}
                    </span>
                  </span>
                  <span className="ov-row-side">
                    <strong>
                      {cur} {fmt(p.amount)}
                    </strong>
                    <span>{shortDate(p.paid_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-h">Recent invoices</h2>
          {invoices.length > 0 && (
            <button className="ov-link" type="button" onClick={() => onNavigate('Invoices')}>
              View all
            </button>
          )}
        </div>
        {invoices.length === 0 ? (
          <p className="ov-empty-note">No invoices yet.</p>
        ) : (
          <ul className="ov-list">
            {invoices.map((r) => {
              const l = statusLabel(r);
              return (
                <li key={r.id}>
                  <button className="ov-row" type="button" onClick={() => onNavigate('Invoices')}>
                    <span className="ov-row-main">
                      <strong>{r.customer_name}</strong>
                      <span>Invoice {r.doc_number}</span>
                    </span>
                    <span className="ov-row-side">
                      <strong>
                        {cur} {fmt(r.total)}
                      </strong>
                      <em className={'badge ' + l}>{l}</em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="ov-foot">Signed in as {email}</p>
    </div>
  );
}