/* sys lib */
import { Injectable, signal } from "@angular/core";

/* models */
import { WidgetFilter, PlatformType, ChatMessageEmote } from "@models/chat.model";
export interface OverlayChatMessage {
  id: string;
  platform: PlatformType;
  author: string;
  text: string;
  timestamp: string;
  isSupporter: boolean;
  sourceChannelId?: string;
  authorAvatarUrl?: string;
  channelImageUrl?: string; // Channel profile image for multi-channel overlays
  emotes?: ChatMessageEmote[];
}

interface OverlayWsOverlayMessageEnvelope {
  type: string;
  message?: {
    id: string;
    platform: string;
    author: string;
    text: string;
    timestamp: string;
    isSupporter: boolean;
    sourceChannelId?: string;
    authorAvatarUrl?: string;
    channelImageUrl?: string;
    emotes?: ChatMessageEmote[];
  };
}

export interface OverlayConnectOptions {
  port: number;
  widgetId: string;
  filter: WidgetFilter;
  channelIds?: string[];
  preserveMessages?: boolean; // If true, keep existing messages on reconnect
}

@Injectable({
  providedIn: "root",
})
export class OverlayWsStateService {
  private socket: WebSocket | null = null;
  private currentKey: string | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10; // Increased from 5 for better reliability
  private readonly reconnectDelay = 2000; // Increased from 1000ms for stability
  private pendingOptions: OverlayConnectOptions | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  private readonly messagesSignal = signal<OverlayChatMessage[]>([]);
  readonly messages = this.messagesSignal.asReadonly();

  connect(opts: OverlayConnectOptions): void {
    console.log('[OverlayWsState] connect called with:', opts);
    
    // Don't reconnect if already connected with same params
    const key = `${opts.port}:${opts.widgetId}:${opts.filter}:${opts.channelIds?.join(",") ?? ""}`;
    if (this.currentKey === key && this.socket?.readyState === WebSocket.OPEN) {
      console.log('[OverlayWsState] Already connected with same params');
      return;
    }

    // Close existing connection
    this.socket?.close();

    this.currentKey = key;
    this.pendingOptions = opts;

    // Only clear messages on initial connect, not on automatic reconnection
    // This prevents messages from disappearing during brief network issues
    const shouldPreserveMessages = opts.preserveMessages ?? this.reconnectAttempts > 0;
    if (!shouldPreserveMessages) {
      console.log('[OverlayWsState] Clearing messages');
      this.messagesSignal.set([]);
    }

    this.reconnectAttempts = 0;
    this.connectionState = 'connecting';
    console.log('[OverlayWsState] Connection state: connecting');

    const wsUrl = `ws://127.0.0.1:${opts.port}/ws/overlay?widgetId=${encodeURIComponent(
      opts.widgetId
    )}&role=overlay`;
    console.log('[OverlayWsState] Connecting to:', wsUrl);

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.connectionState = 'connected';
      console.log('[OverlayWsState] Connection opened, state: connected');
      const subscribe = {
        type: "subscribe",
        subscribe: {
          widgetId: opts.widgetId,
          filter: opts.filter,
          channelIds: opts.channelIds,
        },
      };
      console.log('[OverlayWsState] Sending subscribe:', subscribe);
      this.socket?.send(JSON.stringify(subscribe));
    };

    this.socket.onmessage = (ev) => {
      const data = ev.data;
      if (typeof data !== "string") {
        return;
      }

      let parsed: OverlayWsOverlayMessageEnvelope;
      try {
        parsed = JSON.parse(data) as OverlayWsOverlayMessageEnvelope;
      } catch {
        console.error("[OverlayWsState] Failed to parse message:", data);
        return;
      }

      if (parsed.type !== "overlayMessage" || !parsed.message) {
        console.warn('[OverlayWsState] Received invalid message type:', parsed.type);
        return;
      }

      console.log('[OverlayWsState] Received message:', parsed.message.id, '| channel:', parsed.message.sourceChannelId, '| text:', parsed.message.text.substring(0, 50));

      const msg: OverlayChatMessage = {
        id: parsed.message.id,
        platform: toPlatformType(parsed.message.platform),
        author: parsed.message.author,
        text: parsed.message.text,
        timestamp: parsed.message.timestamp,
        isSupporter: !!parsed.message.isSupporter,
        sourceChannelId: parsed.message.sourceChannelId,
        authorAvatarUrl: parsed.message.authorAvatarUrl,
        channelImageUrl: parsed.message.channelImageUrl,
        emotes: parsed.message.emotes,
      };

      this.messagesSignal.update((current) => upsertAndSort(current, msg));
      console.log('[OverlayWsState] Message added to signal, total messages:', this.messagesSignal().length, '| filtered by channels:', opts.channelIds);
    };

    this.socket.onerror = (event) => {
      console.error('[OverlayWsState] WebSocket error:', event);
      this.connectionState = 'disconnected';
    };

    this.socket.onclose = (event) => {
      console.log('[OverlayWsState] WebSocket closed, code:', event.code, 'reason:', event.reason || 'none');
      this.connectionState = 'disconnected';
      // Attempt to reconnect
      this.attemptReconnect(opts);
    };
  }

  /**
   * Add a message directly (used when polling from backend)
   */
  addMessage(message: OverlayChatMessage): void {
    this.messagesSignal.update((current) => upsertAndSort(current, message));
  }

  /**
   * Set messages directly (used when polling from backend)
   */
  setMessages(messages: OverlayChatMessage[]): void {
    this.messagesSignal.set(messages);
  }

  private async attemptReconnect(opts: OverlayConnectOptions): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    // Don't reconnect if connection state changed (user navigated away, etc)
    if (this.pendingOptions !== opts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Check again after delay
    if (this.pendingOptions === opts) {
      this.connect(opts);
    }
  }
}

function toPlatformType(platform: string): PlatformType {
  const p = platform.toLowerCase();
  if (p === "twitch" || p === "kick" || p === "youtube") {
    return p;
  }
  return "twitch";
}

function upsertAndSort(
  current: OverlayChatMessage[],
  next: OverlayChatMessage
): OverlayChatMessage[] {
  const index = current.findIndex((m) => m.id === next.id);
  const merged =
    index === -1 ? [...current, next] : current.map((m) => (m.id === next.id ? next : m));

  return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
