import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="page page--narrow" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="h-display grad-text">404</div>
      <p className="lead" style={{ marginTop: 10 }}>
        That page got eliminated in round one.
      </p>
      <Link to="/" className="btn btn--primary" style={{ marginTop: 24 }}>
        Back home
      </Link>
    </main>
  );
}
