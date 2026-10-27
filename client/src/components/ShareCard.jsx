import { useState } from 'react';
import { useToast } from '../lib/toast.jsx';

export default function ShareCard({ code }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/d/${code}`;

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the code and copy it manually.");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vote on Tiebreak', text: `Help us decide — rank your choices on Tiebreak. Code ${code}`, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copy(url, 'Link');
  }

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Invite people</div>
        <p className="small muted" style={{ marginTop: 4 }}>
          Anyone with the code can join and vote once.
        </p>
      </div>
      <button className="share-code" onClick={() => copy(code, 'Code')} title="Click to copy">
        {code}
      </button>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => copy(url, 'Link')}>
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
        <button className="btn btn--primary btn--sm" style={{ flex: 1 }} onClick={share}>
          Share
        </button>
      </div>
    </div>
  );
}
