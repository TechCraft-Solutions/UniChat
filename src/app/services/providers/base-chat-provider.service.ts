import { inject, Injectable } from "@angular/core";
import { ChatMessage, PlatformType } from "@models/chat.model";
import { createMessageActionState } from "@helpers/chat.helper";
import { ChatStorageService } from "@services/data/chat-storage.service";
import { AuthorizationService } from "@services/features/authorization.service";

export interface PlatformChatConfig {
  server?: string;
  port?: number;
  apiKey?: string;
}

export interface MockMessageTemplate {
  author: string;
  text: string;
  badges: string[];
}

@Injectable({
  providedIn: "root",
})
export abstract class BaseChatProviderService {
  protected readonly chatStorageService = inject(ChatStorageService);
  protected readonly authorizationService = inject(AuthorizationService);

  abstract readonly platform: PlatformType;
  protected connectedChannels = new Set<string>();

  connect(channelId: string): void {
    if (this.connectedChannels.has(channelId)) {
      return;
    }

    this.connectedChannels.add(channelId);
    setTimeout(() => {
      this.simulateIncomingMessages(channelId);
    }, 1000);
  }

  disconnect(channelId: string): void {
    this.connectedChannels.delete(channelId);
  }

  isConnected(channelId: string): boolean {
    return this.connectedChannels.has(channelId);
  }

  protected abstract getMockMessages(): MockMessageTemplate[];

  protected abstract getActionStates(): {
    reply: ReturnType<typeof createMessageActionState>;
    delete: ReturnType<typeof createMessageActionState>;
  };

  private simulateIncomingMessages(channelId: string): void {
    if (!this.connectedChannels.has(channelId)) {
      return;
    }

    const mockMessages = this.getMockMessages();

    for (const mockMsg of mockMessages) {
      if (!this.connectedChannels.has(channelId)) {
        break;
      }

      setTimeout(
        () => {
          if (!this.connectedChannels.has(channelId)) {
            return;
          }

          const message = this.createMessage(channelId, mockMsg);
          this.chatStorageService.addMessage(channelId, message);
        },
        Math.random() * 5000 + 2000
      );
    }
  }

  protected createMessage(channelId: string, data: Partial<ChatMessage>): ChatMessage {
    const timestamp = new Date().toISOString();
    const userId = `${this.platform}-user-${Date.now()}`;
    const messageId = `${this.platform}-${channelId}-${Date.now()}`;
    const actionStates = this.getActionStates();

    return {
      id: messageId,
      platform: this.platform,
      sourceMessageId: messageId,
      sourceChannelId: channelId,
      sourceUserId: userId,
      author: data.author ?? "Anonymous",
      text: data.text ?? "",
      timestamp,
      badges: data.badges ?? [],
      isSupporter: this.isSupporter(data.badges),
      isOutgoing: false,
      isDeleted: false,
      canRenderInOverlay: true,
      actions: {
        reply: actionStates.reply,
        delete: actionStates.delete,
      },
      rawPayload: {
        providerEvent: this.getProviderEventName(),
        providerChannelId: channelId,
        providerUserId: userId,
        preview: data.text ?? "",
      },
    };
  }

  protected isSupporter(badges?: string[]): boolean {
    const supporterBadges = ["subscriber", "supporter", "member"];
    return badges?.some((badge) => supporterBadges.includes(badge)) ?? false;
  }

  protected getProviderEventName(): string {
    switch (this.platform) {
      case "twitch":
        return "privmsg";
      case "kick":
        return "chat.message";
      case "youtube":
        return "liveChatMessage";
    }
  }
}
