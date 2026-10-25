import { useState } from 'react';
import { supabase } from './supabase.js';

const LABELS = ['', 'Too short', 'Weak', 'Good', 'Strong'];

function strengthOf(pw) {
  if (!pw) return 0;
  if (pw.length < 6) return 1;
  const points = [
    pw.length >= 8,
    /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    /\d/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
  if (points <= 1) return 2;
  if (points <= 3) return 3;
  return 4;
}

export default function AuthForm() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const isSignup = mode === 'signup';
  const level = strengthOf(password);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;

    if (isSignup && password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.', id: Date.now() });
      return;
    }

    setBusy(true);
    setMessage(null);

    const cleanEmail = email.trim();
    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email: cleanEmail, password })
      : await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (error) {
      setMessage({ type: 'error', text: error.message, id: Date.now() });
    } else if (isSignup && !data.session) {
      setMessage({
        type: 'info',
        text: 'Account created. Check your email to confirm it, then sign in.',
        id: Date.now(),
      });
    }
    setBusy(false);
  }

  function switchTo(next) {
    if (next === mode) return;
    setMode(next);
    setMessage(null);
    setConfirm('');
    setShowPw(false);
  }

  function checkCaps(e) {
    if (e.getModifierState) setCaps(e.getModifierState('CapsLock'));
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
          <div className="tabs" role="tablist" aria-label="Sign in or create account">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? 'tab is-active' : 'tab'}
              onClick={() => switchTo('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? 'tab is-active' : 'tab'}
              onClick={() => switchTo('signup')}
            >
              Create account
            </button>
          </div>

          <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-sub">
            {isSignup
              ? 'Set up Billora for your business.'
              : 'Sign in to continue to Billora.'}
          </p>

          {message && (
            <p key={message.id} className={'notice ' + message.type} role="alert">
              {message.text}
            </p>
          )}

          <form onSubmit={submit} noValidate={false}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
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
                  onKeyUp={checkCaps}
                  onKeyDown={checkCaps}
                  onBlur={() => setCaps(false)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw(!showPw)}
                  aria-pressed={showPw}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {caps && <small className="hint warn">Caps Lock is on.</small>}
              {isSignup && password && (
                <div className="strength" data-level={level}>
                  <div className="bars" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <i key={n} className={n <= level ? 'on' : ''} />
                    ))}
                  </div>
                  <small>{LABELS[level]}</small>
                </div>
              )}
            </label>

            {isSignup && (
              <label className="field">
                <span>Confirm password</span>
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                {confirm && (
                  <small className={password === confirm ? 'hint ok' : 'hint warn'}>
                    {password === confirm ? 'Passwords match.' : 'Passwords do not match yet.'}
                  </small>
                )}
              </label>
            )}

            <button className="btn-primary" type="submit" disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {busy ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-foot">
            Your documents stay private to your business.
          </p>
        </div>
      </section>
    </div>
  );
}