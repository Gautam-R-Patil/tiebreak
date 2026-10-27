import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { usePolling } from '../hooks/usePolling.js';
import PhaseBadge, { PhaseTrack } from '../components/PhaseBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import Countdown from '../components/Countdown.jsx';
import ShareCard from '../components/ShareCard.jsx';
import HostPanel from '../components/HostPanel.jsx';
import RankBallot from '../components/RankBallot.jsx';
import ResultsView from '../components/ResultsView.jsx';
import { Empty, ErrorBox, Loading } from '../components/Feedback.jsx';
import { formatDate, pluralize, relativeTime } from '../lib/format.js';

/* ---------------- Nominations ---------------- */

function Nominations({ data, onUpdate }) {
  const { decision, viewer } = data;
  const { user } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mine = decision.options.filter((o) => o.mine).length;
  const canAdd = viewer.isHost || (decision.settings.allowNominations && mine < 5);

  async function add(e) {
    e.preventDefault();
    const label = draft.trim();
    if (!label) return;
    setBusy(true);
    setError('');
    try {
      onUpdate(await api(`/decisions/${decision.code}/options`, { method: 'POST', body: { label } }));
      setDraft('');
      toast.success(`Added "${label}"`);
    } catch (err) {
      setError(err.details?.label || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(opt) {
    try {
      onUpdate(await api(`/decisions/${decision.code}/options/${opt.id}`, { method: 'DELETE' }));
      toast.info(`Removed "${opt.label}"`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="stack stack--lg">
      {!viewer.isHost && (
        <div className="info-box">
          <strong>Collecting options.</strong> {decision.host.name} will open voting once the list is ready. You'll rank everything then.
        </div>
      )}
      <div className="card stack">
        <div className="card__header" style={{ marginBottom: 0 }}>
          <h3 className="h3">Options on the table</h3>
          <span className="badge badge--neutral">{decision.options.length} / 30</span>
        </div>
        {decision.options.length === 0 ? (
          <Empty icon="💡" title="No options yet">
            {canAdd ? 'Be the first to nominate one below.' : 'The host will add some soon.'}
          </Empty>
        ) : (
          <div className="option-list">
            <AnimatePresence initial={false}>
              {decision.options.map((o, i) => (
                <motion.div
                  key={o.id}
                  className="option-chip"
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <span className="option-chip__num">{i + 1}</span>
                  <span className="option-chip__label">{o.label}</span>
                  <span className="option-chip__meta">
                    {o.mine ? 'you' : data.participants?.find((p) => p.id === o.addedBy)?.name || 'host'}
                  </span>
                  {(viewer.isHost || o.mine) && (
                    <button className="btn btn--subtle btn--sm" onClick={() => remove(o)} aria-label={`Remove ${o.label}`}>
                      ✕
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {canAdd ? (
          <form onSubmit={add} className="field">
            <div className="option-input-row">
              <input
                className={`input ${error ? 'input--error' : ''}`}
                placeholder={viewer.isHost ? 'Add an option' : `Nominate an option (${5 - mine} left)`}
                value={draft}
                maxLength={80}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError('');
                }}
              />
              <button className="btn btn--primary" disabled={busy || !draft.trim()} type="submit">
                {busy ? '…' : 'Add'}
              </button>
            </div>
            {error && <span className="field__error">{error}</span>}
          </form>
        ) : (
          <p className="small muted">
            {decision.settings.allowNominations ? "You've used all 5 of your nominations." : 'The host is choosing the options for this one.'}
          </p>
        )}
      </div>
      {viewer.isHost && decision.options.length >= 2 && (
        <p className="small muted" style={{ textAlign: 'center' }}>
          Happy with the list? Open voting from the host panel. Signed in as {user.name}.
        </p>
      )}
    </div>
  );
}

/* ---------------- Voting ---------------- */

function Voting({ data, onUpdate }) {
  const { decision, viewer } = data;
  const toast = useToast();
  const [editing, setEditing] = useState(!viewer.myBallot);
  const [ranking, setRanking] = useState(viewer.myBallot?.ranking || []);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const labels = useMemo(() => Object.fromEntries(decision.options.map((o) => [o.id, o.label])), [decision.options]);

  useEffect(() => {
    if (!viewer.myBallot) setEditing(true);
  }, [viewer.myBallot]);

  async function submit() {
    if (ranking.length === 0) {
      toast.error('Rank at least one option first.');
      return;
    }
    setBusy(true);
    try {
      const res = await api(`/decisions/${decision.code}/ballot`, { method: 'PUT', body: { ranking } });
      onUpdate(res);
      setEditing(false);
      toast.success(viewer.myBallot ? 'Ballot updated' : 'Ballot cast! You can change it until voting closes.');
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) onUpdate(await api(`/decisions/${decision.code}`));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setWithdrawing(true);
    try {
      onUpdate(await api(`/decisions/${decision.code}/ballot`, { method: 'DELETE' }));
      setRanking([]);
      setEditing(true);
      toast.info('Ballot withdrawn');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWithdrawing(false);
    }
  }

  if (!editing && viewer.myBallot) {
    return (
      <div className="card stack">
        <div className="card__header" style={{ marginBottom: 0 }}>
          <div>
            <h3 className="h3">Your ballot is in ✓</h3>
            <p className="small muted">
              Revision {viewer.myBallot.revision} · {formatDate(viewer.myBallot.updatedAt)}
            </p>
          </div>
          <span className="badge badge--closed">Counted</span>
        </div>
        <div className="option-list">
          {viewer.myBallot.ranking.map((id, i) => (
            <div key={id} className="option-chip">
              <span className="option-chip__num">#{i + 1}</span>
              <span className="option-chip__label">{labels[id] || 'Removed option'}</span>
            </div>
          ))}
        </div>
        <div className="ballot__foot">
          <span className="small muted">Changed your mind? You can edit until voting closes.</span>
          <span className="row" style={{ gap: 8 }}>
            <button className="btn btn--subtle btn--sm" onClick={withdraw} disabled={withdrawing}>
              {withdrawing ? 'Withdrawing…' : 'Withdraw'}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setRanking(viewer.myBallot.ranking);
                setEditing(true);
              }}
            >
              Edit ballot
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card stack">
      <div>
        <h3 className="h3">{viewer.myBallot ? 'Edit your ballot' : 'Rank the options'}</h3>
        <p className="small muted">
          Put your favourite first. If it gets eliminated, your vote moves to the next one down. You don't have to rank everything.
        </p>
      </div>
      <RankBallot options={decision.options} value={ranking} onChange={setRanking} />
      <div className="ballot__foot">
        <span className="small muted">
          {ranking.length === 0 ? 'Nothing ranked yet' : `${pluralize(ranking.length, 'option')} ranked`}
        </span>
        <span className="row" style={{ gap: 8 }}>
          {viewer.myBallot && (
            <button className="btn btn--subtle" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          <button className="btn btn--lime" onClick={submit} disabled={busy || ranking.length === 0}>
            {busy ? <span className="spinner spinner--sm" /> : viewer.myBallot ? 'Save changes' : 'Cast ballot'}
          </button>
        </span>
      </div>
    </div>
  );
}

/* ---------------- Results wrapper ---------------- */

function Results({ decision, live }) {
  const { data, error, loading } = usePolling(`/decisions/${decision.code}/results`, { enabled: live, interval: 5000 });
  if (loading) return <Loading label="Counting ballots…" />;
  if (error) return <ErrorBox>{error.message}</ErrorBox>;
  if (!data) return null;
  return <ResultsView decision={data.decision} results={data.results} ballots={data.ballots} autoplay={!live} />;
}

/* ---------------- Page ---------------- */

export default function DecisionRoom() {
  const { code } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState('vote');
  const [joining, setJoining] = useState(false);

  const { data, error, loading, setData, refresh } = usePolling(`/decisions/${code.toUpperCase()}`, {
    enabled: true,
    interval: 6000,
  });

  const decision = data?.decision;
  const viewer = data?.viewer;

  // Reset tab when phase changes.
  useEffect(() => {
    if (decision?.phase === 'closed') setTab('results');
    else if (decision?.phase === 'voting') setTab((t) => (t === 'results' && !viewer?.canSeeResults ? 'vote' : t));
  }, [decision?.phase, viewer?.canSeeResults]);

  if (loading) return <Loading label="Opening the room…" />;
  if (error) {
    return (
      <main className="page page--narrow">
        <Empty
          icon={error.status === 404 ? '🔎' : '⚠️'}
          title={error.status === 404 ? 'No decision with that code' : 'Could not load this decision'}
          action={
            <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
              <Link to="/join" className="btn btn--primary">
                Try another code
              </Link>
              <button className="btn btn--ghost" onClick={refresh}>
                Retry
              </button>
            </div>
          }
        >
          {error.message}
        </Empty>
      </main>
    );
  }
  if (!decision) return null;

  async function join() {
    setJoining(true);
    try {
      setData(await api(`/decisions/${decision.code}/join`, { method: 'POST' }));
      toast.success(`You're in! ${decision.phase === 'voting' ? 'Rank the options below.' : ''}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  // Merge an API response into the room state, then silently re-fetch so the
  // participant / voter lists (which mutation responses don't carry) catch up.
  const onUpdate = (payload) => {
    setData((prev) => ({ ...prev, ...payload, viewer: { ...prev.viewer, ...payload.viewer } }));
    refresh();
  };

  if (!viewer.hasJoined) {
    return (
      <main className="page page--narrow">
        <motion.div className="card card--glow stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="row row--between">
            <PhaseBadge phase={decision.phase} />
            <span className="mono small muted">{decision.code}</span>
          </div>
          <div>
            <div className="eyebrow">You're invited</div>
            <h1 className="h1" style={{ marginTop: 6 }}>
              {decision.title}
            </h1>
            {decision.description && (
              <p className="muted" style={{ marginTop: 8 }}>
                {decision.description}
              </p>
            )}
          </div>
          <div className="row small muted">
            <Avatar name={decision.host.name} hue={decision.host.hue} size="sm" /> Hosted by {decision.host.name} ·{' '}
            {pluralize(decision.participantCount, 'participant')} · {pluralize(decision.options.length, 'option')}
          </div>
          {decision.phase === 'closed' ? (
            <div className="warn-box">This decision is already closed. Only people who joined can see the result.</div>
          ) : (
            <button className="btn btn--primary btn--lg btn--block" onClick={join} disabled={joining}>
              {joining ? 'Joining…' : decision.phase === 'voting' ? 'Join & vote' : 'Join & nominate'}
            </button>
          )}
          <Link to="/app" className="btn btn--subtle btn--sm">
            ← Back to dashboard
          </Link>
        </motion.div>
      </main>
    );
  }

  const showTabs = decision.phase === 'voting' && viewer.canSeeResults;
  const votersVisible = Array.isArray(data.voters);
  const votedIds = new Set((data.voters || []).map((v) => v.id));

  return (
    <main className="page page--wide">
      <div className="room-head">
        <div>
          <div className="row row--wrap" style={{ gap: 10 }}>
            <PhaseBadge phase={decision.phase} />
            <span className="small muted">
              Hosted by <strong style={{ color: 'var(--text-2)' }}>{decision.host.name}</strong> · created {relativeTime(decision.createdAt)}
            </span>
          </div>
          <h1 className="room-head__title">{decision.title}</h1>
          {decision.description && (
            <p className="muted" style={{ maxWidth: 680 }}>
              {decision.description}
            </p>
          )}
        </div>
        <PhaseTrack phase={decision.phase} />
      </div>

      <div className="room-layout">
        <div className="stack stack--lg">
          {showTabs && (
            <div className="rounds-nav">
              <button className={`round-tab ${tab === 'vote' ? 'round-tab--active' : ''}`} onClick={() => setTab('vote')}>
                Your ballot
              </button>
              <button className={`round-tab ${tab === 'results' ? 'round-tab--active' : ''}`} onClick={() => setTab('results')}>
                Live results{viewer.isHost && !decision.settings.liveResults ? ' (host only)' : ''}
              </button>
            </div>
          )}

          {decision.phase === 'nominating' && <Nominations data={data} onUpdate={onUpdate} />}

          {decision.phase === 'voting' && tab === 'vote' && (
            <>
              {decision.closedBy === null && decision.deadline && new Date(decision.deadline) - Date.now() < 36e5 && (
                <div className="warn-box">Voting closes {relativeTime(decision.deadline)}. Make sure your ballot is in.</div>
              )}
              <Voting data={data} onUpdate={onUpdate} />
            </>
          )}

          {((decision.phase === 'voting' && tab === 'results') || decision.phase === 'closed') && (
            <>
              {decision.phase === 'closed' && (
                <div className="row row--wrap small muted" style={{ gap: 8 }}>
                  <span>
                    Closed {decision.closedBy === 'deadline' ? 'automatically at the deadline' : 'by the host'} · {formatDate(decision.closedAt)}
                  </span>
                  {viewer.myBallot ? <span className="tick">✓ Your ballot counted</span> : <span>You didn't vote on this one.</span>}
                </div>
              )}
              <Results decision={decision} live={decision.phase === 'voting'} />
            </>
          )}
        </div>

        <aside className="room-side">
          {decision.phase !== 'closed' && <ShareCard code={decision.code} />}

          {decision.phase === 'voting' && decision.deadline && (
            <div className="card stack" style={{ gap: 10 }}>
              <div className="row row--between">
                <span className="eyebrow">Closes in</span>
                <span className="small muted">{formatDate(decision.deadline)}</span>
              </div>
              <Countdown to={decision.deadline} onExpire={refresh} />
            </div>
          )}

          <div className="card stack">
            <div className="stat-row">
              <div className="stat">
                <div className="stat__num">{decision.participantCount}</div>
                <div className="stat__label">Joined</div>
              </div>
              <div className="stat">
                <div className="stat__num">{decision.ballotCount}</div>
                <div className="stat__label">Ballots</div>
              </div>
              <div className="stat">
                <div className="stat__num">{decision.options.length}</div>
                <div className="stat__label">Options</div>
              </div>
            </div>
            {decision.settings.minBallots > 0 && (
              <p className="small muted">
                Quorum: {decision.ballotCount}/{decision.settings.minBallots} ballots
              </p>
            )}
            <div className="people">
              {(data.participants || []).map((p) => (
                <div key={p.id} className="person">
                  <Avatar name={p.name} hue={p.hue} size="sm" />
                  <span className="person__name">
                    {p.name}
                    {p.id === decision.host.id && <span className="muted"> · host</span>}
                  </span>
                  {votersVisible && decision.phase !== 'nominating' && votedIds.has(p.id) && <span className="tick">✓ voted</span>}
                </div>
              ))}
            </div>
            {!votersVisible && decision.phase !== 'nominating' && <p className="small muted">Ballots are anonymous.</p>}
          </div>

          {viewer.isHost && <HostPanel decision={decision} onUpdate={onUpdate} />}
        </aside>
      </div>
    </main>
  );
}
