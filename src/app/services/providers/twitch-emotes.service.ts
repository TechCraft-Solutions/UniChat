import { Injectable, inject } from "@angular/core";
import { ChatMessageEmote } from "@models/chat.model";
import { EmoteUrlService } from "@services/ui/emote-url.service";

/**
 * Twitch Emotes Service - Emote Parsing and Resolution
 *
 * Responsibility: Handles Twitch emote parsing, URL resolution, and caching.
 * Supports Twitch native emotes, 7TV, BTTV, and FFZ.
 *
 * This is a focused service extracted from TwitchChatService to improve:
 * - Testability (can test emote parsing independently)
 * - Maintainability (emote logic isolated from IRC logic)
 * - Reusability (emote parsing could be shared across platforms)
 */
@Injectable({
  providedIn: "root",
})
export class TwitchEmotesService {
  private readonly emoteUrlService = inject(EmoteUrlService);

  /**
   * Parse emotes from Twitch IRC tags
   */
  parseEmotesFromTags(emotesTag: string | undefined, message: string): ChatMessageEmote[] {
    if (!emotesTag) {
      return [];
    }

    const emotes: ChatMessageEmote[] = [];
    const emoteList = emotesTag.split("/");

    for (const emote of emoteList) {
      const [id, positions] = emote.split(":");
      if (!positions) {
        continue;
      }

      const positionList = positions.split(",");
      for (const position of positionList) {
        const [start, end] = position.split("-").map(Number);
        const code = message.slice(start, end + 1);

        emotes.push({
          provider: "twitch",
          id,
          code,
          start,
          end,
          url: this.getEmoteUrl(id),
        });
      }
    }

    return emotes;
  }

  /**
   * Get emote URL with proper sizing
   */
  getEmoteUrl(emoteId: string, size: "1.0" | "2.0" | "3.0" = "1.0"): string {
    return this.emoteUrlService.getTwitchEmote(emoteId, size, "dark");
  }

  /**
   * Merge emotes from multiple sources (bracket notation + API)
   */
  mergeEmotes(
    bracketEmotes: ChatMessageEmote[],
    apiEmotes: ChatMessageEmote[]
  ): ChatMessageEmote[] {
    const emoteMap = new Map<string, ChatMessageEmote>();

    // Add bracket emotes first
    for (const emote of bracketEmotes) {
      emoteMap.set(emote.id, emote);
    }

    // Add API emotes (may override bracket emotes with better data)
    for (const emote of apiEmotes) {
      emoteMap.set(emote.id, emote);
    }

    return Array.from(emoteMap.values());
  }

  /**
   * Extract emotes from bracket notation (e.g., [emote:123:name])
   */
  extractBracketEmotes(content: string, getEmoteUrl: (id: string) => string): ChatMessageEmote[] {
    const emotes: ChatMessageEmote[] = [];
    const emoteRegex = /\[emote:(\d+):([^\]]*)\]/g;
    let match;

    while ((match = emoteRegex.exec(content)) !== null) {
      const [, id, code] = match;
      const start = match.index;
      const end = start + match[0].length - 1;

      emotes.push({
        provider: "twitch",
        id,
        code: code || `Emote ${id}`,
        start,
        end,
        url: getEmoteUrl(id),
      });
    }

    return emotes;
  }

  /**
   * Parse emotes from Twitch API response
   */
  parseEmotesFromApi(
    content: string,
    emotes: Array<{ id: string; name: string }> | undefined
  ): ChatMessageEmote[] {
    if (!emotes || emotes.length === 0) {
      return [];
    }

    const parsedEmotes: ChatMessageEmote[] = [];

    for (const emote of emotes) {
      const index = content.indexOf(emote.name);
      if (index === -1) {
        continue;
      }

      parsedEmotes.push({
        provider: "twitch",
        id: emote.id,
        code: emote.name,
        start: index,
        end: index + emote.name.length - 1,
        url: this.getEmoteUrl(emote.id),
      });
    }

    return parsedEmotes;
  }

  /**
   * Calculate emote display range for message rendering
   */
  getEmoteRanges(emotes: ChatMessageEmote[]): Array<{ start: number; end: number; url: string }> {
    return emotes.map(emote => ({
      start: emote.start,
      end: emote.end,
      url: emote.url,
    }));
  }
}
