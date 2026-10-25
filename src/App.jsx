import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from './supabase.js';
import AuthForm from './AuthForm.jsx';
import Overview from './Overview.jsx';
import BusinessProfile from './BusinessProfile.jsx';
import Customers from './Customers.jsx';
import Invoices from './Invoices.jsx';
import Payments from './Payments.jsx';
import DeliveryNotes from './DeliveryNotes.jsx';
import Icon from './Icon.jsx';
import './shell.css';

const sections = [
  { name: 'Overview', icon: 'overview' },
  { name: 'Invoices', icon: 'invoices' },
  { name: 'Payments', icon: 'payments' },
  { name: 'Quotations', icon: 'quotations' },
  { name: 'Delivery notes', icon: 'delivery' },
  { name: 'Customers', icon: 'customers' },
  { name: 'Business', icon: 'business' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseReady);

  useEffect(() => {
    if (!supabaseReady) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseReady) {
    return (
      <main className="content">
        <h1>Billora</h1>
        <p>Supabase keys are missing or invalid. Check the Environment Variables in Vercel, then redeploy.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="content">
        <p>Loading...</p>
      </main>
    );
  }

  return session ? <Dashboard email={session.user.email} /> : <AuthForm />;
}

function Dashboard({ email }) {
  const [active, setActive] = useState('Overview');
  const [menu, setMenu] = useState(false);

  function go(name) {
    setActive(name);
    setMenu(false);
    window.scrollTo({ top: 0 });
  }

  const initial = (email || '?').charAt(0).toUpperCase();
  const label = (email || '').split('@')[0];

  return (
    <div className="shell">
      <header className="tb">
        <div className="tb-brand">
          <span className="tb-logo">
            <Icon name="invoices" size={18} />
          </span>
          Billora
        </div>

        <div className="tb-user">
          <button
            type="button"
            className="tb-avatar-btn"
            aria-haspopup="true"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <span className="tb-avatar">{initial}</span>
            <span className="tb-name">{label}</span>
            <Icon name="chevron" size={16} />
          </button>
          {menu && (
            <>
              <button
                type="button"
                className="tb-scrim"
                aria-label="Close menu"
                onClick={() => setMenu(false)}
              />
              <div className="tb-menu">
                <p>{email}</p>
                <button type="button" onClick={() => supabase.auth.signOut()}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="shell-body">
        <nav className="sb" aria-label="Main">
          {sections.map((s) => (
            <button
              key={s.name}
              type="button"
              className={s.name === active ? 'sb-item on' : 'sb-item'}
              aria-current={s.name === active ? 'page' : undefined}
              onClick={() => go(s.name)}
            >
              <Icon name={s.icon} size={18} />
              {s.name}
            </button>
          ))}
        </nav>

        <main className="main">
          {active === 'Overview' ? (
            <Overview key="overview" onNavigate={go} />
          ) : (
            <div className="content">
              <h1>{active}</h1>
              {active === 'Business' ? (
                <BusinessProfile />
              ) : active === 'Customers' ? (
                <Customers />
              ) : active === 'Invoices' ? (
                <Invoices />
              ) : active === 'Payments' ? (
                <Payments />
              ) : active === 'Delivery notes' ? (
                <DeliveryNotes />
              ) : (
                <p>{active} will be built here soon.</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}