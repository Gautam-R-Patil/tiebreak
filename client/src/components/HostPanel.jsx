import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { toLocalInputValue } from '../lib/format.js';

export default function HostPanel({ decision, onUpdate }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'close' | 'delete' | 'reopen'
  const [deadline, setDeadline] = useState(toLocalInputValue(decision.deadline));
  const [editingDeadline, setEditingDeadline] = useState(false);

  const belowQuorum = decision.settings.minBallots > 0 && decision.ballotCount < decision.settings.minBallots;

  async function run(label, fn) {
    setBusy(label);
    try {
      const data = await fn();
      if (data) onUpdate(data);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const phase = (action) => () => run(action, () => api(`/decisions/${decision.code}/phase`, { method: 'POST', body: { action } }));

  async function saveDeadline() {
    const ok = await run('deadline', () =>
      api(`/decisions/${decision.code}`, {
        method: 'PATCH',
        body: { deadline: deadline ? new Date(deadline).toISOString() : null },
      }),
    );
    if (ok) {
      setEditingDeadline(false);
      toast.success(deadline ? 'Deadline updated' : 'Deadline removed');
    }
  }

  async function toggleSetting(key) {
    await run(key, () =>
      api(`/decisions/${decision.code}`, { method: 'PATCH', body: { settings: { [key]: !decision.settings[key] } } }),
    );
  }

  async function remove() {
    const ok = await run('delete', async () => {
      await api(`/decisions/${decision.code}`, { method: 'DELETE' });
      return null;
    });
    if (ok) {
      toast.success('Decision deleted');
      navigate('/app');
    }
  }

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Host controls</div>
        <p className="small muted" style={{ marginTop: 4 }}>
          Only you can see this panel.
        </p>
      </div>

      {decision.phase === 'nominating' && (
        <>
          <button
            className="btn btn--lime btn--block"
            disabled={busy || decision.options.length < 2}
            onClick={phase('open_voting')}
          >
            {busy === 'open_voting' ? 'Opening…' : 'Open voting →'}
          </button>
          {decision.options.length < 2 && <p className="small muted">Add at least two options first.</p>}
        </>
      )}

      {decision.phase === 'voting' && (
        <>
          <button className="btn btn--primary btn--block" disabled={busy} onClick={() => setConfirm('close')}>
            Close voting &amp; reveal result
          </button>
          {belowQuorum && (
            <p className="small" style={{ color: 'var(--amber)' }}>
              Only {decision.ballotCount} of the {decision.settings.minBallots} ballots you asked for are in.
            </p>
          )}
        </>
      )}

      {decision.phase === 'closed' && (
        <button className="btn btn--ghost btn--block" disabled={busy} onClick={() => setConfirm('reopen')}>
          Reopen voting
        </button>
      )}

      {decision.phase !== 'closed' && (
        <>
          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="stack" style={{ gap: 8 }}>
            <div className="row row--between">
              <span className="small" style={{ fontWeight: 600 }}>
                Deadline
              </span>
              {!editingDeadline && (
                <button className="btn btn--subtle btn--sm" onClick={() => setEditingDeadline(true)}>
                  {decision.deadline ? 'Change' : 'Set one'}
                </button>
              )}
            </div>
            {editingDeadline && (
              <div className="stack" style={{ gap: 8 }}>
                <input
                  type="datetime-local"
                  className="input"
                  value={deadline}
                  min={toLocalInputValue(new Date(Date.now() + 5 * 60_000))}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn--primary btn--sm" style={{ flex: 1 }} disabled={busy} onClick={saveDeadline}>
                    Save
                  </button>
                  {decision.deadline && (
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => {
                        setDeadline('');
                        setTimeout(saveDeadline, 0);
                      }}
                    >
                      Remove
                    </button>
                  )}
                  <button className="btn btn--subtle btn--sm" onClick={() => setEditingDeadline(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 6 }}>
            {[
              ['allowNominations', 'Let participants add options'],
              ['liveResults', 'Show live results to everyone'],
              ['anonymousBallots', 'Anonymous ballots'],
            ].map(([key, label]) => (
              <label key={key} className="row row--between small" style={{ cursor: 'pointer' }}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={!!decision.settings[key]}
                  disabled={busy === key}
                  onChange={() => toggleSetting(key)}
                  style={{ accentColor: 'var(--violet)', width: 16, height: 16 }}
                />
              </label>
            ))}
          </div>
        </>
      )}

      <div className="divider" style={{ margin: '4px 0' }} />
      <button className="btn btn--danger btn--sm btn--block" disabled={busy} onClick={() => setConfirm('delete')}>
        Delete decision
      </button>

      <Modal
        open={confirm === 'close'}
        title="Close voting now?"
        onClose={() => setConfirm(null)}
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setConfirm(null)}>
              Keep it open
            </button>
            <button
              className="btn btn--primary"
              onClick={async () => {
                setConfirm(null);
                await phase('close')();
              }}
            >
              Close &amp; reveal
            </button>
          </>
        }
      >
        {decision.ballotCount} {decision.ballotCount === 1 ? 'ballot has' : 'ballots have'} been cast. Once closed, no one can vote or change their
        ballot and the result becomes final for everyone.
        {belowQuorum && (
          <>
            <br />
            <br />
            <strong style={{ color: 'var(--amber)' }}>Heads up:</strong> that is below the quorum of {decision.settings.minBallots} you set. The result
            will be flagged.
          </>
        )}
      </Modal>

      <Modal
        open={confirm === 'reopen'}
        title="Reopen voting?"
        onClose={() => setConfirm(null)}
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={async () => {
                setConfirm(null);
                await phase('reopen_voting')();
              }}
            >
              Reopen
            </button>
          </>
        }
      >
        Existing ballots are kept and people can change them again. An expired deadline will be cleared.
      </Modal>

      <Modal
        open={confirm === 'delete'}
        title="Delete this decision?"
        onClose={() => setConfirm(null)}
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn--danger" onClick={remove} disabled={busy === 'delete'}>
              {busy === 'delete' ? 'Deleting…' : 'Delete for everyone'}
            </button>
          </>
        }
      >
        This permanently removes the decision and all {decision.ballotCount} ballots. This cannot be undone.
      </Modal>
    </div>
  );
}
