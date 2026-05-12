import { PlatformType } from "@models/chat.model";

/**
 * Cache Key Builder Utility
 *
 * Responsibility: Build consistent cache keys across the application.
 * All cache keys follow the pattern `${platform}:${id}` for consistency.
 */

/**
 * Build a channel avatar cache key.
 * Format: platform:channelId
 */
export function buildAvatarCacheKey(platform: PlatformType, channelId: string): string {
  return `${platform}:${channelId}`;
}

/**
 * Build a user avatar cache key.
 * Format: platform:userId
 */
export function buildUserAvatarCacheKey(platform: PlatformType, userId: string): string {
  return `${platform}:${userId}`;
}

/**
 * Build a channel data cache key.
 * Format: platform:channelId
 */
export function buildChannelCacheKey(platform: PlatformType, channelId: string): string {
  return `${platform}:${channelId}`;
}

/**
 * Build a scroll token cache key.
 * Format: platform:channelId
 */
export function buildScrollTokenCacheKey(platform: PlatformType, channelId: string): string {
  return `${platform}:${channelId}`;
}
