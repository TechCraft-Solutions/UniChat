import { Injectable, inject } from "@angular/core";
import { PlatformType } from "@models/chat.model";
import { TwitchChatService } from "@services/providers/twitch-chat.service";
import { KickChatService } from "@services/providers/kick-chat.service";
import { YouTubeChatService } from "@services/providers/youtube-chat.service";
import { ChatListService } from "@services/data/chat-list.service";

@Injectable({
  providedIn: "root",
})
export class ChatProviderCoordinatorService {
  private readonly twitchService = inject(TwitchChatService);
  private readonly kickService = inject(KickChatService);
  private readonly youtubeService = inject(YouTubeChatService);
  private readonly chatListService = inject(ChatListService);

  connectChannel(channelId: string, platform: PlatformType): void {
    switch (platform) {
      case "twitch":
        this.twitchService.connect(channelId);
        break;
      case "kick":
        this.kickService.connect(channelId);
        break;
      case "youtube":
        this.youtubeService.connect(channelId);
        break;
    }
  }

  disconnectChannel(channelId: string, platform: PlatformType): void {
    switch (platform) {
      case "twitch":
        this.twitchService.disconnect(channelId);
        break;
      case "kick":
        this.kickService.disconnect(channelId);
        break;
      case "youtube":
        this.youtubeService.disconnect(channelId);
        break;
    }
  }

  isConnected(channelId: string, platform: PlatformType): boolean {
    switch (platform) {
      case "twitch":
        return this.twitchService.isConnected(channelId);
      case "kick":
        return this.kickService.isConnected(channelId);
      case "youtube":
        return this.youtubeService.isConnected(channelId);
      default:
        return false;
    }
  }

  connectAllVisibleChannels(): void {
    const channels = this.chatListService.getVisibleChannels();

    for (const channel of channels) {
      this.connectChannel(channel.channelId, channel.platform);
    }
  }

  disconnectAll(): void {
    const channels = this.chatListService.getVisibleChannels();

    for (const channel of channels) {
      this.disconnectChannel(channel.channelId, channel.platform);
    }
  }
}
