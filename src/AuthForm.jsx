import { useState } from 'react';
import { supabase } from './supabase.js';

export default function AuthForm() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const isSignup = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage({ type: '', text: '' });

    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else if (isSignup && !data.session) {
      setMessage({
        type: 'info',
        text: 'Account created. Check your email to confirm it, then sign in.',
      });
    }
    setBusy(false);
  }

  function switchMode() {
    setMode(isSignup ? 'signin' : 'signup');
    setMessage({ type: '', text: '' });
  }

  return (
    <div className="auth">
      <section className="auth-brand">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          Billora
        </div>

        <div className="auth-pitch">
          <h1>Business documents, made clear.</h1>
          <p>Invoices, quotations and delivery notes for your business, in one place.</p>
        </div>

        <div className="doc-sketch" aria-hidden="true">
          <i className="short" />
          <i />
          <i className="mid" />
          <i />
          <i className="mid" />
          <i className="total" />
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-sub">
            {isSignup ? 'Start managing your documents.' : 'Sign in to continue to Billora.'}
          </p>

          {message.text && (
            <p className={'notice ' + message.type} role="alert">
              {message.text}
            </p>
          )}

          <form onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@business.co.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="pw-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? 'Already have an account? ' : 'New to Billora? '}
            <button type="button" className="link-btn" onClick={switchMode}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}