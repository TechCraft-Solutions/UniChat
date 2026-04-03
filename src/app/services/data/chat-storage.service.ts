/* sys lib */
import { computed, inject, Injectable, signal } from "@angular/core";

/* models */
import { ChatMessage, PlatformType, ChatHistoryLoadState, MessageType } from "@models/chat.model";

/* services */
import { BlockedWordsService } from "@services/ui/blocked-words.service";
import { HighlightNotificationService } from "@services/ui/highlight-notification.service";
import { MessageTypeDetectorService } from "@services/ui/message-type-detector.service";
import { OverlaySourceBridgeService } from "@services/ui/overlay-source-bridge.service";

/* helpers */
import { sortMessagesChronological, groupByPlatform } from "@helpers/chat.helper";

/* config */
import { APP_CONFIG } from "@config/app.constants";
import { buildChannelRef, parseChannelRef } from "@utils/channel-ref.util";
const channelMessagesStorageKey = "unichat.channelMessages.v1";

/**
 * Chat Storage Service - PRIMARY SOURCE OF TRUTH
 *
 * Responsibility: Owns all chat message data and persistence.
 * This is THE authoritative source for chat messages in the application.
 *
 * Source of Truth Hierarchy:
 * 1. ChatStorageService - Primary message storage (owns the data) <-- THIS SERVICE
 * 2. ChatStateService - Computed state (derived from storage)
 * 3. ChatStateManagerService - Connection tracking (session state)
 * 4. ConnectionStateService - Connection status per channel
 *
 * Key Features:
 * - Signal-based reactive state management
 * - LocalStorage persistence
 * - Message deduplication and limiting
 * - History load state tracking
 * - Overlay message broadcasting
 * - High-throughput coalescing: live `addMessage` is flushed once per animation frame
 *   to cut signal churn during 1000+ msg/min bursts (memory + CPU).
 *
 * All other services should read from this service, not duplicate its data.
 *
 * @see ChatStateService for computed message views
 * @see ChatStateManagerService for session connection tracking
 * @see ConnectionStateService for connection status
 */
@Injectable({
  providedIn: "root",
})
export class ChatStorageService {
  private readonly channelMessagesSignal = signal<Record<string, ChatMessage[]>>({});
  private readonly loadedChannels = signal<Set<string>>(new Set());
  private readonly historyLoadState = signal<Record<string, ChatHistoryLoadState>>({});
  private readonly overlayBridge = inject(OverlaySourceBridgeService);
  private readonly messageTypeDetector = inject(MessageTypeDetectorService);
  private readonly blockedWordsService = inject(BlockedWordsService);
  private readonly highlightNotifications = inject(HighlightNotificationService);

  /** Live ingress batches (flushed on requestAnimationFrame). */
  private readonly pendingBatches = new Map<string, ChatMessage[]>();
  private batchRafId: number | null = null;

  // Cache version for allMessages to avoid recalculation on every change
  private readonly allMessagesVersion = signal(0);
  private _allMessagesCache: { version: number; messages: ChatMessage[] } = {
    version: 0,
    messages: [],
  };

  readonly channelMessages = this.channelMessagesSignal.asReadonly();
  readonly loadedChannelsSet = this.loadedChannels.asReadonly();
  readonly historyLoadStates = this.historyLoadState.asReadonly();

  constructor() {
    this.channelMessagesSignal.set({});
  }

  /**
   * Increment the message version to invalidate cache
   */
  private incrementMessageVersion(): void {
    this.allMessagesVersion.update((v) => v + 1);
  }

  readonly allMessages = computed(() => {
    const currentVersion = this.allMessagesVersion();

    // Return cached version if still valid
    if (this._allMessagesCache.version === currentVersion) {
      return this._allMessagesCache.messages;
    }

    // Recalculate only when version changes
    const allMessages: ChatMessage[] = [];
    const messagesByChannel = this.channelMessagesSignal();

    for (const messages of Object.values(messagesByChannel)) {
      allMessages.push(...messages);
    }

    const sorted = sortMessagesChronological(allMessages);

    // Update cache (plain property, not a signal)
    this._allMessagesCache = { version: currentVersion, messages: sorted };
    return sorted;
  });

  readonly messagesByPlatform = computed(() => {
    const allMessages = this.allMessages();
    return groupByPlatform(allMessages);
  });

  getChannelRefForMessage(message: Pick<ChatMessage, "platform" | "sourceChannelId">): string {
    return buildChannelRef(message.platform, message.sourceChannelId);
  }

  isChannelLoaded(channelId: string): boolean {
    // Accept both full channelRef format (e.g., "kick:dmitriy363") and legacy format ("dmitriy363")
    // Also handle case sensitivity (providers use lowercase)
    const loaded = this.loadedChannels();
    const normalizedInput = channelId.toLowerCase();

    // Check direct match (case-insensitive)
    for (const stored of loaded) {
      if (stored.toLowerCase() === normalizedInput) {
        return true;
      }
    }

    // Also check legacy format
    const parsed = parseChannelRef(channelId);
    if (parsed) {
      // Check if we have the provider channel ID (lowercase)
      const providerIdLower = parsed.providerChannelId.toLowerCase();
      for (const stored of loaded) {
        if (stored.toLowerCase() === providerIdLower) {
          return true;
        }
      }
    }

    return false;
  }

  markChannelAsLoaded(channelId: string): void {
    this.loadedChannels.update((set) => {
      const newSet = new Set(set);
      // If already contains the channel, don't add again
      if (set.has(channelId)) {
        return set;
      }
      // Parse and check if it's in full format or needs normalization
      const parts = channelId.split(":");
      if (
        parts.length === 2 &&
        (parts[0] === "twitch" || parts[0] === "kick" || parts[0] === "youtube")
      ) {
        // Full format - add to set
        newSet.add(channelId);
      } else {
        // Single part (legacy) - add as-is
        newSet.add(channelId);
      }
      return newSet;
    });
  }

  getHistoryLoadState(channelId: string): ChatHistoryLoadState {
    return this.historyLoadState()[channelId] ?? { loaded: false, hasMore: true };
  }

  setHistoryLoadState(channelId: string, state: ChatHistoryLoadState): void {
    this.historyLoadState.update((store) => ({
      ...store,
      [channelId]: state,
    }));
  }

  getMessagesByChannel(channelId: string): ChatMessage[] {
    return this.channelMessagesSignal()[channelId] ?? [];
  }

  getMessagesByPlatform(platform: PlatformType): ChatMessage[] {
    return this.messagesByPlatform()[platform];
  }

  addMessage(channelId: string, message: ChatMessage): void {
    // Use platform:channelId format to prevent cross-platform collision
    // (e.g., kick:dmitriy363 vs twitch:dmitriy363)
    const storageKey = buildChannelRef(message.platform, channelId);

    const { filtered, wasFiltered } = this.blockedWordsService.filterMessage(
      message.text,
      storageKey
    );
    if (wasFiltered) {
      message.text = filtered;
    }

    const { type, reason } = this.messageTypeDetector.detectMessageType(message);
    message.messageType = type;
    message.messageTypeReason = reason;

    const q = this.pendingBatches.get(storageKey);
    if (q) {
      q.push(message);
    } else {
      this.pendingBatches.set(storageKey, [message]);
    }
    this.messageTypeDetector.updateLastMessageTime(message);
    this.scheduleBatchFlush();
  }

  prependMessages(channelId: string, messages: ChatMessage[]): void {
    this.flushPendingBatchesNow();

    // Sort messages chronologically (oldest first) for correct type detection
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Use platform:channelId format to prevent cross-platform collision
    const platform = messages.length > 0 ? messages[0].platform : "twitch";
    const storageKey = buildChannelRef(platform, channelId);

    // Apply blocked words filtering and detect message types
    for (const message of sortedMessages) {
      const { filtered, wasFiltered } = this.blockedWordsService.filterMessage(
        message.text,
        storageKey
      );
      if (wasFiltered) {
        message.text = filtered;
      }
      const { type, reason } = this.messageTypeDetector.detectMessageType(message);
      message.messageType = type;
      message.messageTypeReason = reason;
    }

    this.channelMessagesSignal.update((store) => {
      const channelMessages = store[storageKey] ?? [];
      const messageMap = new Map(channelMessages.map((msg) => [msg.id, msg]));

      for (const message of messages) {
        messageMap.set(message.id, message);
      }

      const sortedMessages = sortMessagesChronological(Array.from(messageMap.values()));
      return {
        ...store,
        [storageKey]: sortedMessages,
      };
    });

    // Enforce global message cap
    this.enforceGlobalCap();

    this.persistChannelMessages();

    // Update last message times after adding (in chronological order)
    for (const message of sortedMessages) {
      this.messageTypeDetector.updateLastMessageTime(message);
    }

    // Forward messages in original order for display
    for (const message of messages) {
      this.highlightNotifications.maybeNotify(message);
      this.overlayBridge.forwardMessage(message);
    }
  }

  removeMessage(channelId: string, messageId: string): void {
    this.flushPendingBatchesNow();
    this.channelMessagesSignal.update((store) => {
      const channelMessages = store[channelId];

      if (!channelMessages) {
        return store;
      }

      return {
        ...store,
        [channelId]: channelMessages.filter((msg) => msg.id !== messageId),
      };
    });
    this.persistChannelMessages();
  }

  updateMessage(channelId: string, messageId: string, updates: Partial<ChatMessage>): void {
    this.flushPendingBatchesNow();
    const channelMessages = this.channelMessagesSignal()[channelId];
    if (!channelMessages) {
      return;
    }

    const existing = channelMessages.find((m) => m.id === messageId);
    if (!existing) {
      return;
    }

    const shouldForward =
      updates.text !== undefined ||
      updates.timestamp !== undefined ||
      updates.author !== undefined ||
      updates.platform !== undefined ||
      updates.isSupporter !== undefined ||
      updates.isDeleted !== undefined ||
      updates.canRenderInOverlay !== undefined;

    const updated: ChatMessage = { ...existing, ...updates };

    this.channelMessagesSignal.update((store) => {
      const messages = store[channelId];
      if (!messages) {
        return store;
      }

      return {
        ...store,
        [channelId]: messages.map((msg) => (msg.id === messageId ? updated : msg)),
      };
    });
    this.persistChannelMessages();

    if (shouldForward) {
      this.overlayBridge.forwardMessage(updated);
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchRafId !== null) {
      return;
    }
    this.batchRafId = requestAnimationFrame(() => {
      this.batchRafId = null;
      this.flushBatches();
    });
  }

  /** Apply pending live messages (one signal update per frame per burst). */
  private flushBatches(): void {
    if (this.pendingBatches.size === 0) {
      return;
    }
    const snapshot = new Map(this.pendingBatches);
    this.pendingBatches.clear();

    this.channelMessagesSignal.update((store) => {
      let next: Record<string, ChatMessage[]> = { ...store };
      for (const [channelId, incoming] of snapshot) {
        if (incoming.length === 0) {
          continue;
        }
        const channelMessages = next[channelId] ?? [];
        const messageMap = new Map(channelMessages.map((msg) => [msg.id, msg]));
        for (const message of incoming) {
          messageMap.set(message.id, message);
        }
        next = {
          ...next,
          [channelId]: sortMessagesChronological(Array.from(messageMap.values())),
        };
      }
      return next;
    });

    // Enforce global message cap
    this.enforceGlobalCap();

    // Increment version to invalidate allMessages cache
    this.incrementMessageVersion();

    this.persistChannelMessages();

    for (const incoming of snapshot.values()) {
      for (const message of incoming) {
        this.highlightNotifications.maybeNotify(message);
        this.overlayBridge.forwardMessage(message);
      }
    }
  }

  private flushPendingBatchesNow(): void {
    if (this.batchRafId !== null) {
      cancelAnimationFrame(this.batchRafId);
      this.batchRafId = null;
    }
    this.flushBatches();
  }

  private persistChannelMessages(): void {
    // Messages are session-only and not persisted to localStorage
  }

  private loadPersistedChannelMessages(): Record<string, ChatMessage[]> {
    return {};
  }

  /**
   * Enforce global message cap across ALL channels.
   * Removes oldest messages until total <= MAX_MESSAGES_TOTAL.
   */
  private enforceGlobalCap(): void {
    const maxTotal = APP_CONFIG.MAX_MESSAGES_TOTAL;
    const store = this.channelMessagesSignal();

    // Count total messages
    let totalCount = 0;
    for (const messages of Object.values(store)) {
      totalCount += messages.length;
    }

    if (totalCount <= maxTotal) {
      return; // Under cap, nothing to do
    }

    // Collect all messages with their channel, sort by timestamp
    const allWithChannel: { channelId: string; msg: ChatMessage }[] = [];
    for (const [channelId, messages] of Object.entries(store)) {
      for (const msg of messages) {
        allWithChannel.push({ channelId, msg });
      }
    }

    // Sort by timestamp (newest last)
    allWithChannel.sort(
      (a, b) => new Date(a.msg.timestamp).getTime() - new Date(b.msg.timestamp).getTime()
    );

    // Keep only the newest maxTotal messages
    const toRemove = allWithChannel.slice(0, allWithChannel.length - maxTotal);
    const toKeep = allWithChannel.slice(allWithChannel.length - maxTotal);

    // Rebuild store with trimmed channels
    const newStore: Record<string, ChatMessage[]> = {};
    for (const entry of toKeep) {
      if (!newStore[entry.channelId]) {
        newStore[entry.channelId] = [];
      }
      newStore[entry.channelId].push(entry.msg);
    }

    // Re-sort each channel
    for (const channelId of Object.keys(newStore)) {
      newStore[channelId] = sortMessagesChronological(newStore[channelId]);
    }

    this.channelMessagesSignal.set(newStore);
  }

  /**
   * Export all current messages as JSON string.
   * Useful for debugging, archiving, or analysis.
   */
  exportMessages(): string {
    const store = this.channelMessagesSignal();
    return JSON.stringify(store, null, 2);
  }

  /**
   * Prune old messages across all channels to prevent memory growth.
   * Trims to MAX_MESSAGES_TOTAL by removing oldest messages first.
   */
  pruneOldMessages(): void {
    this.flushPendingBatchesNow();
    this.enforceGlobalCap();
  }

  /**
   * Clear messages for a specific channel (memory cleanup)
   */
  clearChannel(channelId: string): void {
    this.flushPendingBatchesNow();
    this.pendingBatches.delete(channelId);
    this.channelMessagesSignal.update((store) => {
      const newStore = { ...store };
      delete newStore[channelId];
      return newStore;
    });
    this.loadedChannels.update((set) => {
      const newSet = new Set(set);
      newSet.delete(channelId);
      return newSet;
    });
    this.persistChannelMessages();
  }

  /**
   * Clear all messages (full memory reset)
   */
  clearAllMessages(): void {
    this.flushPendingBatchesNow();
    this.pendingBatches.clear();
    this.channelMessagesSignal.set({});
    this.loadedChannels.set(new Set());
    this.historyLoadState.set({});
    this.persistChannelMessages();
  }

  /**
   * Get memory usage stats
   */
  getMemoryStats(): { totalMessages: number; channels: number; byChannel: Record<string, number> } {
    const store = this.channelMessagesSignal();
    const byChannel: Record<string, number> = {};
    let total = 0;

    for (const [channelId, messages] of Object.entries(store)) {
      byChannel[channelId] = messages.length;
      total += messages.length;
    }

    return {
      totalMessages: total,
      channels: Object.keys(store).length,
      byChannel,
    };
  }
}
