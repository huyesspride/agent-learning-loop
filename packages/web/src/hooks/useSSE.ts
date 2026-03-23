import { useState, useEffect, useRef } from 'react';

export interface SseState<T> {
  data: T | null;
  error: string | null;
  isConnected: boolean;
}

export function useSSE<T>(url: string | null, enabled = true): SseState<T> {
  const [state, setState] = useState<SseState<T>>({
    data: null,
    error: null,
    isConnected: false,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url || !enabled) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setState(s => ({ ...s, isConnected: true, error: null }));

    es.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as T;
        setState(s => ({ ...s, data }));
      } catch {}
    });

    es.onerror = () => {
      setState(s => ({ ...s, isConnected: false, error: 'Connection lost' }));
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [url, enabled]);

  return state;
}
