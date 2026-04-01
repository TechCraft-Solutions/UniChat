/* sys lib */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";

/* models */
import { ChatChannel, ChatMessageEmote, PlatformType } from "@models/chat.model";

/* services */
import { LoggerService } from "@services/core/logger.service";
import {
  CustomEmoteManagerService,
  CustomEmote,
} from "@services/features/custom-emote-manager.service";
import { TwitchViewerCardService } from "@services/providers/twitch-viewer-card.service";
import { IconsCatalogService, PickableIconsEmote } from "@services/ui/icons-catalog.service";
import { KickEmoteLoaderService } from "@services/providers/kick-emote-loader.service";

@Component({
  selector: "app-composer-emote-popover",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./composer-emote-popover.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposerEmotePopoverComponent {
  private readonly customEmotes = inject(CustomEmoteManagerService);
  private readonly iconsCatalog = inject(IconsCatalogService);
  private readonly twitchViewerCard = inject(TwitchViewerCardService);
  private readonly kickEmoteLoader = inject(KickEmoteLoaderService);
  private readonly logger = inject(LoggerService);

  readonly platform = input.required<PlatformType>();
  readonly channel = input<ChatChannel | null>(null);
  readonly composerInput = input<HTMLInputElement | null>(null);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly searchQuery = signal("");
  readonly twitchIconsError = signal<string | null>(null);
  readonly kickEmotesError = signal<string | null>(null);

  private readonly twitchPickable = signal<PickableIconsEmote[]>([]);
  private readonly kickEmotes = signal<ChatMessageEmote[]>([]);

  readonly customList = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.customEmotes.getEmotesForMessageRendering(this.platform());
    if (!q) {
      return list;
    }
    return list.filter((e) => e.code.toLowerCase().includes(q));
  });

  readonly twitchList = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.twitchPickable();
    if (!q) {
      return list;
    }
    return list.filter((e) => e.code.toLowerCase().includes(q));
  });

  readonly kickList = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.kickEmotes();
    if (!q) {
      return list;
    }
    return list.filter((e) => e.code.toLowerCase().includes(q));
  });

  toggle(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      void this.loadEmotesForOpen();
    } else {
      this.searchQuery.set("");
      this.twitchIconsError.set(null);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.searchQuery.set("");
    this.twitchIconsError.set(null);
  }

  private async loadEmotesForOpen(): Promise<void> {
    this.loading.set(true);
    this.twitchPickable.set([]);
    this.kickEmotes.set([]);
    this.twitchIconsError.set(null);
    this.kickEmotesError.set(null);

    try {
      if (this.platform() === "twitch") {
        const ch = this.channel();
        const login = ch?.channelName?.trim();
        let roomId: string | null = null;
        if (login) {
          const info = await this.twitchViewerCard.fetchUserInfo(login);
          if (info?.id && /^\d+$/.test(info.id)) {
            roomId = info.id;
          }
        }
        try {
          const rows = await this.iconsCatalog.listPickableIconsEmotes(roomId);
          this.twitchPickable.set(rows);
        } catch {
          this.twitchIconsError.set("Could not load channel emote set.");
          const globalsOnly = await this.iconsCatalog.listPickableIconsEmotes(null);
          this.twitchPickable.set(globalsOnly);
        }
      } else if (this.platform() === "kick") {
        const ch = this.channel();
        const channelSlug = ch?.channelName?.trim();
        if (channelSlug) {
          try {
            const emotes = await this.kickEmoteLoader.fetchChannelEmotes(channelSlug);
            this.kickEmotes.set(emotes);
          } catch (error) {
            this.kickEmotesError.set("Could not load Kick emotes.");
            this.logger.warn("ComposerEmotePopoverComponent", "Failed to load Kick emotes", error);
          }
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  pickCustom(emote: CustomEmote): void {
    this.appendCode(emote.code);
  }

  pickTwitch(emote: PickableIconsEmote): void {
    this.appendCode(emote.code);
  }

  pickKick(emote: ChatMessageEmote): void {
    // Insert Kick emote in bracket format: [emote:id:name]
    const bracketCode = `[emote:${emote.id}:${emote.code}]`;
    this.appendCode(bracketCode);
  }

  private appendCode(code: string): void {
    const el = this.composerInput();
    if (!el || !code) {
      return;
    }
    const next = `${el.value}${code} `;
    el.value = next;
    el.focus();
  }
}
