import { ChatChannel, PlatformType } from "@models/chat.model";

export type ChannelRef = `${PlatformType}:${string}`;

export function buildChannelRef(platform: PlatformType, providerChannelId: string): ChannelRef {
  return `${platform}:${providerChannelId.toLowerCase()}` as ChannelRef;
}

export function parseChannelRef(channelRef: string): {
  platform: PlatformType;
  providerChannelId: string;
} | null {
  const separatorIndex = channelRef.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const platform = channelRef.slice(0, separatorIndex);
  const providerChannelId = channelRef.slice(separatorIndex + 1).trim();
  if (!providerChannelId) {
    return null;
  }

  if (platform === "twitch" || platform === "kick" || platform === "youtube") {
    return { platform, providerChannelId };
  }

  return null;
}

export function isChannelRef(value: string): value is ChannelRef {
  return parseChannelRef(value) !== null;
}

export function toChannelRef(channel: Pick<ChatChannel, "platform" | "channelId">): ChannelRef {
  return buildChannelRef(channel.platform, channel.channelId);
}

export function migrateLegacyChannelRefs(
  values: string[] | null | undefined,
  channels: ChatChannel[]
): ChannelRef[] | undefined {
  if (values == null) {
    return undefined;
  }

  if (values.length === 0) {
    return [];
  }

  const migrated = new Set<ChannelRef>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const directRef = parseChannelRef(normalized);
    if (directRef) {
      // Normalize provider channel ID to lowercase for consistent matching
      // (message sourceChannelId is always lowercase from normalizeChannelId)
      migrated.add(buildChannelRef(directRef.platform, directRef.providerChannelId.toLowerCase()));
      continue;
    }

    if (normalized.startsWith("ch-")) {
      const match = channels.find((channel) => channel.id === normalized);
      if (match) {
        migrated.add(toChannelRef(match));
      }
      continue;
    }

    const exactMatches = channels.filter(
      (channel) =>
        channel.channelId === normalized ||
        channel.channelName.toLowerCase() === normalized.toLowerCase()
    );

    for (const match of exactMatches) {
      migrated.add(toChannelRef(match));
    }
  }

  return [...migrated];
}

export function findChannelByRef(
  channels: ChatChannel[],
  channelRef: string
): ChatChannel | undefined {
  const parsed = parseChannelRef(channelRef);
  if (!parsed) {
    return undefined;
  }

  return channels.find(
    (channel) =>
      channel.platform === parsed.platform && channel.channelId === parsed.providerChannelId
  );
}
