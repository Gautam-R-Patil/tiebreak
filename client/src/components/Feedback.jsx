export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center" role="status">
      <div className="spinner" />
      <span className="small">{label}</span>
    </div>
  );
}

export function Empty({ icon = '✦', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="empty__title">{title}</div>
      <div className="small">{children}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function ErrorBox({ children }) {
  return (
    <div className="error-box" role="alert">
      {children}
    </div>
  );
}

export function Skeleton({ h = 20, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}
