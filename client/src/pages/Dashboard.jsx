import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import PhaseBadge from '../components/PhaseBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import { Empty, ErrorBox, Skeleton } from '../components/Feedback.jsx';
import { relativeTime, pluralize } from '../lib/format.js';

function DecisionCard({ d, attention }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link to={`/d/${d.code}`} className={`dcard ${attention ? 'dcard--attention' : ''}`}>
        <div className="row row--between">
          <PhaseBadge phase={d.phase} />
          <span className="mono small muted">{d.code}</span>
        </div>
        <div className="dcard__title">{d.title}</div>
        <div className="dcard__meta">
          <span>{pluralize(d.options.length, 'option')}</span>
          <span>·</span>
          <span>{pluralize(d.ballotCount, 'ballot')}</span>
          {d.phase === 'voting' && d.deadline && (
            <>
              <span>·</span>
              <span style={{ color: new Date(d.deadline) - Date.now() < 36e5 ? 'var(--coral)' : undefined }}>closes {relativeTime(d.deadline)}</span>
            </>
          )}
        </div>
        <div className="dcard__foot">
          <span className="row small muted" style={{ gap: 8 }}>
            <Avatar name={d.host.name} hue={d.host.hue} size="sm" />
            {d.viewer.isHost ? 'You host' : d.host.name}
          </span>
          {d.phase === 'voting' && (d.viewer.hasVoted ? <span className="tick">✓ Voted</span> : <span className="badge badge--voting">Vote now</span>)}
          {d.phase === 'closed' && <span className="small muted">Decided {relativeTime(d.closedAt)}</span>}
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, decisions: [] });

  useEffect(() => {
    let cancelled = false;
    api('/decisions')
      .then((data) => !cancelled && setState({ loading: false, error: null, decisions: data.decisions }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, decisions: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { decisions, loading, error } = state;
  const needsVote = decisions.filter((d) => d.phase === 'voting' && !d.viewer.hasVoted);
  const active = decisions.filter((d) => d.phase !== 'closed' && !needsVote.includes(d));
  const closed = decisions.filter((d) => d.phase === 'closed');

  return (
    <main className="page">
      <div className="dash-head">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1 className="h1" style={{ marginTop: 6 }}>
            Hey {user.name.split(' ')[0]} 👋
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {decisions.length === 0 ? "You're not part of any decisions yet." : `You're part of ${pluralize(decisions.length, 'decision')}.`}
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link to="/join" className="btn btn--ghost">
            Enter a code
          </Link>
          <Link to="/new" className="btn btn--primary">
            + New decision
          </Link>
        </div>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {loading ? (
        <div className="decision-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dcard">
              <Skeleton h={22} w={110} />
              <Skeleton h={26} w="80%" />
              <Skeleton h={16} w="60%" />
            </div>
          ))}
        </div>
      ) : decisions.length === 0 && !error ? (
        <Empty
          icon="🗳️"
          title="Nothing to decide yet"
          action={
            <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
              <Link to="/new" className="btn btn--primary">
                Create your first decision
              </Link>
              <Link to="/join" className="btn btn--ghost">
                Join with a code
              </Link>
            </div>
          }
        >
          Start one for your group, or enter a code someone shared with you.
        </Empty>
      ) : (
        <>
          {needsVote.length > 0 && (
            <>
              <div className="section-title">
                Needs your vote <span className="count">{needsVote.length}</span>
              </div>
              <div className="decision-grid">
                {needsVote.map((d) => (
                  <DecisionCard key={d.id} d={d} attention />
                ))}
              </div>
            </>
          )}
          {active.length > 0 && (
            <>
              <div className="section-title">
                In progress <span className="count">{active.length}</span>
              </div>
              <div className="decision-grid">
                {active.map((d) => (
                  <DecisionCard key={d.id} d={d} />
                ))}
              </div>
            </>
          )}
          {closed.length > 0 && (
            <>
              <div className="section-title">
                Decided <span className="count">{closed.length}</span>
              </div>
              <div className="decision-grid">
                {closed.map((d) => (
                  <DecisionCard key={d.id} d={d} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
