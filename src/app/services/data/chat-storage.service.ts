/* sys lib */
import { computed, inject, Injectable, signal } from "@angular/core";

/* models */
import { ChatMessage, PlatformType, ChatHistoryLoadState } from "@models/chat.model";

/* services */
import { BlockedWordsService } from "@services/ui/blocked-words.service";
import { ChatPersistenceService } from "@services/data/chat-persistence.service";
import { ChatPruningService } from "@services/data/chat-pruning.service";
import { HighlightNotificationService } from "@services/ui/highlight-notification.service";
import { MessageTypeDetectorService } from "@services/ui/message-type-detector.service";
import { OverlaySourceBridgeService } from "@services/ui/overlay-source-bridge.service";

/* helpers */
import { groupByPlatform } from "@helpers/chat.helper";

/* config */
import { buildChannelRef, parseChannelRef } from "@utils/channel-ref.util";

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
 * - LocalStorage persistence via ChatPersistenceService
 * - Message deduplication and limiting
 * - History load state tracking
 * - Overlay message broadcasting
 * - High-throughput coalescing: live `addMessage` is flushed once per animation frame
 *   to cut signal churn during 1000+ msg/min bursts (memory + CPU).
 *
 * Delegates to:
 * - ChatPersistenceService: IndexedDB persistence
 * - ChatPruningService: Memory management and pruning
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
  private readonly persistence = inject(ChatPersistenceService);
  private readonly pruning = inject(ChatPruningService);

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
    this.loadPersistedMessages();
  }

  private async loadPersistedMessages(): Promise<void> {
    const persisted = await this.persistence.loadPersistedMessages();
    if (Object.keys(persisted).length > 0) {
      this.channelMessagesSignal.set(persisted);
      this.incrementMessageVersion();
    }
  }

  /**
   * Increment the message version to invalidate cache
   */
  private incrementMessageVersion(): void {
    this.allMessagesVersion.update((v) => v + 1);
  }

  readonly allMessages = computed(() => {
    const currentVersion = this.allMessagesVersion();

    if (this._allMessagesCache.version === currentVersion) {
      return this._allMessagesCache.messages;
    }

    const allMessages: ChatMessage[] = [];
    const messagesByChannel = this.channelMessagesSignal();

    for (const messages of Object.values(messagesByChannel)) {
      allMessages.push(...messages);
    }

    const sorted = [...allMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

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
    const loaded = this.loadedChannels();
    const normalizedInput = channelId.toLowerCase();

    for (const stored of loaded) {
      if (stored.toLowerCase() === normalizedInput) {
        return true;
      }
    }

    const parsed = parseChannelRef(channelId);
    if (parsed) {
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
      if (set.has(channelId)) {
        return set;
      }
      const parts = channelId.split(":");
      if (
        parts.length === 2 &&
        (parts[0] === "twitch" || parts[0] === "kick" || parts[0] === "youtube")
      ) {
        newSet.add(channelId);
      } else {
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

    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const platform = messages.length > 0 ? messages[0].platform : "twitch";
    const storageKey = buildChannelRef(platform, channelId);

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

      const sortedMsgs = [...messageMap.values()].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      return {
        ...store,
        [storageKey]: sortedMsgs,
      };
    });

    this.enforceGlobalCap();

    this.persistence.persistAllChannels(this.channelMessagesSignal());

    for (const message of sortedMessages) {
      this.messageTypeDetector.updateLastMessageTime(message);
    }

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
    this.persistence.persistAllChannels(this.channelMessagesSignal());
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
    this.persistence.persistAllChannels(this.channelMessagesSignal());

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
          [channelId]: [...messageMap.values()].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ),
        };
      }
      return next;
    });

    this.enforceGlobalCap();

    this.incrementMessageVersion();

    this.persistence.persistAllChannels(this.channelMessagesSignal());

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

  /**
   * Enforce global message cap across ALL channels.
   * Removes oldest messages until total <= MAX_MESSAGES_TOTAL.
   */
  private enforceGlobalCap(): void {
    const store = this.channelMessagesSignal();
    const pruned = this.pruning.pruneOldMessages(store);
    if (pruned !== store) {
      this.channelMessagesSignal.set(pruned);
    }
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
    this.persistence.clearChannel(channelId);
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
    this.persistence.clearAll();
  }

  /**
   * Get memory usage stats
   */
  getMemoryStats(): { totalMessages: number; channels: number; byChannel: Record<string, number> } {
    const store = this.channelMessagesSignal();
    return this.pruning.getMemoryStats(store);
  }
}
