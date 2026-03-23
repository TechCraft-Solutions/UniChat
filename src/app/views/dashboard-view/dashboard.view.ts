import { ChangeDetectionStrategy, Component, effect, inject, signal } from "@angular/core";
import { SettingsModal } from "@components/settings-modal/settings-modal";
import { DashboardMixedFeedComponent } from "@components/dashboard-mixed-feed/dashboard-mixed-feed.component";
import { DashboardSplitFeedComponent } from "@components/dashboard-split-feed/dashboard-split-feed.component";
import { FeedMode } from "@models/chat.model";
import { ThemeService } from "@services/core/theme.service";
import { ChatListService } from "@services/data/chat-list.service";
import { DashboardPreferencesService } from "@services/ui/dashboard-preferences.service";
import { ChatProviderCoordinatorService } from "@services/providers/chat-provider-coordinator.service";

@Component({
  selector: "app-dashboard-view",
  imports: [SettingsModal, DashboardSplitFeedComponent, DashboardMixedFeedComponent],
  templateUrl: "./dashboard.view.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardView {
  readonly themeService = inject(ThemeService);
  readonly chatListService = inject(ChatListService);
  readonly dashboardPreferencesService = inject(DashboardPreferencesService);
  readonly chatProviderCoordinator = inject(ChatProviderCoordinatorService);

  readonly themeMode = this.themeService.themeMode;
  readonly feedModes: FeedMode[] = ["mixed", "split"];
  readonly isSettingsOpen = signal(false);

  constructor() {
    effect(() => {
      const channels = this.chatListService.getVisibleChannels();
      for (const channel of channels) {
        this.chatProviderCoordinator.connectChannel(channel.channelId, channel.platform);
      }
    });
  }

  openSettings(): void {
    this.isSettingsOpen.set(true);
  }

  closeSettings(): void {
    this.isSettingsOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  setFeedMode(feedMode: FeedMode): void {
    this.dashboardPreferencesService.setFeedMode(feedMode);
  }

  getFeedMode(): FeedMode {
    return this.dashboardPreferencesService.preferences().feedMode;
  }
}
