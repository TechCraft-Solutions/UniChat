/* sys lib */
import { Injectable, inject } from "@angular/core";

/* models */
import { ChatMessage } from "@models/chat.model";

/* services */
import { ChatHistoryDbService } from "@services/core/chat-history-db.service";

/**
 * Chat Persistence Service
 *
 * Responsibility: Handles persistence of chat messages to IndexedDB via ChatHistoryDbService.
 * Provides async persistence operations that don't block the main thread.
 */
@Injectable({
  providedIn: "root",
})
export class ChatPersistenceService {
  private readonly chatHistoryDb = inject(ChatHistoryDbService);

  /**
   * Persist all messages for a channel to IndexedDB
   */
  persistChannelMessages(channelId: string, messages: ChatMessage[]): void {
    this.chatHistoryDb.persistChannelMessages(channelId, messages);
  }

  /**
   * Persist all messages across all channels
   */
  persistAllChannels(store: Record<string, ChatMessage[]>): void {
    for (const [channelId, messages] of Object.entries(store)) {
      this.persistChannelMessages(channelId, messages);
    }
  }

  /**
   * Load all persisted messages from IndexedDB
   */
  async loadPersistedMessages(): Promise<Record<string, ChatMessage[]>> {
    return this.chatHistoryDb.getAllPersistedMessages();
  }

  /**
   * Clear messages for a specific channel from persistence
   */
  clearChannel(channelId: string): void {
    this.chatHistoryDb.deleteChannelMessages(channelId);
  }

  /**
   * Clear all persisted messages
   */
  clearAll(): void {
    this.chatHistoryDb.clearAll();
  }
}
