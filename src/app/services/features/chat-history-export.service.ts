/* sys lib */
import { Injectable, inject } from "@angular/core";

/* models */
import { ChatMessage, PlatformType } from "@models/chat.model";

/* services */
import { ChatStorageService } from "@services/data/chat-storage.service";
import { ChatListService } from "@services/data/chat-list.service";
import { buildChannelRef } from "@utils/channel-ref.util";

/**
 * Export format options
 */
export type ExportFormat = "json" | "txt" | "csv";

/**
 * Export configuration
 */
export interface ExportOptions {
  format: ExportFormat;
  includeTimestamps: boolean;
  includePlatform: boolean;
  includeBadges: boolean;
  dateFormat: "iso" | "time" | "custom";
  customDateFormat?: string;
}

/**
 * Chat History Export Service
 *
 * Provides functionality to export chat history to various formats:
 * - JSON: Full message data with metadata
 * - TXT: Human-readable chat log
 * - CSV: Spreadsheet-compatible format
 */
@Injectable({
  providedIn: "root",
})
export class ChatHistoryExportService {
  private readonly chatStorage = inject(ChatStorageService);
  private readonly chatList = inject(ChatListService);

  /**
   * Export chat history for a specific channel
   */
  async exportChannelHistory(
    channelId: string,
    platform: PlatformType,
    options: ExportOptions = {
      format: "txt",
      includeTimestamps: true,
      includePlatform: false,
      includeBadges: false,
      dateFormat: "time",
    }
  ): Promise<void> {
    const messages = this.chatStorage.getMessagesByChannel(buildChannelRef(platform, channelId));
    const channel = this.chatList.getChannels(platform).find((ch) => ch.channelId === channelId);
    const channelName = channel?.channelName ?? channelId;

    const content = this.formatMessages(messages, options);
    const filename = this.generateFilename(channelName, platform, options.format);

    await this.saveFile(content, filename, this.getMimeType(options.format));
  }

  /**
   * Export all chat history across all channels
   */
  async exportAllHistory(
    options: ExportOptions = {
      format: "json",
      includeTimestamps: true,
      includePlatform: true,
      includeBadges: true,
      dateFormat: "iso",
    }
  ): Promise<void> {
    const allChannels = this.chatList.getVisibleChannels();
    const allMessages: Record<string, ChatMessage[]> = {};

    for (const channel of allChannels) {
      const messages = this.chatStorage.getMessagesByChannel(
        buildChannelRef(channel.platform, channel.channelId)
      );
      if (messages.length > 0) {
        allMessages[`${channel.platform}:${channel.channelId}`] = messages;
      }
    }

    const content = this.formatMessagesAllChannels(allMessages, options);
    const filename = `unichat-export-all-${this.formatDate(new Date(), "iso")}.${options.format}`;

    await this.saveFile(content, filename, this.getMimeType(options.format));
  }

  /**
   * Format messages according to export options
   */
  private formatMessages(messages: ChatMessage[], options: ExportOptions): string {
    switch (options.format) {
      case "json":
        return this.formatJson(messages, options);
      case "txt":
        return this.formatTxt(messages, options);
      case "csv":
        return this.formatCsv(messages, options);
      default:
        return this.formatTxt(messages, options);
    }
  }

  /**
   * Format messages from all channels
   */
  private formatMessagesAllChannels(
    messagesByChannel: Record<string, ChatMessage[]>,
    options: ExportOptions
  ): string {
    if (options.format === "json") {
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalChannels: Object.keys(messagesByChannel).length,
        totalMessages: Object.values(messagesByChannel).reduce((sum, msgs) => sum + msgs.length, 0),
        channels: messagesByChannel,
      };
      return JSON.stringify(exportData, null, 2);
    }

    // For TXT and CSV, concatenate all channels with separators
    const parts: string[] = [];
    for (const [channelKey, messages] of Object.entries(messagesByChannel)) {
      parts.push(`=== Channel: ${channelKey} ===\n`);
      parts.push(this.formatMessages(messages, options));
      parts.push("\n\n");
    }
    return parts.join("");
  }

  /**
   * Format as JSON
   */
  private formatJson(messages: ChatMessage[], options: ExportOptions): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((msg) => ({
        id: msg.id,
        timestamp: this.formatDate(new Date(msg.timestamp), options.dateFormat),
        platform: options.includePlatform ? msg.platform : undefined,
        author: msg.author,
        text: msg.text,
        badges: options.includeBadges ? msg.badges : undefined,
        isSupporter: msg.isSupporter,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Format as plain text
   */
  private formatTxt(messages: ChatMessage[], options: ExportOptions): string {
    return messages
      .map((msg) => {
        const parts: string[] = [];

        // Timestamp
        if (options.includeTimestamps) {
          parts.push(`[${this.formatDate(new Date(msg.timestamp), options.dateFormat)}]`);
        }

        // Platform badge
        if (options.includePlatform) {
          parts.push(`[${msg.platform.toUpperCase()}]`);
        }

        // Author
        parts.push(`<${msg.author}>`);

        // Badges
        if (options.includeBadges && msg.badges.length > 0) {
          parts.push(`[${msg.badges.join(", ")}]`);
        }

        // Message text
        parts.push(msg.text);

        return parts.join(" ");
      })
      .join("\n");
  }

  /**
   * Format as CSV
   */
  private formatCsv(messages: ChatMessage[], options: ExportOptions): string {
    const headers = ["Timestamp", "Platform", "Author", "Badges", "Text"];
    const rows = [headers.join(",")];

    for (const msg of messages) {
      const row = [
        this.escapeCsvField(this.formatDate(new Date(msg.timestamp), options.dateFormat)),
        options.includePlatform ? this.escapeCsvField(msg.platform) : "",
        this.escapeCsvField(msg.author),
        options.includeBadges ? this.escapeCsvField(msg.badges.join("; ")) : "",
        this.escapeCsvField(msg.text),
      ];
      rows.push(row.join(","));
    }

    return rows.join("\n");
  }

  /**
   * Escape CSV field (handle commas and quotes)
   */
  private escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Format date according to options
   */
  private formatDate(date: Date, format: ExportOptions["dateFormat"]): string {
    switch (format) {
      case "iso":
        return date.toISOString();
      case "time":
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      case "custom":
        return date.toLocaleString();
      default:
        return date.toLocaleTimeString();
    }
  }

  /**
   * Generate filename for export
   */
  private generateFilename(
    channelName: string,
    platform: PlatformType,
    format: ExportFormat
  ): string {
    const timestamp = this.formatDate(new Date(), "iso").replace(/[:.]/g, "-");
    const safeChannelName = channelName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return `unichat-${platform}-${safeChannelName}-${timestamp}.${format}`;
  }

  /**
   * Get MIME type for export format
   */
  private getMimeType(format: ExportFormat): string {
    switch (format) {
      case "json":
        return "application/json";
      case "txt":
        return "text/plain";
      case "csv":
        return "text/csv";
      default:
        return "text/plain";
    }
  }

  /**
   * Save file using browser download
   */
  private async saveFile(content: string, filename: string, mimeType: string): Promise<void> {
    try {
      // Create blob
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to save export file:", error);
      throw new Error(`Export failed: ${error}`);
    }
  }

  /**
   * Get export statistics
   */
  getExportStats(): {
    totalChannels: number;
    totalMessages: number;
    byPlatform: Record<PlatformType, number>;
  } {
    const allChannels = this.chatList.getVisibleChannels();
    const byPlatform: Record<PlatformType, number> = {
      twitch: 0,
      kick: 0,
      youtube: 0,
    };

    let totalMessages = 0;
    for (const channel of allChannels) {
      const messages = this.chatStorage.getMessagesByChannel(
        buildChannelRef(channel.platform, channel.channelId)
      );
      byPlatform[channel.platform] += messages.length;
      totalMessages += messages.length;
    }

    return {
      totalChannels: allChannels.length,
      totalMessages,
      byPlatform,
    };
  }
}
