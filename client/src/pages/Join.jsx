import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Join() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const clean = code.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);

  function submit(e) {
    e.preventDefault();
    if (clean.length === 6) navigate(`/d/${clean}`);
  }

  return (
    <main className="page page--narrow">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="eyebrow">Join a decision</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Enter the code
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          It's the 6 letters the host shared with you. Links work too.
        </p>
      </div>
      <form className="card card--glow stack" onSubmit={submit}>
        <input
          className="input input--code"
          value={clean}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABC123"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Decision code"
        />
        <button className="btn btn--primary btn--lg btn--block" disabled={clean.length !== 6} type="submit">
          Open decision →
        </button>
      </form>
    </main>
  );
}
