import { Injectable, computed, inject } from "@angular/core";
import { ChatChannel, ChatMessage, PlatformType } from "@models/chat.model";
import {
  buildSplitFeed,
  groupChannelsByPlatform,
  sortMessagesChronological,
} from "@helpers/chat.helper";
import { ChatListService } from "@services/data/chat-list.service";
import { ChatStateService } from "@services/data/chat-state.service";
import { DashboardPreferencesService } from "@services/ui/dashboard-preferences.service";

@Injectable({
  providedIn: "root",
})
export class DashboardFeedDataService {
  private readonly chatListService = inject(ChatListService);
  private readonly dashboardPreferencesService = inject(DashboardPreferencesService);
  private readonly chatStateService = inject(ChatStateService);

  readonly orderedPlatforms = computed(
    () => this.dashboardPreferencesService.preferences().splitLayout.orderedPlatforms
  );

  readonly channelsByPlatform = computed(() =>
    groupChannelsByPlatform(this.chatListService.getVisibleChannels())
  );

  readonly visiblePlatformsInOrder = computed(() => {
    const ordered = this.orderedPlatforms();
    const byPlatform = this.channelsByPlatform();
    return ordered.filter((p) => (byPlatform[p]?.length ?? 0) > 0);
  });

  readonly splitFeed = computed(() => {
    const messages = this.chatStateService.messages();
    return buildSplitFeed(messages);
  });

  orderedChannelsForPlatform(platform: PlatformType): ChatChannel[] {
    this.dashboardPreferencesService.preferences();
    const visible = this.chatListService.getVisibleChannels(platform);
    const savedOrder =
      this.dashboardPreferencesService.preferences().splitLayout.orderedChannelIds?.[platform];
    return DashboardFeedDataService.mergeChannelOrder(visible, savedOrder);
  }

  private static mergeChannelOrder(
    visible: ChatChannel[],
    savedOrder: string[] | undefined
  ): ChatChannel[] {
    if (!savedOrder?.length) {
      return visible;
    }
    const byChannelId = new Map(visible.map((c) => [c.channelId, c]));
    const out: ChatChannel[] = [];
    const used = new Set<string>();
    for (const id of savedOrder) {
      const ch = byChannelId.get(id);
      if (ch) {
        out.push(ch);
        used.add(ch.channelId);
      }
    }
    for (const ch of visible) {
      if (!used.has(ch.channelId)) {
        out.push(ch);
      }
    }
    return out;
  }

  getMessagesForChannel(platform: PlatformType, channelId: string): ChatMessage[] {
    const list = this.splitFeed()[platform].filter(
      (message) => message.sourceChannelId === channelId
    );
    return sortMessagesChronological(list);
  }

  scrollTokenForChannel(platform: PlatformType, channelId: string): string {
    const msgs = this.splitFeed()[platform].filter(
      (message) => message.sourceChannelId === channelId
    );
    const newest = msgs.length > 0 ? msgs[0] : undefined;
    return `${platform}:${channelId}:${msgs.length}:${newest?.id ?? ""}`;
  }

  private mixedMessagesRaw(disabledChannelIds: Set<string>): ChatMessage[] {
    const messages = this.chatStateService.messages();
    if (disabledChannelIds.size === 0) {
      return messages;
    }
    return messages.filter((m) => !disabledChannelIds.has(m.sourceChannelId));
  }

  getMixedFeedChronological(disabledChannelIds: Set<string>): ChatMessage[] {
    return sortMessagesChronological(this.mixedMessagesRaw(disabledChannelIds));
  }

  mixedScrollToken(disabledChannelIds: Set<string>): string {
    const raw = this.mixedMessagesRaw(disabledChannelIds);
    const newest = raw.length > 0 ? raw[0] : undefined;
    return `mixed:${raw.length}:${newest?.id ?? ""}`;
  }
}
