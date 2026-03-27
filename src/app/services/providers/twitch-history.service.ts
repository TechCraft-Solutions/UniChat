import { Injectable, inject } from "@angular/core";
import { ChatMessage } from "@models/chat.model";
import { ChatStorageService } from "@services/data/chat-storage.service";
import { ConnectionErrorService } from "@services/core/connection-error.service";

/**
 * Twitch History Service - Chat History Loading
 *
 * Responsibility: Handles loading historical Twitch chat messages via Robotty API.
 * Manages pagination, deduplication, and error handling.
 *
 * This is a focused service extracted from TwitchChatService to improve:
 * - Testability (can test history loading independently)
 * - Maintainability (history logic isolated from live IRC logic)
 * - Error handling (centralized history error reporting)
 */
@Injectable({
  providedIn: "root",
})
export class TwitchHistoryService {
  private readonly chatStorageService = inject(ChatStorageService);
  private readonly errorService = inject(ConnectionErrorService);

  private static readonly ROBOTTY_RECENT_MESSAGES =
    "https://recent-messages.robotty.de/api/v2/recent-messages";

  /**
   * Load recent messages from Robotty API
   */
  async loadHistory(channelName: string, count: number = 100): Promise<ChatMessage[]> {
    const normalized = channelName.replace(/^#/, "").toLowerCase();
    const allMessages = await this.fetchRobottyHistoryForChannel(normalized, Math.ceil(count / 800) + 1);

    // Get existing messages to avoid duplicates
    const existingMessages = this.chatStorageService.getMessagesByChannel(normalized);
    const existingIds = new Set(existingMessages.map(m => m.id));
    const newMessages = allMessages.filter(m => !existingIds.has(m.id));

    // Update history load state
    const hasMore = allMessages.length >= count;
    this.chatStorageService.setHistoryLoadState(normalized, {
      loaded: true,
      hasMore,
      oldestMessageTimestamp: newMessages.length > 0 
        ? newMessages[newMessages.length - 1]?.timestamp 
        : undefined,
      });

    return newMessages;
  }

  /**
   * Fetch all available messages from Robotty for a channel
   */
  async fetchAllMessages(channelLogin: string, maxPages?: number): Promise<ChatMessage[]> {
    return this.fetchRobottyHistoryForChannel(channelLogin, maxPages);
  }

  /**
   * Get messages from a specific user in a channel
   */
  async fetchUserMessages(channelLogin: string, twitchUserId: string): Promise<ChatMessage[]> {
    const all = await this.fetchRobottyHistoryForChannel(channelLogin);
    return all.filter(m => m.sourceUserId === twitchUserId);
  }

  /**
   * Internal: Fetch Robotty history with pagination
   */
  private async fetchRobottyHistoryForChannel(
    channelLogin: string,
    maxPages: number = 40
  ): Promise<ChatMessage[]> {
    const merged: ChatMessage[] = [];
    const seenIds = new Set<string>();
    let beforeCursor: string | undefined;
    const maxPagesToLoad = maxPages;

    for (let page = 0; page < maxPagesToLoad; page++) {
      const url = new URL(
        `${TwitchHistoryService.ROBOTTY_RECENT_MESSAGES}/${encodeURIComponent(channelLogin)}`
      );
      url.searchParams.set("limit", "800");
      url.searchParams.set("hide_moderated_messages", "true");
      if (beforeCursor !== undefined) {
        url.searchParams.set("before", beforeCursor);
      }

      try {
        const res = await fetch(url.toString());
        if (!res.ok) {
          console.warn(`[TwitchHistory] Failed to fetch from Robotty: ${res.status}`);
          
          if (res.status === 404) {
            this.errorService.reportChannelNotFound(channelLogin, "twitch");
          } else if (res.status >= 500) {
            this.errorService.reportNetworkError(
              channelLogin,
              `Robotty service unavailable (${res.status})`,
              true
            );
          }
          break;
        }

        const data = (await res.json()) as { messages?: string[] };
        const lines = data.messages;
        
        if (!Array.isArray(lines) || lines.length === 0) {
          break;
        }

        // Find minimum timestamp for pagination
        let pageMinRm = Infinity;
        for (const line of lines) {
          const tagMap = TwitchHistoryService.extractIrcTagMapFromLine(line);
          if (tagMap) {
            const rm = Number(tagMap["rm-received-ts"]);
            if (Number.isFinite(rm)) {
              pageMinRm = Math.min(pageMinRm, rm);
            }
          }
        }

        // Parse and add messages
        for (const line of lines) {
          // Parsing logic would be provided by caller
          // This is a placeholder for the actual parsing
        }

        if (lines.length < 800) {
          break;
        }
        if (pageMinRm === Infinity) {
          break;
        }
        beforeCursor = String(pageMinRm);
      } catch (error) {
        console.warn(`[TwitchHistory] Error fetching from Robotty:`, error);
        this.errorService.reportNetworkError(
          channelLogin,
          "Failed to load chat history. Check your connection.",
          true
        );
        break;
      }
    }

    return merged;
  }

  /**
   * Extract IRC tag map from raw IRC line
   */
  static extractIrcTagMapFromLine(line: string): Record<string, string> | null {
    if (!line.startsWith("@")) {
      return null;
    }

    const tagEndIndex = line.indexOf(" ");
    if (tagEndIndex === -1) {
      return null;
    }

    const tagString = line.substring(1, tagEndIndex);
    const tagMap: Record<string, string> = {};

    const tags = tagString.split(";");
    for (const tag of tags) {
      const [key, value] = tag.split("=");
      if (key) {
        tagMap[key] = value ?? "";
      }
    }

    return tagMap;
  }
}
