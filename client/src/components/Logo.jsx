import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="Tiebreak home">
      <span className="logo__mark" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
          <path d="M14 20h36M14 32h24M14 44h12" stroke="white" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="44" r="7" fill="#d4ff4a" />
        </svg>
      </span>
      Tiebreak
    </Link>
  );
}
