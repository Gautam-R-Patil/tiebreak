import { useEffect, useState } from 'react';
import { countdownParts } from '../lib/format.js';

export default function Countdown({ to, onExpire }) {
  const [now, setNow] = useState(Date.now());
  const target = to ? new Date(to).getTime() : null;

  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    if (target && now >= target && onExpire) onExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target && now >= target]);

  if (!target) return null;
  const ms = target - now;
  const { days, hours, minutes, seconds } = countdownParts(ms);
  const urgent = ms < 36e5;
  const units = days > 0 ? [[days, 'days'], [hours, 'hrs'], [minutes, 'min']] : [[hours, 'hrs'], [minutes, 'min'], [seconds, 'sec']];
  return (
    <div className={`countdown ${urgent ? 'countdown--urgent' : ''}`} role="timer">
      {units.map(([n, label]) => (
        <div key={label} className="countdown__unit">
          <div className="countdown__num">{String(n).padStart(2, '0')}</div>
          <div className="countdown__label">{label}</div>
        </div>
      ))}
    </div>
  );
}
