import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Fetches `path` and re-fetches every `interval` ms while `enabled` is true and
 * the tab is visible. Cheap substitute for websockets on serverless hosting.
 */
export function usePolling(path, { enabled = true, interval = 6000, skip = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip });
  const timer = useRef(null);
  const alive = useRef(true);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (skip || !path) return null;
      if (!silent) setState((s) => ({ ...s, loading: s.data === null }));
      try {
        const data = await api(path);
        if (alive.current) setState({ data, error: null, loading: false });
        return data;
      } catch (err) {
        if (alive.current) setState((s) => ({ data: silent ? s.data : null, error: err, loading: false }));
        return null;
      }
    },
    [path, skip],
  );

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!enabled || skip) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    timer.current = setInterval(tick, interval);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, interval, load, skip]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, refresh: () => load({ silent: true }), setData };
}
