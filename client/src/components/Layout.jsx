import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import Avatar from './Avatar.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="nav">
        <div className="nav__inner">
          <Logo to={user ? '/app' : '/'} />
          <div className="nav__spacer" />
          <nav className="nav__links">
            {user ? (
              <>
                <NavLink to="/app" className="nav__link nav__link--hide-sm">
                  Dashboard
                </NavLink>
                <NavLink to="/join" className="nav__link nav__link--hide-sm">
                  Join
                </NavLink>
                <NavLink to="/new" className="btn btn--primary btn--sm">
                  + New<span className="nav__link--hide-sm">&nbsp;decision</span>
                </NavLink>
                <button
                  className="btn btn--subtle btn--sm"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  title={`Signed in as ${user.email}`}
                >
                  <Avatar name={user.name} hue={user.hue} size="sm" />
                  <span className="nav__link--hide-sm">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav__link">
                  Sign in
                </NavLink>
                <NavLink to="/register" className="btn btn--primary btn--sm">
                  Get started
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="footer">
        Tiebreak · ranked-choice decisions for groups · built with React, Express, MongoDB &amp; Netlify Functions
      </footer>
    </>
  );
}
