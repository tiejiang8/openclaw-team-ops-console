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
        console.log("SSE Connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamingEventDto;
          setLastEvent(data);

          // Notify listeners
          listeners.current.get(data.type)?.forEach(l => l(data));
          listeners.current.get("*")?.forEach(l => l(data));
        } catch (e) {
          console.error("Error parsing SSE message:", e);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        console.log("SSE Disconnected, reconnecting...");
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

export function useStreamRefresh(type: StreamingEventType, onRefresh: () => void) {
  const { addListener } = useStreaming();

  useEffect(() => {
    return addListener(type, () => {
      onRefresh();
    });
  }, [type, onRefresh, addListener]);
}
