/* sys lib */
import { Injectable, inject, OnDestroy, Injector } from "@angular/core";

/* services */
import { ChatStorageService } from "@services/data/chat-storage.service";

/* models */
import { ChatMessage } from "@models/chat.model";

/* config */
import { APP_CONFIG } from "@config/app.constants";

/* helpers */
import { sortMessagesChronological } from "@helpers/chat.helper";

/**
 * Chat Pruning Service
 *
 * Responsibility: Memory management for chat messages.
 * Handles global message cap enforcement and periodic pruning.
 */
@Injectable({
  providedIn: "root",
})
export class ChatPruningService implements OnDestroy {
  private readonly injector = inject(Injector);
  private _pruneInterval: ReturnType<typeof setInterval> | null = null;
  private _storageCache: ChatStorageService | null = null;

  private get storage(): ChatStorageService {
    if (!this._storageCache) {
      this._storageCache = this.injector.get(ChatStorageService);
    }
    return this._storageCache;
  }

  constructor() {
    this.startPruneInterval();
  }

  ngOnDestroy(): void {
    this.stopPruneInterval();
  }

  /**
   * Start periodic pruning interval
   */
  startPruneInterval(): void {
    if (this._pruneInterval !== null) {
      return;
    }
    const storage = this.storage;
    this._pruneInterval = setInterval(() => {
      this.pruneOldMessages(storage.channelMessages());
    }, APP_CONFIG.PRUNE_INTERVAL_MS);
  }

  /**
   * Stop periodic pruning interval
   */
  stopPruneInterval(): void {
    if (this._pruneInterval !== null) {
      clearInterval(this._pruneInterval);
      this._pruneInterval = null;
    }
  }

  /**
   * Prune old messages across all channels to prevent memory growth.
   * Trims to MAX_MESSAGES_TOTAL by removing oldest messages first.
   * Returns the pruned store.
   */
  pruneOldMessages(store: Record<string, ChatMessage[]>): Record<string, ChatMessage[]> {
    const maxTotal = APP_CONFIG.MAX_MESSAGES_TOTAL;

    let totalCount = 0;
    for (const messages of Object.values(store)) {
      totalCount += messages.length;
    }

    if (totalCount <= maxTotal) {
      return store;
    }

    const allWithChannel: { channelId: string; msg: ChatMessage }[] = [];
    for (const [channelId, messages] of Object.entries(store)) {
      for (const msg of messages) {
        allWithChannel.push({ channelId, msg });
      }
    }

    allWithChannel.sort(
      (a, b) => new Date(a.msg.timestamp).getTime() - new Date(b.msg.timestamp).getTime()
    );

    const toRemove = allWithChannel.slice(0, allWithChannel.length - maxTotal);
    const toKeep = allWithChannel.slice(allWithChannel.length - maxTotal);

    const newStore: Record<string, ChatMessage[]> = {};
    for (const entry of toKeep) {
      if (!newStore[entry.channelId]) {
        newStore[entry.channelId] = [];
      }
      newStore[entry.channelId].push(entry.msg);
    }

    for (const channelId of Object.keys(newStore)) {
      newStore[channelId] = sortMessagesChronological(newStore[channelId]);
    }

    return newStore;
  }

  /**
   * Get memory usage stats
   */
  getMemoryStats(store: Record<string, ChatMessage[]>): {
    totalMessages: number;
    channels: number;
    byChannel: Record<string, number>;
  } {
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
