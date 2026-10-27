import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { ErrorBox } from '../components/Feedback.jsx';
import { toLocalInputValue } from '../lib/format.js';

function Toggle({ on, onChange, title, desc }) {
  return (
    <button type="button" className={`toggle ${on ? 'toggle--on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle__switch" />
      <span>
        <div className="toggle__title">{title}</div>
        <div className="toggle__desc">{desc}</div>
      </span>
    </button>
  );
}

export default function NewDecision() {
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState([]);
  const [draft, setDraft] = useState('');
  const [deadline, setDeadline] = useState('');
  const [mode, setMode] = useState('nominate'); // 'nominate' | 'vote'
  const [settings, setSettings] = useState({ allowNominations: true, anonymousBallots: false, liveResults: false, minBallots: 0 });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function addOption() {
    const label = draft.trim();
    if (!label) return;
    if (options.some((o) => o.toLowerCase() === label.toLowerCase())) {
      setErrors((e) => ({ ...e, draft: 'Already on the list' }));
      return;
    }
    if (options.length >= 30) {
      setErrors((e) => ({ ...e, draft: 'Maximum 30 options' }));
      return;
    }
    setOptions((o) => [...o, label]);
    setDraft('');
    setErrors((e) => ({ ...e, draft: undefined, options: undefined }));
  }

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    const localErrors = {};
    if (title.trim().length < 3) localErrors.title = 'Give it a title of at least 3 characters';
    if (mode === 'vote' && options.length < 2) localErrors.options = 'Add at least two options to start voting immediately';
    if (deadline && new Date(deadline).getTime() < Date.now() + 60_000) localErrors.deadline = 'Deadline must be in the future';
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }
    setBusy(true);
    try {
      const data = await api('/decisions', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          options,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          settings,
          startVoting: mode === 'vote',
        },
      });
      toast.success('Decision created. Share the code!');
      navigate(`/d/${data.decision.code}`, { replace: true });
    } catch (err) {
      if (err.details && Object.keys(err.details).length) {
        const mapped = {};
        for (const [k, v] of Object.entries(err.details)) mapped[k.split('.')[0]] = v;
        setErrors(mapped);
      } else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page page--narrow">
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow">New decision</div>
        <h1 className="h1" style={{ marginTop: 6 }}>
          What needs deciding?
        </h1>
      </div>

      <form className="stack stack--lg" onSubmit={submit} noValidate>
        {formError && <ErrorBox>{formError}</ErrorBox>}

        <div className="card stack">
          <div className="field">
            <label className="field__label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className={`input ${errors.title ? 'input--error' : ''}`}
              placeholder="Where should we go for the team offsite?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={90}
              autoFocus
            />
            {errors.title && <span className="field__error">{errors.title}</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="desc">
              Context <span className="muted">(optional)</span>
            </label>
            <textarea
              id="desc"
              className="textarea"
              placeholder="Anything voters should know: budget, dates, constraints…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
            />
          </div>
        </div>

        <div className="card stack">
          <div>
            <div className="h3">Options</div>
            <p className="small muted">Add some now, or let the group nominate theirs. You can always add more before voting opens.</p>
          </div>
          <div className="option-list">
            {options.map((o, i) => (
              <div key={o} className="option-chip">
                <span className="option-chip__num">{i + 1}</span>
                <span className="option-chip__label">{o}</span>
                <button type="button" className="btn btn--subtle btn--sm" onClick={() => setOptions((list) => list.filter((x) => x !== o))} aria-label={`Remove ${o}`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="field">
            <div className="option-input-row">
              <input
                className={`input ${errors.draft ? 'input--error' : ''}`}
                placeholder="Type an option and press Enter"
                value={draft}
                maxLength={80}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setErrors((er) => ({ ...er, draft: undefined }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOption();
                  }
                }}
              />
              <button type="button" className="btn btn--ghost" onClick={addOption} disabled={!draft.trim()}>
                Add
              </button>
            </div>
            {(errors.draft || errors.options) && <span className="field__error">{errors.draft || errors.options}</span>}
          </div>
        </div>

        <div className="card stack">
          <div className="h3">How should it start?</div>
          <div className="grid-2">
            <Toggle
              on={mode === 'nominate'}
              onChange={() => setMode('nominate')}
              title="Collect nominations first"
              desc="Participants can add options. You open voting when the list is ready."
            />
            <Toggle
              on={mode === 'vote'}
              onChange={() => setMode('vote')}
              title="Start voting immediately"
              desc="The option list is final. People can rank as soon as they join."
            />
          </div>
        </div>

        <div className="card stack">
          <div className="h3">Rules</div>
          <div className="field">
            <label className="field__label" htmlFor="deadline">
              Voting deadline <span className="muted">(optional)</span>
            </label>
            <input
              id="deadline"
              type="datetime-local"
              className={`input ${errors.deadline ? 'input--error' : ''}`}
              value={deadline}
              min={toLocalInputValue(new Date(Date.now() + 5 * 60_000))}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <span className="field__hint">Voting closes automatically at this time and the result is revealed.</span>
            {errors.deadline && <span className="field__error">{errors.deadline}</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="quorum">
              Minimum ballots (quorum)
            </label>
            <input
              id="quorum"
              type="number"
              min={0}
              max={1000}
              className="input"
              style={{ maxWidth: 160 }}
              value={settings.minBallots}
              onChange={(e) => setSettings((s) => ({ ...s, minBallots: Math.max(0, Number(e.target.value) || 0) }))}
            />
            <span className="field__hint">The result is flagged if fewer people vote. 0 means no minimum.</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <Toggle
              on={settings.allowNominations}
              onChange={(v) => setSettings((s) => ({ ...s, allowNominations: v }))}
              title="Participants can add options"
              desc="Only while collecting nominations. Up to 5 each."
            />
            <Toggle
              on={settings.liveResults}
              onChange={(v) => setSettings((s) => ({ ...s, liveResults: v }))}
              title="Show live results"
              desc="Everyone sees the running tally while voting is open. Otherwise only you do."
            />
            <Toggle
              on={settings.anonymousBallots}
              onChange={(v) => setSettings((s) => ({ ...s, anonymousBallots: v }))}
              title="Anonymous ballots"
              desc="Nobody, including you, sees who ranked what."
            />
          </div>
        </div>

        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
          {busy ? <span className="spinner spinner--sm" /> : mode === 'vote' ? 'Create & open voting' : 'Create decision'}
        </button>
      </form>
    </main>
  );
}
