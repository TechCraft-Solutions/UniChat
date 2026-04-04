/* sys lib */
import { Injectable, inject } from "@angular/core";

/* models */
import { ChatChannel, PlatformType } from "@models/chat.model";

/* services */
import { AvatarCacheService } from "@services/core/avatar-cache.service";
import { ChatListService } from "@services/data/chat-list.service";

@Injectable({
  providedIn: "root",
})
export class ChannelAvatarService {
  private readonly chatListService = inject(ChatListService);
  private readonly avatarCache = inject(AvatarCacheService);

  private readonly pendingEnsures = new Set<string>();

  getChannelImage(platform: PlatformType, channelId: string): string | null {
    const channel = this.findChannel(platform, channelId);
    if (channel?.channelImageUrl?.trim()) {
      return channel.channelImageUrl.trim();
    }

    return this.avatarCache.getChannelAvatar(this.cacheKey(platform, channelId)) ?? null;
  }

  getChannelImageForChannel(channel: ChatChannel): string | null {
    return this.getChannelImage(channel.platform, channel.channelId);
  }

  hasChannelImage(platform: PlatformType, channelId: string): boolean {
    return !!this.getChannelImage(platform, channelId);
  }

  hasChannelImageForChannel(channel: ChatChannel): boolean {
    return this.hasChannelImage(channel.platform, channel.channelId);
  }

  getChannelInitial(channelName: string | undefined): string {
    return channelName?.trim().charAt(0).toUpperCase() || "?";
  }

  ensureChannelImage(platform: PlatformType, channelId: string): void {
    if (this.getChannelImage(platform, channelId)) {
      return;
    }

    const channel = this.findChannel(platform, channelId);
    if (!channel) {
      return;
    }

    const cacheKey = this.cacheKey(platform, channelId);
    if (this.pendingEnsures.has(cacheKey)) {
      return;
    }

    this.pendingEnsures.add(cacheKey);
    void this.chatListService.loadChannelImage(channel.id).finally(() => {
      this.pendingEnsures.delete(cacheKey);
    });
  }

  ensureChannelImageForChannel(channel: ChatChannel): void {
    this.ensureChannelImage(channel.platform, channel.channelId);
  }

  private findChannel(platform: PlatformType, channelId: string): ChatChannel | undefined {
    return this.chatListService
      .getChannels(platform)
      .find((channel) => channel.channelId === channelId);
  }

  private cacheKey(platform: PlatformType, channelId: string): string {
    return `${platform}:${channelId}`;
  }
}
