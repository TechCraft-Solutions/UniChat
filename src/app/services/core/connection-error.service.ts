import { Injectable, inject } from "@angular/core";
import { PlatformType, ChannelConnectionError } from "@models/chat.model";
import { ConnectionStateService } from "@services/data/connection-state.service";
import { ChatListService } from "@services/data/chat-list.service";

/**
 * Error codes for connection errors
 */
export const ConnectionErrorCode = {
  // Authentication errors
  AUTH_TOKEN_EXPIRED: "auth_token_expired",
  AUTH_TOKEN_INVALID: "auth_token_invalid",
  AUTH_SCOPE_MISSING: "auth_scope_missing",
  AUTH_FAILED: "auth_failed",

  // Network errors
  NETWORK_OFFLINE: "network_offline",
  NETWORK_TIMEOUT: "network_timeout",
  NETWORK_UNREACHABLE: "network_unreachable",
  WEBSOCKET_CLOSED: "websocket_closed",
  WEBSOCKET_ERROR: "websocket_error",

  // Platform-specific errors
  PLATFORM_RATE_LIMITED: "platform_rate_limited",
  PLATFORM_UNAVAILABLE: "platform_unavailable",
  CHANNEL_NOT_FOUND: "channel_not_found",
  CHANNEL_BANNED: "channel_banned",

  // Generic errors
  UNKNOWN: "unknown",
  INTERNAL_ERROR: "internal_error",
} as const;

/**
 * Connection Error Service - Centralized Error Handling
 *
 * Responsibility: Provides centralized error reporting and categorization
 * for connection-related errors across all platform providers.
 *
 * Usage:
 * ```typescript
 * // In a provider service:
 * this.errorService.reportError(channelId, {
 *   code: ConnectionErrorCode.NETWORK_TIMEOUT,
 *   message: 'Connection timed out',
 *   isRecoverable: true,
 * });
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class ConnectionErrorService {
  private readonly connectionStateService = inject(ConnectionStateService);
  private readonly chatListService = inject(ChatListService);

  /**
   * Report a connection error for a channel
   */
  reportError(
    channelId: string,
    error: Omit<ChannelConnectionError, "occurredAt">
  ): void {
    this.connectionStateService.reportError(channelId, {
      ...error,
      occurredAt: new Date().toISOString(),
    });
  }

  /**
   * Clear error for a channel
   */
  clearError(channelId: string): void {
    this.connectionStateService.clearError(channelId);
  }

  /**
   * Report authentication token expired error
   */
  reportTokenExpired(channelId: string): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.AUTH_TOKEN_EXPIRED,
      message: "Authentication token has expired. Please reconnect your account.",
      isRecoverable: false,
    });
  }

  /**
   * Report authentication failed error
   */
  reportAuthFailed(channelId: string): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.AUTH_FAILED,
      message: "Authentication failed. Please check your credentials.",
      isRecoverable: false,
    });
  }

  /**
   * Report network timeout error
   */
  reportNetworkTimeout(channelId: string, platform: PlatformType): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.NETWORK_TIMEOUT,
      message: `Connection to ${platform} timed out. Retrying...`,
      isRecoverable: true,
    });
  }

  /**
   * Report WebSocket connection error
   */
  reportWebSocketError(channelId: string, platform: PlatformType, isRecoverable = true): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.WEBSOCKET_ERROR,
      message: `WebSocket connection to ${platform} failed.`,
      isRecoverable,
    });
  }

  /**
   * Report rate limit error
   */
  reportRateLimited(channelId: string, platform: PlatformType): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.PLATFORM_RATE_LIMITED,
      message: `Rate limited by ${platform}. Waiting before retry...`,
      isRecoverable: true,
    });
  }

  /**
   * Report channel not found error
   */
  reportChannelNotFound(channelId: string, platform: PlatformType): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.CHANNEL_NOT_FOUND,
      message: `Channel "${channelId}" not found on ${platform}.`,
      isRecoverable: false,
    });
  }

  /**
   * Report generic network error
   */
  reportNetworkError(channelId: string, message: string, isRecoverable = true): void {
    this.reportError(channelId, {
      code: ConnectionErrorCode.NETWORK_UNREACHABLE,
      message,
      isRecoverable,
    });
  }

  /**
   * Handle error from a Promise (convenience method)
   */
  handlePromiseError<T>(
    promise: Promise<T>,
    channelId: string,
    errorAction: (error: unknown) => Omit<ChannelConnectionError, "occurredAt">
  ): Promise<T | null> {
    return promise.catch((error) => {
      this.reportError(channelId, errorAction(error));
      return null;
    });
  }
}
