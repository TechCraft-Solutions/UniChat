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
 *
 * PERSISTENCE DISABLED - All persistence methods are no-ops
 */
@Injectable({
  providedIn: "root",
})
export class ChatPersistenceService {
  private readonly chatHistoryDb = inject(ChatHistoryDbService);

  /**
   * Persist all messages for a channel to IndexedDB - NO-OP
   */
  persistChannelMessages(channelId: string, messages: ChatMessage[]): void {
    // Persistence disabled - no-op
  }

  /**
   * Persist all messages across all channels - NO-OP
   */
  persistAllChannels(store: Record<string, ChatMessage[]>): void {
    // Persistence disabled - no-op
  }

  /**
   * Load all persisted messages from IndexedDB - NO-OP
   */
  async loadPersistedMessages(): Promise<Record<string, ChatMessage[]>> {
    // Persistence disabled - return empty
    return {};
  }

  /**
   * Clear messages for a specific channel from persistence - NO-OP
   */
  clearChannel(channelId: string): void {
    // Persistence disabled - no-op
  }

  /**
   * Clear all persisted messages - NO-OP
   */
  clearAll(): void {
    // Persistence disabled - no-op
  }
}
