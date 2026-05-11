/* sys lib */
import { Injectable } from "@angular/core";

interface CacheEntry {
  url: string;
  timestamp: number;
}

const DEFAULT_MAX_SIZE = 500;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

const AVATAR_CACHE_CONFIG = {
  maxSize: DEFAULT_MAX_SIZE,
  ttlMs: DEFAULT_TTL_MS,
};

@Injectable({
  providedIn: "root",
})
export class AvatarCacheService {
  private userCache = new Map<string, CacheEntry>();
  private channelCache = new Map<string, CacheEntry>();
  private maxSize = AVATAR_CACHE_CONFIG.maxSize;
  private ttlMs = AVATAR_CACHE_CONFIG.ttlMs;

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  private evictIfNeeded(cache: Map<string, CacheEntry>): void {
    if (cache.size >= this.maxSize) {
      const oldestKey = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .find(([, entry]) => this.isExpired(entry))?.[0];
      if (oldestKey) {
        cache.delete(oldestKey);
      } else {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
    }
  }

  getUserAvatar(key: string): string | undefined {
    const entry = this.userCache.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.userCache.delete(key);
      return undefined;
    }
    return entry.url;
  }

  setUserAvatar(key: string, url: string): void {
    this.evictIfNeeded(this.userCache);
    this.userCache.set(key, { url, timestamp: Date.now() });
  }

  getChannelAvatar(key: string): string | undefined {
    const entry = this.channelCache.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.channelCache.delete(key);
      return undefined;
    }
    return entry.url;
  }

  setChannelAvatar(key: string, url: string): void {
    this.evictIfNeeded(this.channelCache);
    this.channelCache.set(key, { url, timestamp: Date.now() });
  }

  hasUserAvatar(key: string): boolean {
    return !!this.getUserAvatar(key);
  }

  hasChannelAvatar(key: string): boolean {
    return !!this.getChannelAvatar(key);
  }

  clear(): void {
    this.userCache.clear();
    this.channelCache.clear();
  }

  clearUserCache(): void {
    this.userCache.clear();
  }

  clearChannelCache(): void {
    this.channelCache.clear();
  }

  getStats(): { userCacheSize: number; channelCacheSize: number } {
    return {
      userCacheSize: this.userCache.size,
      channelCacheSize: this.channelCache.size,
    };
  }
}
