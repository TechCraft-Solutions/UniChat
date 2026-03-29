/* sys lib */
import { Injectable, inject } from "@angular/core";

/* models */
import { ChatMessage, ChatMessageEmote, PlatformType } from "@models/chat.model";

/* services */
import {
  CustomEmoteManagerService,
  CustomEmote,
} from "@services/features/custom-emote-manager.service";
import { normalizeChatLinkHref } from "@services/ui/link-preview.service";

/* utils */
import { LRUMemoCache } from "@utils/memoization.util";
export interface ChatTextSegment {
  type: "text" | "emote" | "link";
  value: string;
  emote?: ChatMessageEmote;
  /** Present when `type === "link"` — safe http(s) URL. */
  href?: string;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'()[\]]+|www\.[^\s<>"'()[\]]+/gi;

function isWordChar(ch: string): boolean {
  return ch.length > 0 && /[0-9a-zA-Z_]/.test(ch);
}

@Injectable({
  providedIn: "root",
})
export class ChatRichTextService {
  private readonly customEmotes = inject(CustomEmoteManagerService);

  /** LRU cache for segment building (max 500 entries) */
  private readonly segmentCache = new LRUMemoCache<string, ChatTextSegment[]>(500);

  /**
   * Build text segments with memoization for performance
   * Caches results based on message ID and text content
   */
  buildSegments(message: ChatMessage): ChatTextSegment[] {
    const cacheKey = `${message.id}-${message.text}-${message.rawPayload.emotes?.length ?? 0}-${this.customEmotes.emotesRevision()}`;

    return this.segmentCache.get(cacheKey, () => {
      const text = message.text ?? "";
      const emoteChunks = this.buildEmoteSegments(message);
      const out: ChatTextSegment[] = [];

      for (const chunk of emoteChunks) {
        if (chunk.type === "emote") {
          out.push(chunk);
          continue;
        }
        const customParts = this.foldCustomEmotesInPlainText(chunk.value, message.platform);
        for (const part of customParts) {
          if (part.type === "emote") {
            out.push(part);
          } else {
            out.push(...this.splitTextWithLinks(part.value));
          }
        }
      }

      return out.length ? out : [{ type: "text", value: text }];
    });
  }

  private buildEmoteSegments(message: ChatMessage): ChatTextSegment[] {
    const text = message.text ?? "";
    const emotes = [...(message.rawPayload.emotes ?? [])].sort(
      (left, right) => left.start - right.start
    );
    if (!emotes.length || !text.length) {
      return [{ type: "text", value: text }];
    }

    const segments: ChatTextSegment[] = [];
    let cursor = 0;
    for (const emote of emotes) {
      const start = Math.max(0, emote.start);
      const end = Math.min(text.length - 1, emote.end);
      if (start > cursor) {
        segments.push({ type: "text", value: text.slice(cursor, start) });
      }
      if (end >= start) {
        segments.push({
          type: "emote",
          value: text.slice(start, end + 1),
          emote,
        });
      }
      cursor = end + 1;
    }

    if (cursor < text.length) {
      segments.push({ type: "text", value: text.slice(cursor) });
    }

    return segments.length ? segments : [{ type: "text", value: text }];
  }

  private foldCustomEmotesInPlainText(
    text: string,
    platform: PlatformType
  ): Array<ChatTextSegment & { type: "text" | "emote" }> {
    if (!text) {
      return [];
    }
    const emoteList = this.customEmotes.getEmotesForMessageRendering(platform);
    if (emoteList.length === 0) {
      return [{ type: "text", value: text }];
    }

    const out: Array<ChatTextSegment & { type: "text" | "emote" }> = [];
    let i = 0;
    let textBuf = "";
    const flushText = () => {
      if (textBuf) {
        out.push({ type: "text", value: textBuf });
        textBuf = "";
      }
    };

    while (i < text.length) {
      const found = this.findCustomEmoteAt(text, i, emoteList);
      if (found) {
        flushText();
        const start = found.start;
        const end = found.end;
        out.push({
          type: "emote",
          value: text.slice(start, end + 1),
          emote: {
            provider: "custom",
            id: found.emote.id,
            code: found.emote.code,
            start,
            end,
            url: found.emote.url,
          },
        });
        i = end + 1;
      } else {
        textBuf += text[i];
        i++;
      }
    }
    flushText();

    return out.length ? out : [{ type: "text", value: text }];
  }

  private findCustomEmoteAt(
    text: string,
    start: number,
    emotes: CustomEmote[]
  ): { emote: CustomEmote; start: number; end: number } | null {
    let best: CustomEmote | null = null;
    for (const e of emotes) {
      const c = e.code;
      if (!text.startsWith(c, start)) {
        continue;
      }
      const end = start + c.length - 1;
      if (!this.customEmoteBoundaryOk(text, start, end, c)) {
        continue;
      }
      if (!best || c.length > best.code.length) {
        best = e;
      }
    }
    if (!best) {
      return null;
    }
    return { emote: best, start, end: start + best.code.length - 1 };
  }

  private customEmoteBoundaryOk(text: string, start: number, end: number, code: string): boolean {
    if (start > 0 && isWordChar(text[start - 1]) && isWordChar(code[0])) {
      return false;
    }
    if (end < text.length - 1 && isWordChar(text[end + 1]) && isWordChar(code[code.length - 1])) {
      return false;
    }
    return true;
  }

  private splitTextWithLinks(text: string): ChatTextSegment[] {
    if (!text) {
      return [];
    }

    const segments: ChatTextSegment[] = [];
    let lastIndex = 0;
    URL_IN_TEXT.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_IN_TEXT.exec(text)) !== null) {
      const raw = match[0];
      const start = match.index;
      if (start > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, start) });
      }
      const href = normalizeChatLinkHref(raw);
      if (href) {
        segments.push({ type: "link", value: raw, href });
      } else {
        segments.push({ type: "text", value: raw });
      }
      lastIndex = start + raw.length;
    }

    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }

    return segments.length ? segments : [{ type: "text", value: text }];
  }
}
