/* sys lib */
import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

/* models */
import { ChatMessage, PlatformType } from "@models/chat.model";
type OverlaySourcePayload = {
  type: "chatMessage";
  message: {
    id: string;
    platform: PlatformType;
    author: string;
    text: string;
    timestamp: string;
    isSupporter: boolean;
    sourceChannelId: string;
    authorAvatarUrl?: string;
  };
};

@Injectable({
  providedIn: "root",
})
export class OverlaySourceBridgeService {
  private socket: WebSocket | null = null;
  private connectedPort: number | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10; // Increased from 5
  private readonly reconnectDelay = 2000; // Increased from 1000ms
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private messageQueue: ChatMessage[] = []; // Queue messages when disconnected
  private connectionPromise: Promise<void> | null = null; // Track connection promise

  /**
   * Ensure overlay server is running and WS source connection is open.
   * Safe to call multiple times; connection is re-created only if `port` changes.
   */
  async ensureConnected(port: number): Promise<void> {
    console.log('[OverlaySourceBridge] ensureConnected called with port:', port);
    
    // Return existing promise if connection in progress
    if (this.connectionPromise) {
      console.log('[OverlaySourceBridge] Connection in progress, returning existing promise');
      return this.connectionPromise;
    }

    if (!port || !Number.isFinite(port) || port <= 0) {
      console.error("[OverlaySourceBridge] Invalid port:", port);
      return Promise.resolve();
    }

    if (this.connectedPort === port && this.socket?.readyState === WebSocket.OPEN) {
      console.log('[OverlaySourceBridge] Already connected to port', port);
      return Promise.resolve();
    }

    this.connectedPort = port;
    this.reconnectAttempts = 0;
    this.connectionState = 'connecting';
    console.log('[OverlaySourceBridge] Connection state: connecting');

    // Start overlay server if it isn't already running.
    try {
      await invoke("startOverlayServer", { port });
      console.log('[OverlaySourceBridge] Overlay server started on port', port);
    } catch (error) {
      console.warn("[OverlaySourceBridge] Failed to start overlay server:", error);
      // If invoke fails (e.g. already started), we'll still try to connect WS.
    }

    this.socket?.close();

    const wsUrl = `ws://127.0.0.1:${port}/ws/overlay?role=source`;
    this.socket = new WebSocket(wsUrl);
    console.log('[OverlaySourceBridge] Connecting to:', wsUrl);

    // Create connection promise
    this.connectionPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.connectionState = 'disconnected';
        this.connectionPromise = null;
        console.log('[OverlaySourceBridge] Connection timeout, state: disconnected');
        resolve(); // Resolve anyway after timeout
      }, 3000);

      const onOpen = () => {
        clearTimeout(timeout);
        this.connectionState = 'connected';
        this.connectionPromise = null;
        console.log('[OverlaySourceBridge] Connection opened, state: connected');
        
        // Flush queued messages
        this.flushMessageQueue();
        resolve();
      };

      const onError = (event: Event) => {
        this.connectionState = 'disconnected';
        this.connectionPromise = null;
        console.log('[OverlaySourceBridge] Connection error, state: disconnected');
        clearTimeout(timeout);
        resolve(); // don't block UI
      };

      if (!this.socket) {
        console.error("[OverlaySourceBridge] Socket not created");
        this.connectionPromise = null;
        resolve();
        return;
      }

      this.socket.onopen = onOpen;
      this.socket.onerror = onError;
    });

    return this.connectionPromise;
  }

  /**
   * Flush queued messages after connection is established
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`[OverlaySourceBridge] Flushing ${this.messageQueue.length} queued messages`);
    
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const message of queue) {
      this.sendWebSocketMessage(message);
    }
    
    console.log('[OverlaySourceBridge] Message queue flushed');
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(port: number): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[OverlaySourceBridge] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.ensureConnected(port);
  }

  /**
   * Forward a chat message to overlay via WebSocket
   */
  forwardMessage(message: ChatMessage): void {
    if (!message.canRenderInOverlay || message.text == null) {
      return;
    }

    // If socket is open, send immediately
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('[OverlaySourceBridge] Sending message immediately:', message.id);
      this.sendWebSocketMessage(message);
      return;
    }

    // Queue message for later delivery
    this.messageQueue.push(message);
    console.log(`[OverlaySourceBridge] Message queued (queue size: ${this.messageQueue.length}):`, message.id);
    
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 50) {
      this.messageQueue.shift(); // Remove oldest message
      console.log('[OverlaySourceBridge] Message queue full, removed oldest message');
    }

    // Attempt to reconnect in background
    if (this.connectedPort) {
      console.log('[OverlaySourceBridge] Attempting to reconnect...');
      this.ensureConnected(this.connectedPort).catch((err) => {
        console.error('[OverlaySourceBridge] Reconnection failed:', err);
      });
    }
  }

  /**
   * Send a message via WebSocket
   */
  private sendWebSocketMessage(message: ChatMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[OverlaySourceBridge] Cannot send - socket not open, readyState:', this.socket?.readyState);
      return;
    }

    const payload: OverlaySourcePayload = {
      type: "chatMessage",
      message: {
        id: message.id,
        platform: message.platform,
        author: message.author,
        text: message.text,
        timestamp: message.timestamp,
        isSupporter: message.isSupporter,
        sourceChannelId: message.sourceChannelId,
        authorAvatarUrl: message.authorAvatarUrl,
      },
    };

    try {
      const json = JSON.stringify(payload);
      this.socket.send(json);
      console.log('[OverlaySourceBridge] Message sent:', message.id, '| channel:', message.sourceChannelId, '| platform:', message.platform, '| text:', message.text.substring(0, 50));
    } catch (error) {
      console.error("[OverlaySourceBridge] Failed to send message:", error);
      // Queue message for retry
      this.messageQueue.push(message);
      if (this.messageQueue.length > 50) {
        this.messageQueue.shift();
      }
      // Attempt reconnection on send failure
      if (this.connectedPort) {
        this.attemptReconnect(this.connectedPort).catch(() => {});
      }
    }
  }
}
