const LABELS = {
  nominating: 'Collecting options',
  voting: 'Voting open',
  closed: 'Decided',
};

export default function PhaseBadge({ phase }) {
  return (
    <span className={`badge badge--${phase}`}>
      <span className="badge__dot" />
      {LABELS[phase] || phase}
    </span>
  );
}

export function PhaseTrack({ phase }) {
  const steps = [
    { key: 'nominating', label: 'Nominate' },
    { key: 'voting', label: 'Rank & vote' },
    { key: 'closed', label: 'Result' },
  ];
  const idx = steps.findIndex((s) => s.key === phase);
  return (
    <div className="phase-track" aria-label="Decision progress">
      {steps.map((s, i) => (
        <span key={s.key} className="row" style={{ gap: 6 }}>
          <span
            className={`phase-track__step ${i < idx ? 'phase-track__step--done' : ''} ${i === idx ? 'phase-track__step--active' : ''}`}
          >
            <span className="phase-track__num">{i < idx ? '✓' : i + 1}</span>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="phase-track__arrow">→</span>}
        </span>
      ))}
    </div>
  );
}
