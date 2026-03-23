import {
  ChatChannel,
  ChatMessage,
  DensityMode,
  MessageAction,
  MessageActionKind,
  MessageActionStatus,
  PlatformCapabilities,
  PlatformStatus,
  PlatformType,
  WidgetConfig,
  WidgetFilter,
  WidgetStatus,
} from "@models/chat.model";

const platformBadgeClasses: Record<PlatformType, string> = {
  twitch:
    "bg-fuchsia-500/15 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-500/30 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 dark:ring-fuchsia-400/30",
  kick: "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30",
  youtube:
    "bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-400/30",
};

const statusClasses: Record<PlatformStatus | WidgetStatus, string> = {
  disconnected:
    "bg-slate-500/15 text-slate-700 ring-1 ring-inset ring-slate-500/30 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/30",
  connecting:
    "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/30",
  connected:
    "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30",
  reconnecting:
    "bg-sky-500/15 text-sky-700 ring-1 ring-inset ring-sky-500/30 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/30",
  live: "bg-cyan-500/15 text-cyan-700 ring-1 ring-inset ring-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/30",
  draft:
    "bg-slate-500/15 text-slate-700 ring-1 ring-inset ring-slate-500/30 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/30",
};

const statusLabels: Record<PlatformStatus | WidgetStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  live: "Live",
  draft: "Draft",
};

export function sortMessagesByRecency(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

export function sortMessagesChronological(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
}

export function buildSplitFeed(messages: ChatMessage[]): Record<PlatformType, ChatMessage[]> {
  return {
    twitch: messages.filter((message) => message.platform === "twitch"),
    kick: messages.filter((message) => message.platform === "kick"),
    youtube: messages.filter((message) => message.platform === "youtube"),
  };
}

export function createMessageActionState(
  kind: MessageActionKind,
  status: MessageActionStatus,
  reason?: string
): MessageAction {
  return { kind, status, reason };
}

export function getPlatformLabel(platform: PlatformType): string {
  if (platform === "youtube") {
    return "YouTube";
  }

  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function getPlatformBadgeClasses(platform: PlatformType): string {
  return platformBadgeClasses[platform];
}

export function getStatusClasses(status: PlatformStatus | WidgetStatus): string {
  return statusClasses[status];
}

export function getStatusLabel(status: PlatformStatus | WidgetStatus): string {
  return statusLabels[status];
}

export function getWidgetSummary(widget: WidgetConfig, messages: ChatMessage[]): string {
  const filterLabel = widget.filter === "all" ? "All chat" : "Supporters only";
  return `${filterLabel} • ${messages.length} queued`;
}

export function groupChannelsByPlatform(
  channels: ChatChannel[]
): Record<PlatformType, ChatChannel[]> {
  return {
    twitch: channels.filter((channel) => channel.platform === "twitch"),
    kick: channels.filter((channel) => channel.platform === "kick"),
    youtube: channels.filter((channel) => channel.platform === "youtube"),
  };
}

export function getAuthorizationUrl(platform: PlatformType): string {
  const baseUrl = "https://example.com/oauth";

  switch (platform) {
    case "twitch":
      return `${baseUrl}/twitch`;
    case "kick":
      return `${baseUrl}/kick`;
    case "youtube":
      return `${baseUrl}/youtube`;
  }
}

export function getDensityCardClasses(densityMode: DensityMode): string {
  return densityMode === "compact" ? "gap-3 rounded-[1.25rem] p-3" : "gap-4 rounded-[1.5rem] p-4";
}

export function getDensityTextClasses(densityMode: DensityMode): string {
  return densityMode === "compact" ? "text-xs leading-5" : "text-sm leading-6";
}

export function buildOverlayUrl(port: number, widgetId: string): string {
  return `http://127.0.0.1:${port}/overlay?widgetId=${widgetId}`;
}

export function getProviderCapabilities(
  platform: PlatformType,
  isAuthorized: boolean
): PlatformCapabilities {
  if (!isAuthorized) {
    return {
      canListen: true,
      canReply: false,
      canDelete: false,
    };
  }

  if (platform === "youtube") {
    return {
      canListen: true,
      canReply: true,
      canDelete: false,
    };
  }

  return {
    canListen: true,
    canReply: true,
    canDelete: true,
  };
}

export interface CreateMessageOptions {
  id?: string;
  sourceMessageId?: string;
  sourceUserId?: string;
  author?: string;
  text?: string;
  badges?: string[];
  isSupporter?: boolean;
  isOutgoing?: boolean;
  replyToMessageId?: string;
  customActions?: Partial<ChatMessage["actions"]>;
  rawPayloadOverride?: Partial<ChatMessage["rawPayload"]>;
}

export function createChatMessage(
  platform: PlatformType,
  channelId: string,
  options: CreateMessageOptions = {}
): ChatMessage {
  const timestamp = new Date().toISOString();
  const userId = options.sourceUserId ?? `${platform}-user-${Date.now()}`;
  const messageId = options.id ?? `${platform}-${channelId}-${Date.now()}`;
  const sourceMessageId = options.sourceMessageId ?? messageId;

  const defaultActions: ChatMessage["actions"] = {
    reply: createMessageActionState("reply", "available"),
    delete: createMessageActionState("delete", "available"),
  };

  return {
    id: messageId,
    platform,
    sourceMessageId,
    sourceChannelId: channelId,
    sourceUserId: userId,
    author: options.author ?? "Anonymous",
    text: options.text ?? "",
    timestamp,
    badges: options.badges ?? [],
    isSupporter: options.isSupporter ?? false,
    isOutgoing: options.isOutgoing ?? false,
    isDeleted: false,
    canRenderInOverlay: true,
    replyToMessageId: options.replyToMessageId,
    actions: options.customActions
      ? { ...defaultActions, ...options.customActions }
      : defaultActions,
    rawPayload: {
      providerEvent: getProviderEventName(platform),
      providerChannelId: channelId,
      providerUserId: userId,
      preview: options.text ?? "",
      ...options.rawPayloadOverride,
    },
  };
}

function getProviderEventName(platform: PlatformType): string {
  switch (platform) {
    case "twitch":
      return "privmsg";
    case "kick":
      return "chat.message";
    case "youtube":
      return "liveChatMessage";
  }
}
