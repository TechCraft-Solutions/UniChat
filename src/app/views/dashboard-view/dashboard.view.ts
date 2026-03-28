/* sys lib */
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

/* models */
import { FeedMode, PlatformType, ChatMessage } from "@models/chat.model";

/* services */
import { ChatListService } from "@services/data/chat-list.service";
import { ChatStateManagerService } from "@services/data/chat-state-manager.service";
import { ChatStateService } from "@services/data/chat-state.service";
import { DashboardStateService } from "@services/features/dashboard-state.service";
import { ChatProviderCoordinatorService } from "@services/providers/chat-provider-coordinator.service";
import { DashboardFeedDataService } from "@services/ui/dashboard-feed-data.service";
import { DashboardPreferencesService } from "@services/ui/dashboard-preferences.service";
import { KeyboardShortcutsService } from "@services/ui/keyboard-shortcuts.service";
import { OverlaySourceBridgeService } from "@services/ui/overlay-source-bridge.service";
import { PinnedMessagesService } from "@services/ui/pinned-messages.service";

/* components */
import { ChatSearchComponent } from "@components/chat-search/chat-search.component";
import { DashboardMixedFeedComponent } from "@components/dashboard-mixed-feed/dashboard-mixed-feed.component";
import { DashboardSplitFeedComponent } from "@components/dashboard-split-feed/dashboard-split-feed.component";
import { KeyboardShortcutsHelpComponent } from "@components/keyboard-shortcuts-help/keyboard-shortcuts-help.component";
import { PinnedMessagesPanelComponent } from "@components/pinned-messages-panel/pinned-messages-panel.component";
import { UserProfilePopoverComponent } from "@components/user-profile-popover/user-profile-popover";
@Component({
  selector: "app-dashboard-view",
  standalone: true,
  imports: [
    DashboardSplitFeedComponent,
    DashboardMixedFeedComponent,
    UserProfilePopoverComponent,
    MatIconModule,
    ChatSearchComponent,
    PinnedMessagesPanelComponent,
    KeyboardShortcutsHelpComponent,
  ],
  templateUrl: "./dashboard.view.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardView {
  readonly chatListService = inject(ChatListService);
  readonly dashboardPreferencesService = inject(DashboardPreferencesService);
  readonly chatProviderCoordinator = inject(ChatProviderCoordinatorService);
  readonly dashboardStateService = inject(DashboardStateService);
  readonly overlaySourceBridge = inject(OverlaySourceBridgeService);
  private readonly feedData = inject(DashboardFeedDataService);
  private readonly chatStateManager = inject(ChatStateManagerService);
  private readonly chatStateService = inject(ChatStateService);
  private readonly pinnedMessagesService = inject(PinnedMessagesService);
  private readonly keyboardShortcutsService = inject(KeyboardShortcutsService);

  // Reference to split feed component for resetting sizes
  readonly splitFeed = viewChild<DashboardSplitFeedComponent>(DashboardSplitFeedComponent);

  readonly feedModes: FeedMode[] = ["mixed", "split"];
  readonly showSearch = signal(false);
  readonly showPinned = signal(false);
  readonly showShortcuts = signal(false);
  readonly pinnedCount = this.pinnedMessagesService.pinnedCount;

  constructor() {
    const featured = this.dashboardStateService.featuredWidget();
    const port = featured?.port ?? 1421;
    void this.overlaySourceBridge.ensureConnected(port);

    // Track channel connections using global state from ChatStateManagerService.
    // This prevents re-connecting channels when navigating back from settings.
    effect(() => {
      const channels = this.feedData.allVisibleChannels();

      // Only connect channels that aren't already connected globally
      for (const ch of channels) {
        if (!this.chatStateManager.isChannelConnected(ch.channelId)) {
          this.chatProviderCoordinator.connectChannel(ch.channelId, ch.platform);
          this.chatStateManager.markChannelAsConnected(ch.channelId);
        }
      }
    });

    // Register keyboard shortcuts
    this.keyboardShortcutsService.register("Ctrl+K", () => this.toggleSearch());
    this.keyboardShortcutsService.register("Ctrl+P", () => this.togglePinned());
    this.keyboardShortcutsService.register("Ctrl+M", () => this.toggleFeedMode());
    this.keyboardShortcutsService.register("Ctrl+?", () => this.toggleShortcuts());
    this.keyboardShortcutsService.register("F1", () => this.toggleShortcuts());
    this.keyboardShortcutsService.register("Escape", () => this.closeAllModals());
  }

  toggleFeedMode(): void {
    const current = this.getFeedMode();
    const next: FeedMode = current === "mixed" ? "split" : "mixed";
    this.setFeedMode(next);
  }

  closeAllModals(): void {
    if (this.showSearch()) {
      this.showSearch.set(false);
    } else if (this.showPinned()) {
      this.showPinned.set(false);
    } else if (this.showShortcuts()) {
      this.showShortcuts.set(false);
    }
  }

  setFeedMode(feedMode: FeedMode): void {
    this.dashboardPreferencesService.setFeedMode(feedMode);
  }

  getFeedMode(): FeedMode {
    return this.dashboardPreferencesService.preferences().feedMode;
  }

  resetSplitSizes(): void {
    this.splitFeed()?.resetBlockSizes();
  }

  toggleSearch(): void {
    this.showSearch.update((show) => !show);
  }

  togglePinned(): void {
    this.showPinned.update((show) => !show);
  }

  toggleShortcuts(): void {
    this.showShortcuts.update((show) => !show);
  }

  onMessageSelected(message: ChatMessage): void {
    // Highlight the selected message
    this.chatStateService.highlightMessage(message.id);
    this.showSearch.set(false);
  }
}
