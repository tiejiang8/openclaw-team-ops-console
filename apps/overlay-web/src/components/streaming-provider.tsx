import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { StreamingEventDto, StreamingEventType } from "@openclaw-team-ops/shared";

import { API_BASE_URL } from "../lib/api.js";

type Listener = (event: StreamingEventDto) => void;

interface StreamingContextType {
  lastEvent: StreamingEventDto | null;
  addListener: (type: StreamingEventType | "*", listener: Listener) => () => void;
  connected: boolean;
}

const StreamingContext = createContext<StreamingContextType | null>(null);

interface StreamRefreshOptions {
  enabled?: boolean;
  throttleMs?: number;
}

export function StreamingProvider({ children }: { children: React.ReactNode }) {
  const [lastEvent, setLastEvent] = useState<StreamingEventDto | null>(null);
  const [connected, setConnected] = useState(false);
  const listeners = useRef<Map<string, Set<Listener>>>(new Map());

  const addListener = (type: StreamingEventType | "*", listener: Listener) => {
    if (!listeners.current.has(type)) {
      listeners.current.set(type, new Set());
    }
    listeners.current.get(type)!.add(listener);

    return () => {
      listeners.current.get(type)?.delete(listener);
    };
  };

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      const url = `${API_BASE_URL}/api/stream`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamingEventDto;
          setLastEvent(data);

          listeners.current.get(data.type)?.forEach((listener) => listener(data));
          listeners.current.get("*")?.forEach((listener) => listener(data));
        } catch {
          // Ignore malformed events and keep the stream alive.
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <StreamingContext.Provider value={{ lastEvent, addListener, connected }}>
      {children}
    </StreamingContext.Provider>
  );
}

export function useStreaming() {
  const context = useContext(StreamingContext);
  if (!context) {
    throw new Error("useStreaming must be used within a StreamingProvider");
  }
  return context;
}

export function useStreamRefresh(type: StreamingEventType, onRefresh: () => void, options: StreamRefreshOptions = {}) {
  const { addListener } = useStreaming();
  const lastRefreshAtRef = useRef(0);
  const enabled = options.enabled ?? true;
  const throttleMs = options.throttleMs ?? 0;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return addListener(type, () => {
      if (throttleMs > 0) {
        const now = Date.now();

        if (now - lastRefreshAtRef.current < throttleMs) {
          return;
        }

        lastRefreshAtRef.current = now;
      }

      onRefresh();
    });
  }, [addListener, enabled, onRefresh, throttleMs, type]);
}
