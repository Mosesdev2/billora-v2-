import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from './supabase.js';
import AuthForm from './AuthForm.jsx';
import BusinessProfile from './BusinessProfile.jsx';
import Customers from './Customers.jsx';
import Invoices from './Invoices.jsx';

const sections = ['Overview', 'Invoices', 'Quotations', 'Delivery notes', 'Customers', 'Business'];

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

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Billora</strong>
        <nav className="nav">
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              className={name === active ? 'nav-btn is-active' : 'nav-btn'}
              onClick={() => setActive(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        <h1>{active}</h1>
        {active === 'Business' ? (
          <BusinessProfile />
        ) : active === 'Customers' ? (
          <Customers />
        ) : active === 'Invoices' ? (
          <Invoices />
        ) : active === 'Overview' ? (
          <p>Signed in as {email}.</p>
        ) : (
          <p>{active} will be built here soon.</p>
        )}
        <p>
          <button
            className="nav-btn"
            style={{ color: 'inherit', borderColor: '#999' }}
            type="button"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </p>
      </main>
    </div>
  );
}