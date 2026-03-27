import { Injectable, inject } from "@angular/core";
import { ChatMessage } from "@models/chat.model";
import { AuthorizationService } from "@services/features/authorization.service";
import { ChatStorageService } from "@services/data/chat-storage.service";
import tmi from "tmi.js";

export type TwitchConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

/**
 * Twitch IRC Service - WebSocket Connection Management
 *
 * Responsibility: Manages Twitch IRC WebSocket connections via tmi.js.
 * Handles connection lifecycle, message listening, and status events.
 *
 * This is a focused service extracted from TwitchChatService to improve:
 * - Testability (can mock IRC layer independently)
 * - Maintainability (connection logic isolated)
 * - Reusability (could support multiple IRC-based platforms)
 */
@Injectable({
  providedIn: "root",
})
export class TwitchIrcService {
  private readonly authorizationService = inject(AuthorizationService);
  private readonly chatStorageService = inject(ChatStorageService);

  private readonly clientsByChannel = new Map<string, tmi.Client>();
  private readonly statusListeners = new Set<
    (channelId: string, status: TwitchConnectionStatus) => void
  >();
  private readonly messageListeners = new Set<
    (channelId: string, message: ChatMessage) => void
  >();

  /**
   * Connect to a Twitch channel's IRC chat
   */
  connect(channelId: string, buildMessage: (tags: tmi.ChatUserstate, message: string, self: boolean) => ChatMessage | null): void {
    const normalizedChannel = channelId.replace(/^#/, "").toLowerCase();
    
    if (!normalizedChannel || this.clientsByChannel.has(normalizedChannel)) {
      return;
    }

    this.emitStatus(normalizedChannel, "connecting");

    const account = this.authorizationService.getAccount("twitch");
    const client = new tmi.Client({
      options: {
        skipUpdatingEmotesets: true,
      },
      channels: [normalizedChannel],
      connection: { reconnect: true, secure: true },
      identity:
        account?.authStatus === "authorized"
          ? {
              username: account.username.toLowerCase(),
              password: account.accessToken ? `oauth:${account.accessToken}` : undefined,
            }
          : undefined,
    });

    // Message handler
    client.on("message", (_channel: string, tags: tmi.ChatUserstate, message: string, self: boolean) => {
      const messageModel = buildMessage(tags, message, self);
      if (messageModel) {
        this.chatStorageService.addMessage(normalizedChannel, messageModel);
        
        // Notify message listeners
        for (const listener of this.messageListeners) {
          listener(normalizedChannel, messageModel);
        }
      }
    });

    // Connection status handlers
    client.on("connected", () => {
      this.emitStatus(normalizedChannel, "connected");
    });
    
    client.on("disconnected", () => {
      this.emitStatus(normalizedChannel, "disconnected");
    });
    
    client.on("reconnect", () => {
      this.emitStatus(normalizedChannel, "reconnecting");
    });

    void client.connect();
    this.clientsByChannel.set(normalizedChannel, client);
  }

  /**
   * Disconnect from a Twitch channel's IRC chat
   */
  disconnect(channelId: string): void {
    const normalizedChannel = channelId.replace(/^#/, "").toLowerCase();
    const client = this.clientsByChannel.get(normalizedChannel);
    
    if (client) {
      void client.disconnect();
      this.clientsByChannel.delete(normalizedChannel);
    }
    
    this.emitStatus(normalizedChannel, "disconnected");
  }

  /**
   * Check if connected to a channel
   */
  isConnected(channelId: string): boolean {
    const normalizedChannel = channelId.replace(/^#/, "").toLowerCase();
    return this.clientsByChannel.has(normalizedChannel);
  }

  /**
   * Send a message via IRC
   */
  async sendMessage(channelId: string, text: string): Promise<boolean> {
    const normalizedChannel = channelId.replace(/^#/, "").toLowerCase();
    const trimmed = text.trim();
    
    if (!trimmed) {
      return false;
    }

    const account = this.authorizationService.getAccount("twitch");
    const hasAuthIdentity =
      account?.authStatus === "authorized" &&
      !!account.username?.trim() &&
      !!account.accessToken?.trim();
    
    if (!hasAuthIdentity) {
      return false;
    }

    // Auto-connect if not connected
    if (!this.clientsByChannel.has(normalizedChannel)) {
      this.connect(normalizedChannel, () => null);
      await this.delay(700);
    }

    let client = this.clientsByChannel.get(normalizedChannel);
    if (!client) {
      return false;
    }

    try {
      await client.say(normalizedChannel, trimmed);
      return true;
    } catch (error) {
      const message = String(error ?? "");
      
      // Handle "not connected" errors with reconnect
      if (
        message.toLowerCase().includes("anonymous") ||
        message.toLowerCase().includes("not connected")
      ) {
        this.disconnect(normalizedChannel);
        this.connect(normalizedChannel, () => null);
        await this.delay(900);
        
        client = this.clientsByChannel.get(normalizedChannel);
        if (!client) {
          return false;
        }

        try {
          await client.say(normalizedChannel, trimmed);
          return true;
        } catch {
          return false;
        }
      }

      return false;
    }
  }

  /**
   * Register a status change listener
   * Returns cleanup function
   */
  onStatusChange(listener: (channelId: string, status: TwitchConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Register a message listener
   * Returns cleanup function
   */
  onMessage(listener: (channelId: string, message: ChatMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  /**
   * Get tmi.js client for a channel (for advanced operations)
   */
  getClient(channelId: string): tmi.Client | undefined {
    const normalizedChannel = channelId.replace(/^#/, "").toLowerCase();
    return this.clientsByChannel.get(normalizedChannel);
  }

  private emitStatus(channelId: string, status: TwitchConnectionStatus): void {
    for (const listener of this.statusListeners) {
      listener(channelId, status);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
