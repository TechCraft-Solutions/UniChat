/* sys lib */
import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import tmi from "tmi.js";

/* models */
import { ChatMessage } from "@models/chat.model";

/* services */
import { LoggerService } from "@services/core/logger.service";
import { ConnectionErrorService } from "@services/core/connection-error.service";
import { BaseChatProviderService } from "@services/providers/base-chat-provider.service";
import { IconsCatalogService } from "@services/ui/icons-catalog.service";
import { ReconnectionService } from "@services/core/reconnection.service";
import { TwitchViewerCardService } from "@services/providers/twitch-viewer-card.service";
import { TwitchConnectionService } from "@services/providers/twitch-connection.service";
import { TwitchMessageParserService } from "@services/providers/twitch-message-parser.service";
import { TwitchRoomStateService } from "@services/providers/twitch-room-state.service";
import { normalizeChannelId } from "@utils/channel-normalization.util";

/* helpers */
import { createMessageActionState } from "@helpers/chat.helper";

export type { TwitchUserInfo } from "@models/platform-api.model";

@Injectable({
  providedIn: "root",
})
export class TwitchChatService extends BaseChatProviderService {
  readonly platform = "twitch" as const;

  private readonly messageListeners = new Map<
    string,
    (channel: string, tags: tmi.ChatUserstate, message: string, self: boolean) => void
  >();

  private readonly iconsCatalog = inject(IconsCatalogService);
  private readonly errorService = inject(ConnectionErrorService);
  private readonly logger = inject(LoggerService);
  private readonly reconnectionService = inject(ReconnectionService);
  private readonly viewerCard = inject(TwitchViewerCardService);
  private readonly connectionService = inject(TwitchConnectionService);
  private readonly messageParser = inject(TwitchMessageParserService);
  private readonly roomStateService = inject(TwitchRoomStateService);

  override connect(channelId: string): void {
    void this.connectAsync(channelId);
  }

  private async connectAsync(channelId: string): Promise<void> {
    void this.iconsCatalog.ensureGlobalLoaded();
    const normalizedChannel = normalizeChannelId("twitch", channelId);
    if (!normalizedChannel || this.connectionService.hasClient(normalizedChannel)) {
      return;
    }

    await this.authorizationService.waitForAccounts(3000);

    const account = this.resolveAccountForChannel(normalizedChannel);
    this.logger.info(
      "TwitchChatService",
      "Connecting to",
      normalizedChannel,
      "account:",
      account ? { username: account.username, status: account.authStatus } : "none"
    );

    const messageListener = (
      _channel: string,
      tags: tmi.ChatUserstate,
      message: string,
      self: boolean
    ) => {
      const messageModel = this.messageParser.buildMessageFromTmiPrivmsg(
        normalizedChannel,
        tags,
        message,
        self
      );
      if (messageModel) {
        messageModel.receivedAt = Date.now();

        this.reconnectionService.trackMessage(normalizedChannel, messageModel, "twitch");

        if (self) {
          this.messageParser.handleOwnMessageEcho(normalizedChannel, message, messageModel.id);
        }

        this.chatStorageService.addMessage(normalizedChannel, messageModel);
      }
    };
    this.messageListeners.set(normalizedChannel, messageListener);

    await this.connectionService.connectAsync(
      normalizedChannel,
      account?.authStatus === "authorized" && account.accessToken
        ? { username: account.username, accessToken: account.accessToken }
        : undefined
    );

    const client = this.connectionService.getClient(normalizedChannel);
    if (client) {
      client.on("message", messageListener);

      const roomstateListener = this.roomStateService.createRoomStateListener(normalizedChannel);
      client.on("roomstate", roomstateListener);
    }

    this.connectedChannels.add(normalizedChannel);
  }

  override disconnect(channelId: string): void {
    const normalizedChannel = normalizeChannelId("twitch", channelId);
    const client = this.connectionService.getClient(normalizedChannel);

    if (client) {
      const messageListener = this.messageListeners.get(normalizedChannel);
      if (messageListener) {
        client.removeListener("message", messageListener);
        this.messageListeners.delete(normalizedChannel);
      }

      this.roomStateService.removeRoomStateListener(normalizedChannel, client);
    }

    this.connectionService.disconnect(normalizedChannel);
    this.connectedChannels.delete(normalizedChannel);
  }

  sendMessage(channelId: string, text: string): boolean {
    const normalizedChannel = normalizeChannelId("twitch", channelId);
    void this.sendMessageAsync(normalizedChannel, text);
    return true;
  }

  async sendMessageAsync(channelId: string, text: string): Promise<boolean> {
    const normalizedChannel = normalizeChannelId("twitch", channelId);
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }

    const account = this.resolveAccountForChannel(normalizedChannel);
    const hasAuthIdentity =
      account?.authStatus === "authorized" &&
      !!account.username?.trim() &&
      !!account.accessToken?.trim();

    if (!hasAuthIdentity) {
      if (account && (account.authStatus === "tokenExpired" || account.authStatus === "revoked")) {
        this.logger.info("TwitchChatService", "Token expired, attempting refresh before send");
        const refreshed = await this.authorizationService.refreshAndReconnect(account.id, "twitch");
        if (!refreshed) {
          this.logger.warn("TwitchChatService", "Token refresh failed");
          this.errorService.reportAuthFailed(normalizedChannel);
          return false;
        }
        const refreshedAccount = this.authorizationService.getAccountByIdSync(account.id);
        if (!refreshedAccount || refreshedAccount.authStatus !== "authorized") {
          this.logger.warn("TwitchChatService", "Refreshed account not authorized");
          return false;
        }
        this.logger.info("TwitchChatService", "Token refreshed successfully, proceeding with send");
      } else {
        this.logger.warn("TwitchChatService", "No valid auth identity for", normalizedChannel);
        this.errorService.reportAuthFailed(normalizedChannel);
        return false;
      }
    }

    if (!this.connectionService.hasClient(normalizedChannel)) {
      this.connect(normalizedChannel);
      await this.delay(700);
    }

    let client = this.connectionService.getClient(normalizedChannel);
    if (!client) {
      this.errorService.reportNetworkError(normalizedChannel, "Client not initialized");
      return false;
    }

    try {
      await client.say(normalizedChannel, trimmed);
      return true;
    } catch (error) {
      const message = String(error ?? "");
      this.logger.error(
        "TwitchChatService",
        "Send message failed for",
        normalizedChannel,
        "error:",
        error
      );
      if (
        message.toLowerCase().includes("anonymous") ||
        message.toLowerCase().includes("not connected")
      ) {
        this.logger.warn(
          "TwitchChatService",
          "Detected anonymous/not-connected state, reconnecting..."
        );
        this.errorService.reportWebSocketError(normalizedChannel, "twitch", true);
        this.disconnect(normalizedChannel);
        this.connect(normalizedChannel);
        await this.delay(900);
        client = this.connectionService.getClient(normalizedChannel);
        if (!client) {
          this.logger.error("TwitchChatService", "Client still not available after reconnect");
          return false;
        }

        try {
          await client.say(normalizedChannel, trimmed);
          return true;
        } catch (retryError) {
          this.logger.error("TwitchChatService", "Retry also failed:", retryError);
          this.errorService.reportNetworkError(
            normalizedChannel,
            "Failed to send message after reconnect"
          );
          return false;
        }
      }

      this.errorService.reportNetworkError(normalizedChannel, `Send failed: ${message}`);
      return false;
    }
  }

  async deleteMessageAsync(channelId: string, messageId: string): Promise<boolean> {
    const normalizedChannel = normalizeChannelId("twitch", channelId);

    const account = this.resolveAccountForChannel(normalizedChannel);
    if (!account || account.authStatus !== "authorized" || !account.accessToken) {
      return false;
    }

    try {
      return await invoke<boolean>("twitchDeleteMessage", {
        channelId: normalizedChannel,
        messageId,
        accessToken: account.accessToken,
      });
    } catch (error) {
      this.logger.error("TwitchChatService", "Delete message error", error);
      return false;
    }
  }

  onStatusChange(
    listener: (channelId: string, status: TwitchConnectionStatus) => void
  ): () => void {
    return this.connectionService.onStatusChange(listener);
  }

  async loadChannelHistory(channelName: string, count: number = 100): Promise<ChatMessage[]> {
    return this.messageParser.loadChannelHistory(channelName, count);
  }

  async fetchRobottyMessagesForUser(
    channelLogin: string,
    twitchUserId: string
  ): Promise<ChatMessage[]> {
    return this.messageParser.fetchRobottyMessagesForUser(channelLogin, twitchUserId);
  }

  async fetchRobottyMessagesForUserPaginated(
    channelLogin: string,
    userId: string,
    options: { limit?: number; beforeTimestamp?: string } = {}
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    return this.messageParser.fetchRobottyMessagesForUserPaginated(channelLogin, userId, options);
  }

  async fetchUserProfileImage(username: string): Promise<string | null> {
    return this.viewerCard.fetchUserProfileImage(username);
  }

  async fetchUserInfo(username: string) {
    return this.viewerCard.fetchUserInfo(username);
  }

  async fetchTwitchViewerCard(channelLogin: string, targetLogin: string) {
    return this.viewerCard.fetchTwitchViewerCard(channelLogin, targetLogin);
  }

  async fetchChannelProfileImage(channelLogin: string): Promise<string | null> {
    return this.viewerCard.fetchChannelProfileImage(channelLogin);
  }

  protected override getActionStates() {
    return {
      reply: createMessageActionState(
        "reply",
        "disabled",
        "Reply requires Twitch API integration (coming soon). tmi.js doesn't support replies."
      ),
      delete: createMessageActionState(
        "delete",
        "disabled",
        "This channel cannot delete messages."
      ),
    };
  }

  private resolveAccountForChannel(channelName: string) {
    const normalizedChannel = normalizeChannelId("twitch", channelName);
    const channel = this.chatListService
      .getChannels("twitch")
      .find(
        (entry) =>
          entry.channelId.toLowerCase() === normalizedChannel ||
          entry.channelName.toLowerCase() === normalizedChannel
      );

    const account = this.authorizationService.getAccountByIdSync(channel?.accountId);

    return account;
  }

  reconnectChannel(channelId: string): void {
    const normalizedChannel = normalizeChannelId("twitch", channelId);
    if (!this.connectionService.hasClient(normalizedChannel)) {
      return;
    }

    this.logger.info(
      "TwitchChatService",
      "Reconnecting channel",
      normalizedChannel,
      "with new token"
    );
    this.connectionService.reconnectChannel(normalizedChannel);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export type TwitchConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
