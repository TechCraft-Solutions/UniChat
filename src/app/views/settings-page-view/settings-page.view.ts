/* sys lib */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { UpperCasePipe } from "@angular/common";

/* models */
import { ChatAccount, PlatformType } from "@models/chat.model";

/* services */
import { LocalStorageService } from "@services/core/local-storage.service";
import { ChatListService } from "@services/data/chat-list.service";
import { AuthorizationService } from "@services/features/authorization.service";
import { ChatMessagePresentationService } from "@services/ui/chat-message-presentation.service";
import { ChatHistoryExportService, ExportFormat } from "@services/features/chat-history-export.service";

/* helpers */
import {
  getPlatformBadgeClasses,
  getPlatformLabel,
  YOUTUBE_DATA_API_KEY_STORAGE_KEY,
} from "@helpers/chat.helper";

/* components */
import { BlockedWordsSettingsComponent } from "@components/blocked-words-settings/blocked-words-settings.component";
import { HighlightRulesSettingsComponent } from "@components/highlight-rules-settings/highlight-rules-settings.component";
import { SessionExportSettingsComponent } from "@components/session-export-settings/session-export-settings.component";
@Component({
  selector: "app-settings-page-view",
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    UpperCasePipe,
    BlockedWordsSettingsComponent,
    HighlightRulesSettingsComponent,
    SessionExportSettingsComponent,
  ],
  templateUrl: "./settings-page.view.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageView {
  readonly authorizationService = inject(AuthorizationService);
  readonly chatListService = inject(ChatListService);
  readonly presentation = inject(ChatMessagePresentationService);
  private readonly chatHistoryExport = inject(ChatHistoryExportService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly localStorageService = inject(LocalStorageService);

  readonly platforms: PlatformType[] = ["twitch", "kick", "youtube"];
  readonly getPlatformBadgeClasses = getPlatformBadgeClasses;

  newChannelName = "";
  selectedPlatform: PlatformType = "twitch";
  selectedAccountId = "";
  youtubeApiKey = "";

  /** Edit mode state */
  editingChannelId: string | null = null;
  editingChannelName: string = "";

  /** Export options */
  exportFormat: ExportFormat = "txt";
  exportIncludeTimestamps = true;
  exportIncludePlatform = false;
  exportIncludeBadges = false;
  selectedExportChannelId = "";

  /** Export statistics */
  readonly exportStats = () => this.chatHistoryExport.getExportStats();

  constructor() {
    effect(() => {
      this.youtubeApiKey = this.localStorageService.get(YOUTUBE_DATA_API_KEY_STORAGE_KEY, "");
      this.changeDetectorRef.markForCheck();
    });
  }

  saveYoutubeApiKey(): void {
    const trimmed = this.youtubeApiKey.trim();
    if (trimmed) {
      this.localStorageService.set(YOUTUBE_DATA_API_KEY_STORAGE_KEY, trimmed);
    } else {
      this.localStorageService.remove(YOUTUBE_DATA_API_KEY_STORAGE_KEY);
    }
  }

  authorize(platform: PlatformType): void {
    void this.authorizationService.authorize(platform);
  }

  deauthorize(platform: PlatformType): void {
    void this.authorizationService.deauthorize(platform);
  }

  deauthorizeAccount(platform: PlatformType): void {
    const account = this.getAuthorizedAccounts(platform)[0];
    if (!account) {
      return;
    }
    void this.authorizationService.deauthorizeAccount(account.id, account.platform);
  }

  removeAuthorizedAccount(account: ChatAccount): void {
    void this.authorizationService.deauthorizeAccount(account.id, account.platform);
  }

  addChannel(): void {
    if (!this.newChannelName.trim()) {
      return;
    }

    this.chatListService.addChannel(
      this.selectedPlatform,
      this.newChannelName.trim(),
      undefined,
      this.selectedAccountId || undefined,
      this.authorizationService.getAccountById(this.selectedAccountId)?.username
    );
    this.newChannelName = "";
  }

  removeChannel(channelId: string): void {
    this.chatListService.removeChannel(channelId);
  }

  toggleChannelVisibility(channelId: string): void {
    this.chatListService.toggleChannelVisibility(channelId);
  }

  updateChannelAccount(channelId: string, accountId: string): void {
    this.chatListService.updateChannelAccount(
      channelId,
      accountId || undefined,
      this.authorizationService.getAccountById(accountId)?.username
    );
  }

  /** Start editing a channel name */
  startEditChannel(channelId: string, currentName: string): void {
    this.editingChannelId = channelId;
    this.editingChannelName = currentName;
    this.changeDetectorRef.markForCheck();
  }

  /** Save edited channel name */
  saveEditChannel(): void {
    if (!this.editingChannelId || !this.editingChannelName.trim()) {
      return;
    }
    this.chatListService.updateChannelName(this.editingChannelId, this.editingChannelName.trim());
    this.editingChannelId = null;
    this.editingChannelName = "";
    this.changeDetectorRef.markForCheck();
  }

  /** Cancel editing */
  cancelEditChannel(): void {
    this.editingChannelId = null;
    this.editingChannelName = "";
    this.changeDetectorRef.markForCheck();
  }

  getAuthorizedAccounts(platform: PlatformType) {
    return this.authorizationService.accounts().filter((account) => account.platform === platform);
  }

  getChannelManagementAccounts(): ChatAccount[] {
    return this.authorizationService.accounts();
  }

  getAccountLabelById(accountId: string | undefined): string | null {
    if (!accountId) {
      return null;
    }
    const account = this.getChannelManagementAccounts().find((item) => item.id === accountId);
    return account?.username ?? null;
  }

  getPlatformLbl(platform: PlatformType): string {
    return getPlatformLabel(platform);
  }

  getChannelNamePlaceholder(): string {
    return this.selectedPlatform === "youtube"
      ? "YouTube live video ID or watch/live URL"
      : "Channel name...";
  }

  /** Export all chat history */
  async exportAllHistory(): Promise<void> {
    try {
      await this.chatHistoryExport.exportAllHistory({
        format: this.exportFormat,
        includeTimestamps: this.exportIncludeTimestamps,
        includePlatform: this.exportIncludePlatform,
        includeBadges: this.exportIncludeBadges,
        dateFormat: "iso",
      });
    } catch (error) {
      console.error("Failed to export all history:", error);
    }
  }

  /** Export selected channel history */
  async exportSelectedChannel(): Promise<void> {
    const channelId = this.selectedExportChannelId;
    if (!channelId) {
      return;
    }

    const channel = this.chatListService.channels().find((ch) => ch.id === channelId);
    if (!channel) {
      return;
    }

    try {
      await this.chatHistoryExport.exportChannelHistory(channel.channelId, channel.platform, {
        format: this.exportFormat,
        includeTimestamps: this.exportIncludeTimestamps,
        includePlatform: this.exportIncludePlatform,
        includeBadges: this.exportIncludeBadges,
        dateFormat: "time",
      });
    } catch (error) {
      console.error("Failed to export channel history:", error);
    }
  }
}
