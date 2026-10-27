import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { ErrorBox } from '../components/Feedback.jsx';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { user, login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/app';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next} replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    setErrors({});
    try {
      const u = isLogin ? await login(form.email, form.password) : await register(form.name, form.email, form.password);
      toast.success(isLogin ? `Welcome back, ${u.name.split(' ')[0]}` : `Welcome aboard, ${u.name.split(' ')[0]}!`);
      navigate(next, { replace: true });
    } catch (err) {
      if (err.details && Object.keys(err.details).length) setErrors(err.details);
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page page--narrow">
      <div className="auth">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 className="h1">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            {isLogin ? 'Sign in to vote and see your decisions.' : 'One account, unlimited decisions.'}
          </p>
        </div>
        <form className="card card--glow stack" onSubmit={submit} noValidate>
          {formError && <ErrorBox>{formError}</ErrorBox>}
          {!isLogin && (
            <div className="field">
              <label className="field__label" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                className={`input ${errors.name ? 'input--error' : ''}`}
                placeholder="Ada Lovelace"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                required
              />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </div>
          )}
          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`input ${errors.email ? 'input--error' : ''}`}
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              required
            />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`input ${errors.password ? 'input--error' : ''}`}
              placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
              required
            />
            {errors.password && <span className="field__error">{errors.password}</span>}
          </div>
          <button className="btn btn--primary btn--lg btn--block" disabled={busy} type="submit">
            {busy ? <span className="spinner spinner--sm" /> : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="auth__switch">
          {isLogin ? (
            <>
              New here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
