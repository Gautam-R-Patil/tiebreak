import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Avatar from './Avatar.jsx';
import { pct, pluralize, formatDate } from '../lib/format.js';

const TIE_LABEL = {
  borda: 'tie broken by overall ranking (Borda)',
  mentions: 'tie broken by how many ballots ranked it',
  order: 'tie broken by nomination order',
};

export default function ResultsView({ decision, results, ballots, autoplay = true }) {
  const { rounds, winner, tie, condorcetWinner, condorcetAgrees, totalBallots, quorumMet, minBallots, isFinal, pairwise, finalRanking } = results;
  const labels = useMemo(() => Object.fromEntries(decision.options.map((o) => [o.id, o.label])), [decision.options]);
  const [round, setRound] = useState(rounds.length - 1);
  const [playing, setPlaying] = useState(autoplay && rounds.length > 1);

  // Autoplay through the rounds the first time results open — a little drama.
  useEffect(() => {
    if (!playing) return undefined;
    setRound(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= rounds.length) {
        clearInterval(id);
        setPlaying(false);
        setRound(rounds.length - 1);
      } else {
        setRound(i);
      }
    }, 1300);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Keep the selected round valid when results refresh (live mode).
  useEffect(() => {
    if (!playing) setRound((r) => Math.min(r, rounds.length - 1));
  }, [rounds.length, playing]);

  if (totalBallots === 0) {
    return (
      <div className="empty">
        <div className="empty__icon">🗳️</div>
        <div className="empty__title">No ballots yet</div>
        <div className="small">Results will appear as soon as the first ballot comes in.</div>
      </div>
    );
  }

  const current = rounds[Math.max(0, Math.min(round, rounds.length - 1))];
  const eliminatedBefore = new Set(rounds.slice(0, round).flatMap((r) => r.eliminated));
  const active = Object.keys(current.tallies);
  const ordered = [...active].sort((a, b) => current.tallies[b] - current.tallies[a]);
  const outIds = decision.options.map((o) => o.id).filter((id) => eliminatedBefore.has(id));
  const maxVotes = Math.max(1, ...Object.values(current.tallies));
  const scale = Math.max(maxVotes, current.majority || 1);

  return (
    <div className="stack stack--lg">
      {winner && (
        <motion.div className="winner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="winner__label">{isFinal ? 'Final decision' : 'Leading right now'}</div>
          <div className="winner__name">{labels[winner]}</div>
          <div className="winner__meta">
            <span className="badge badge--neutral">
              {rounds.length === 1 ? 'Won outright in round 1' : `Won in round ${rounds.length}`}
            </span>
            <span className="badge badge--neutral">{pluralize(totalBallots, 'ballot')}</span>
            {condorcetAgrees === true && (
              <span className="badge badge--closed" title="Beats every other option head-to-head">
                ★ Also wins every head-to-head
              </span>
            )}
            {condorcetAgrees === false && (
              <span className="badge badge--cyan" title="A different option would beat every other option in one-on-one matchups">
                ⚖ {labels[condorcetWinner]} wins all head-to-heads
              </span>
            )}
            {tie && <span className="badge badge--coral">Exact tie — settled by nomination order</span>}
            {!quorumMet && <span className="badge badge--coral">Quorum not met ({totalBallots}/{minBallots})</span>}
          </div>
        </motion.div>
      )}

      <div className="card stack">
        <div className="card__header" style={{ marginBottom: 0 }}>
          <div>
            <h3 className="h3">How the runoff played out</h3>
            <p className="small muted">
              Each round counts every ballot's top remaining choice. No majority? The last place option is dropped and its voters' next choices count instead.
            </p>
          </div>
        </div>
        <div className="rounds-nav">
          {rounds.map((r, i) => (
            <button
              key={r.round}
              className={`round-tab ${i === round ? 'round-tab--active' : ''} ${r.winner ? 'round-tab--final' : ''}`}
              onClick={() => {
                setPlaying(false);
                setRound(i);
              }}
            >
              Round {r.round}
              {r.winner ? ' ✓' : ''}
            </button>
          ))}
          {rounds.length > 1 && (
            <button className="btn btn--subtle btn--sm" onClick={() => setPlaying(true)} disabled={playing}>
              {playing ? 'Playing…' : '▶ Replay'}
            </button>
          )}
        </div>

        <div className="round-summary">
          <span>
            <strong>{current.live}</strong> active {current.live === 1 ? 'ballot' : 'ballots'}
          </span>
          <span>·</span>
          <span>
            majority needs <strong>{current.majority}</strong>
          </span>
          {current.exhausted > 0 && (
            <>
              <span>·</span>
              <span>{pluralize(current.exhausted, 'exhausted ballot')}</span>
            </>
          )}
        </div>

        <div className="tally">
          <AnimatePresence initial={false}>
            {ordered.map((id) => {
              const votes = current.tallies[id];
              const isWinner = current.winner === id;
              const isEliminated = current.eliminated.includes(id);
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`tally__row ${isWinner ? 'tally__row--winner' : ''} ${isEliminated ? 'tally__row--eliminated' : ''}`}
                >
                  <div className="tally__top">
                    <span>{labels[id]}</span>
                    {isWinner && <span className="badge badge--closed">Winner</span>}
                    {isEliminated && <span className="badge badge--coral">Eliminated</span>}
                    <span className="tally__count">
                      {votes} · {pct(votes, current.live)}%
                    </span>
                  </div>
                  <div className="tally__track">
                    <motion.div
                      className="tally__fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${(votes / scale) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                    {current.majority > 0 && (
                      <span className="tally__majority" style={{ left: `${(current.majority / scale) * 100}%` }} title="Majority line" />
                    )}
                  </div>
                  {isEliminated && current.tieBreak && <div className="tally__note">Lowest, {TIE_LABEL[current.tieBreak]}.</div>}
                </motion.div>
              );
            })}
            {outIds.map((id) => (
              <motion.div key={id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tally__row tally__row--out">
                <div className="tally__top">
                  <span>{labels[id]}</span>
                  <span className="badge badge--neutral">Out</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="h3" style={{ marginBottom: 12 }}>
            Final standings
          </h3>
          <div className="option-list">
            {finalRanking.map((id, i) => (
              <div key={id} className="option-chip">
                <span className="option-chip__num">#{i + 1}</span>
                <span className="option-chip__label">{labels[id]}</span>
                <span className="option-chip__meta">{pluralize(results.firstChoice[id] || 0, 'first pick')}</span>
              </div>
            ))}
          </div>
        </div>

        <details className="collapsible card" style={{ padding: '0 22px' }}>
          <summary>Head-to-head matrix</summary>
          <p className="small muted" style={{ marginBottom: 10 }}>
            How many ballots prefer the row option over the column option.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="matrix">
              <thead>
                <tr>
                  <th>vs</th>
                  {decision.options.map((o) => (
                    <th key={o.id}>{o.label.slice(0, 10)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decision.options.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    {decision.options.map((b) => {
                      if (a.id === b.id) return <td key={b.id} className="self">—</td>;
                      const ab = pairwise[a.id]?.[b.id] ?? 0;
                      const ba = pairwise[b.id]?.[a.id] ?? 0;
                      return (
                        <td key={b.id} className={ab > ba ? 'win' : ab < ba ? 'lose' : ''}>
                          {ab}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {ballots && ballots.length > 0 && (
        <details className="collapsible card" style={{ padding: '0 22px' }}>
          <summary>Ballots ({ballots.length})</summary>
          <div className="ballot-list">
            {ballots.map((b) => (
              <div key={b.voter.id} className="ballot-row">
                <Avatar name={b.voter.name} hue={b.voter.hue} size="sm" />
                <strong style={{ minWidth: 80 }}>{b.voter.name}</strong>
                <span className="ballot-row__ranking">
                  {b.ranking.map((id, i) => (
                    <span key={id}>
                      {i + 1}. {labels[id] || '?'}
                    </span>
                  ))}
                </span>
                <span className="muted small" style={{ marginLeft: 'auto' }}>
                  {formatDate(b.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {decision.settings.anonymousBallots && (
        <p className="small muted" style={{ textAlign: 'center' }}>
          Ballots are anonymous for this decision. Only totals are shown.
        </p>
      )}
    </div>
  );
}
