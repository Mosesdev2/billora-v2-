import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from './supabase.js';

const sections = ['Overview', 'Invoices', 'Quotations', 'Delivery notes', 'Customers'];

const field = {
  display: 'block',
  width: '100%',
  padding: '10px',
  margin: '8px 0',
  fontSize: '16px',
  boxSizing: 'border-box',
};

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

function AuthForm() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else if (mode === 'signup' && !data.session) {
      setMessage('Account created. Check your email to confirm, then sign in.');
    }
    setBusy(false);
  }

  return (
    <main className="content">
      <h1>Billora</h1>
      <h2>{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
      <form onSubmit={submit}>
        <input
          style={field}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={field}
          type="password"
          placeholder="Password (6+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button className="nav-btn is-active" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      {message && <p>{message}</p>}
      <p>
        <button
          className="nav-btn"
          style={{ color: 'inherit', borderColor: '#999' }}
          type="button"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setMessage('');
          }}
        >
          {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
        </button>
      </p>
    </main>
  );
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
        {active === 'Overview' ? (
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