/**
 * IndexedDB Service for Chat History Caching
 *
 * Provides offline storage for chat history to improve performance
 * and enable offline access to recent messages.
 *
 * PERSISTENCE DISABLED - All write operations are no-ops
 */

import { Injectable, inject } from "@angular/core";
import { ChatMessage } from "@models/chat.model";
import { LoggerService } from "@services/core/logger.service";

const DB_NAME = "unichat-chat-history";
const DB_VERSION = 1;
const STORE_NAME = "messages";

interface ChatHistoryStore {
  id: string;
  channelId: string;
  platform: string;
  message: ChatMessage;
  timestamp: number;
}

@Injectable({
  providedIn: "root",
})
export class ChatHistoryDbService {
  private readonly logger = inject(LoggerService);
  private db: IDBDatabase | null = null;
  private isOpening = false;
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Open IndexedDB database
   */
  private async openDb(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    if (this.isOpening && this.openPromise) {
      return this.openPromise;
    }

    this.isOpening = true;
    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.isOpening = false;
        this.openPromise = null;
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isOpening = false;
        this.openPromise = null;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("channelId", "channelId", { unique: false });
          store.createIndex("platform", "platform", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });

    return this.openPromise;
  }

  /**
   * Store a single message - NO-OP (persistence disabled)
   */
  async storeMessage(message: ChatMessage, channelId: string): Promise<void> {
    // Persistence disabled - no-op
  }

  /**
   * Store multiple messages in batch - NO-OP (persistence disabled)
   */
  async storeMessages(messages: ChatMessage[], channelId: string): Promise<void> {
    // Persistence disabled - no-op
  }

  /**
   * Get messages for a channel - NO-OP (persistence disabled)
   */
  async getMessages(channelId: string, limit: number = 100): Promise<ChatMessage[]> {
    // Persistence disabled - return empty
    return [];
  }

  /**
   * Get messages older than a timestamp (for pagination) - NO-OP (persistence disabled)
   */
  async getMessagesBefore(
    channelId: string,
    beforeTimestamp: number,
    limit: number = 100
  ): Promise<ChatMessage[]> {
    // Persistence disabled - return empty
    return [];
  }

  /**
   * Delete messages for a channel - NO-OP (persistence disabled)
   */
  async deleteChannelMessages(channelId: string): Promise<void> {
    // Persistence disabled - no-op
  }

  /**
   * Delete a single message - NO-OP (persistence disabled)
   */
  async deleteMessage(messageId: string): Promise<void> {
    // Persistence disabled - no-op
  }

  /**
   * Clear all messages - NO-OP (persistence disabled)
   */
  async clearAll(): Promise<void> {
    // Persistence disabled - no-op
  }

  /**
   * Get storage stats - NO-OP (persistence disabled)
   */
  async getStats(): Promise<{ totalMessages: number; channels: string[] }> {
    // Persistence disabled - return empty stats
    return { totalMessages: 0, channels: [] };
  }

  /**
   * Clean up old messages (older than 24 hours) - NO-OP (persistence disabled)
   */
  async cleanupOldMessages(maxAgeHours: number = 24): Promise<number> {
    // Persistence disabled - no-op
    return 0;
  }

  /**
   * Check if IndexedDB is available
   */
  isAvailable(): boolean {
    return typeof indexedDB !== "undefined";
  }

  /**
   * Get all messages grouped by channelId - NO-OP (persistence disabled)
   */
  async getAllPersistedMessages(): Promise<Record<string, ChatMessage[]>> {
    // Persistence disabled - return empty
    return {};
  }

  /**
   * Persist all messages for a channel (replaces existing) - NO-OP (persistence disabled)
   */
  async persistChannelMessages(channelId: string, messages: ChatMessage[]): Promise<void> {
    // Persistence disabled - no-op
  }

  /**
   * Close IndexedDB connection and clear reference
   */
  close(): void {
    this.db = null;
    this.isOpening = false;
    this.openPromise = null;
  }

  /**
   * Helper to convert IDBRequest to Promise
   */
  private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper to convert IDBTransaction to Promise
   */
  private transactionToPromise(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
