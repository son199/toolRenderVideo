/**
 * WebSocket client for project progress events.
 *
 * The Vite dev server proxies `/ws/*` to `ws://localhost:8000/ws/*` (see
 * vite.config.ts). In production, the same path should point at the backend.
 */

export interface ProgressEvent {
  project_id: string;
  stage: string; // queued | ingest | storyboard | tts | render | done | error
  progress: number; // 0.0 - 1.0
  message: string;
  payload?: Record<string, unknown> | null;
  timestamp: string;
}

export interface ProjectEventSubscription {
  close: () => void;
}

export function subscribeProjectEvents(
  projectId: string,
  onEvent: (event: ProgressEvent) => void,
  options?: { onClose?: () => void; onError?: (err: Event) => void },
): ProjectEventSubscription {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/ws/projects/${projectId}/events`;

  const ws = new WebSocket(url);
  let closedByUs = false;

  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as ProgressEvent);
    } catch (e) {
      console.warn("[ws] parse error:", e, msg.data);
    }
  };

  ws.onclose = () => {
    if (!closedByUs) options?.onClose?.();
  };

  ws.onerror = (err) => {
    options?.onError?.(err);
  };

  return {
    close() {
      closedByUs = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
  };
}
