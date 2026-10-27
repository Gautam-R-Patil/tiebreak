import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/auth.jsx';

const DEMO = [
  ['Sushi', 100],
  ['Tacos', 74],
  ['Pizza', 52],
  ['Ramen', 30],
];

export default function Landing() {
  const { user, ready } = useAuth();
  if (ready && user) return <Navigate to="/app" replace />;

  return (
    <main className="page">
      <section className="hero">
        <div className="hero__blob hero__blob--a" />
        <div className="hero__blob hero__blob--b" />
        <div className="hero__blob hero__blob--c" />
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="eyebrow">Ranked-choice decisions for groups</div>
          <h1 className="h-display" style={{ marginTop: 14 }}>
            Decide together.
            <br />
            <span className="grad-text">No more spoiler votes.</span>
          </h1>
          <p className="lead" style={{ marginTop: 20, maxWidth: 520 }}>
            Tiebreak turns "where should we go?" into a fair result. Everyone ranks the options, and an instant runoff finds the choice the
            group actually prefers, not just the loudest one.
          </p>
          <div className="hero__actions">
            <Link to="/register" className="btn btn--primary btn--lg">
              Start a decision
            </Link>
            <Link to="/login?next=/join" className="btn btn--ghost btn--lg">
              I have a code
            </Link>
          </div>
          <div className="hero__meta">
            <span>✓ Free, no app install</span>
            <span>✓ One ballot per person</span>
            <span>✓ Results you can replay</span>
          </div>
        </motion.div>

        <motion.div
          className="demo-ballot"
          initial={{ opacity: 0, y: 30, rotate: -4 }}
          animate={{ opacity: 1, y: 0, rotate: -1.5 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          aria-hidden="true"
        >
          <div className="demo-ballot__title">
            Friday dinner <span className="badge badge--voting"><span className="badge__dot" />Voting open</span>
          </div>
          <div className="demo-ballot__list">
            {DEMO.map(([label, w], i) => (
              <motion.div
                key={label}
                className="demo-ballot__item"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.12 }}
              >
                <span className="demo-ballot__rank">{i + 1}</span>
                {label}
                <motion.span
                  className="demo-ballot__bar"
                  initial={{ width: 0 }}
                  animate={{ width: `${w * 0.9}px` }}
                  transition={{ delay: 0.7 + i * 0.12, duration: 0.6 }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="features">
        {[
          ['01', 'Nominate', 'Create a decision, share a 6-letter code. Everyone can throw options into the ring before voting opens.'],
          ['02', 'Rank', 'No single pick. Each person drags the options into their order of preference and casts one ballot. Change it any time before the deadline.'],
          ['03', 'Runoff', 'The last-place option is eliminated round by round and its votes flow to the next choice. Watch it play out, step by step.'],
        ].map(([n, title, body]) => (
          <div key={n} className="feature">
            <div className="feature__step">STEP {n}</div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </section>

      <section className="spoiler">
        <div>
          <div className="eyebrow">Why ranked?</div>
          <h2 className="h2" style={{ marginTop: 10 }}>
            Plain polls let 35% beat the other 65%.
          </h2>
          <p style={{ marginTop: 12, color: 'var(--text-2)' }}>
            When two similar options split the vote, the one most people would hate can sneak through. Ranked choice fixes that: if your
            favourite is eliminated, your vote moves to your next pick. The winner always has majority support among the ballots still
            counting.
          </p>
        </div>
        <div className="spoiler__bars">
          <div className="small muted" style={{ marginBottom: 4 }}>
            Plain vote
          </div>
          {[
            ['Steakhouse', 35, true],
            ['Thai place', 33],
            ['Thai (other)', 32],
          ].map(([l, v, win]) => (
            <div key={l} className="spoiler__bar">
              <span>{l}</span>
              <div className="spoiler__track">
                <div className={`spoiler__fill ${win ? 'spoiler__fill--win' : ''}`} style={{ width: `${v}%` }} />
              </div>
              <span className="mono small">{v}%</span>
            </div>
          ))}
          <div className="small muted" style={{ margin: '14px 0 4px' }}>
            Ranked choice, after runoff
          </div>
          {[
            ['Thai place', 65, true],
            ['Steakhouse', 35],
          ].map(([l, v, win]) => (
            <div key={l} className="spoiler__bar">
              <span>{l}</span>
              <div className="spoiler__track">
                <div className={`spoiler__fill ${win ? 'spoiler__fill--win' : ''}`} style={{ width: `${v}%` }} />
              </div>
              <span className="mono small">{v}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cta">
        <h2 className="h1">Ready to settle it?</h2>
        <p className="lead" style={{ marginTop: 10 }}>
          Takes about a minute to set up. Takes your group a lot less time to argue.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 24, gap: 12, flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn--lime btn--lg">
            Create a free account
          </Link>
          <Link to="/login" className="btn btn--ghost btn--lg">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
