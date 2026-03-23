export type ThemeMode = "light" | "dark";

export type PlatformType = "twitch" | "kick" | "youtube";

export type ConnectionMode = "account" | "channelWatch";

export type PlatformStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type FeedMode = "mixed" | "split";

export type DensityMode = "compact" | "comfortable";

export type WidgetStatus = "live" | "draft";

export type WidgetFilter = "all" | "supporters";

export type MessageActionKind = "reply" | "delete";

export type MessageActionStatus = "available" | "disabled" | "pending" | "failed";

export type AuthStatus = "unauthorized" | "authorized" | "tokenExpired" | "revoked";

export interface MessageAction {
  kind: MessageActionKind;
  status: MessageActionStatus;
  reason?: string;
}

export interface PlatformCapabilities {
  canListen: boolean;
  canReply: boolean;
  canDelete: boolean;
}

export interface PlatformSession {
  platform: PlatformType;
  label: string;
  status: PlatformStatus;
  connectionMode: ConnectionMode;
  target: string;
  accountLabel?: string;
  summary: string;
  latencyMs: number;
  viewers: number;
  capabilities: PlatformCapabilities;
}

export interface ConnectionState extends PlatformSession {}

export interface RawPayloadMetadata {
  providerEvent: string;
  providerChannelId: string;
  providerUserId: string;
  preview: string;
}

export interface ChatMessage {
  id: string;
  platform: PlatformType;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceUserId: string;
  author: string;
  text: string;
  timestamp: string;
  badges: string[];
  isSupporter: boolean;
  isOutgoing: boolean;
  isDeleted: boolean;
  canRenderInOverlay: boolean;
  replyToMessageId?: string;
  actions: Record<MessageActionKind, MessageAction>;
  rawPayload: RawPayloadMetadata;
}

export interface SplitLayout {
  orderedPlatforms: PlatformType[];
  hiddenPlatforms: PlatformType[];
  columnWidths: Record<PlatformType, number>;
  /** Per-platform order of `channelId` (provider id) for split channel switcher */
  orderedChannelIds?: Partial<Record<PlatformType, string[]>>;
}

export interface DashboardPreferences {
  feedMode: FeedMode;
  densityMode: DensityMode;
  splitLayout: SplitLayout;
}

export interface WidgetConfig {
  id: string;
  name: string;
  status: WidgetStatus;
  filter: WidgetFilter;
  sceneHint: string;
  themeHint: string;
  port: number;
}

export interface DashboardStats {
  activePlatforms: number;
  manageablePlatforms: number;
  liveWidgets: number;
  supporterMessages: number;
  totalMessages: number;
  primaryOverlayUrl: string;
}

export interface ChatAccount {
  id: string;
  platform: PlatformType;
  username: string;
  userId: string;
  avatarUrl?: string;
  authStatus: AuthStatus;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  authorizedAt: string;
}

export interface ChatChannel {
  id: string;
  platform: PlatformType;
  channelId: string;
  channelName: string;
  isAuthorized: boolean;
  accountId?: string;
  isVisible: boolean;
  addedAt: string;
}

export interface ChannelConnection {
  channelId: string;
  platform: PlatformType;
  status: PlatformStatus;
  latencyMs: number;
  viewers: number;
  capabilities: PlatformCapabilities;
}

export interface AuthorizationState {
  twitch: AuthStatus;
  kick: AuthStatus;
  youtube: AuthStatus;
}
