/**
 * Application-wide constants
 * Centralized configuration values for maintainability
 */

export const APP_CONFIG = {
  // Message limits
  MAX_MESSAGES_PER_CHANNEL: 4000,
  MESSAGE_CACHE_SIZE: 10000,

  // History loading
  ROBOTTY_HISTORY_MAX_PAGES: 40,

  // Timing constants (milliseconds)
  RECONNECT_DELAY_MS: 2500,
  MESSAGE_TYPE_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes for "returning" user

  // Cache configuration
  CACHE_STALE_DAYS: 7,

  // Error handling
  ERROR_BACKOFF_MINUTES: 15,

  // Default identifiers
  DEFAULT_WIDGET_ID: "widget-main",
} as const;

/**
 * Type-safe access to app config
 */
export type AppConfig = typeof APP_CONFIG;
