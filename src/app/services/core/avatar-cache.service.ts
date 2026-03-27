import { Injectable } from "@angular/core";

/**
 * Centralized avatar cache service
 * Consolidates caches from multiple components to prevent memory duplication
 * and provide a single source of truth for image caching
 */
@Injectable({
  providedIn: "root",
})
export class AvatarCacheService {
  private userCache = new Map<string, string>();
  private channelCache = new Map<string, string>();

  /**
   * Get cached user avatar URL
   * @param key - Cache key (typically platform:userId)
   * @returns Cached URL or undefined
   */
  getUserAvatar(key: string): string | undefined {
    return this.userCache.get(key);
  }

  /**
   * Cache user avatar URL
   * @param key - Cache key (typically platform:userId)
   * @param url - Avatar URL to cache
   */
  setUserAvatar(key: string, url: string): void {
    this.userCache.set(key, url);
  }

  /**
   * Get cached channel avatar URL
   * @param key - Cache key (typically platform:channelId)
   * @returns Cached URL or undefined
   */
  getChannelAvatar(key: string): string | undefined {
    return this.channelCache.get(key);
  }

  /**
   * Cache channel avatar URL
   * @param key - Cache key (typically platform:channelId)
   * @param url - Avatar URL to cache
   */
  setChannelAvatar(key: string, url: string): void {
    this.channelCache.set(key, url);
  }

  /**
   * Check if user avatar is cached
   * @param key - Cache key
   */
  hasUserAvatar(key: string): boolean {
    return this.userCache.has(key);
  }

  /**
   * Check if channel avatar is cached
   * @param key - Cache key
   */
  hasChannelAvatar(key: string): boolean {
    return this.channelCache.has(key);
  }

  /**
   * Clear all cached avatars
   * Useful for memory management or when user logs out
   */
  clear(): void {
    this.userCache.clear();
    this.channelCache.clear();
  }

  /**
   * Clear only user avatars
   */
  clearUserCache(): void {
    this.userCache.clear();
  }

  /**
   * Clear only channel avatars
   */
  clearChannelCache(): void {
    this.channelCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): { userCacheSize: number; channelCacheSize: number } {
    return {
      userCacheSize: this.userCache.size,
      channelCacheSize: this.channelCache.size,
    };
  }
}
