'use client';

import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { window.location.href = '/'; return; }
      setError(res.status === 401 ? 'Wrong password. Try again.' : 'Sign-in is not set up. Check DASHBOARD_PASSWORD.');
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-wrap theme-forest">
      <div className="login-frame">
        <form className="login" onSubmit={submit}>
          <h1>Daymark</h1>
          <p>Enter the password to open this dashboard.</p>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}
          <button className="btn" type="submit" disabled={busy || !password}>{busy ? 'Checking' : 'Open dashboard'}</button>
        </form>
      </div>
    </main>
  );
}