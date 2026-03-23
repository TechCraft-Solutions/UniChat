import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { MatIconModule } from "@angular/material/icon";
import { ChatChannel, PlatformType } from "@models/chat.model";
import { ChatStateService } from "@services/data/chat-state.service";
import { ChatMessagePresentationService } from "@services/ui/chat-message-presentation.service";
import { DashboardChatInteractionService } from "@services/ui/dashboard-chat-interaction.service";
import { DashboardFeedDataService } from "@services/ui/dashboard-feed-data.service";
import { DashboardPreferencesService } from "@services/ui/dashboard-preferences.service";
import { SplitFeedUiService } from "@services/ui/split-feed-ui.service";
import { ChatScrollRegionDirective } from "@directives/chat-scroll-region.directive";
import { ChatMessageCardComponent } from "@components/chat-message-card/chat-message-card.component";

@Component({
  selector: "app-dashboard-split-feed",
  host: {
    class: "flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden",
  },
  imports: [DragDropModule, MatIconModule, ChatScrollRegionDirective, ChatMessageCardComponent],
  templateUrl: "./dashboard-split-feed.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardSplitFeedComponent {
  readonly feedData = inject(DashboardFeedDataService);
  readonly presentation = inject(ChatMessagePresentationService);
  readonly interactions = inject(DashboardChatInteractionService);
  readonly splitUi = inject(SplitFeedUiService);
  private readonly chatStateService = inject(ChatStateService);
  private readonly dashboardPreferencesService = inject(DashboardPreferencesService);

  constructor() {
    effect(() => {
      for (const platform of this.feedData.visiblePlatformsInOrder()) {
        const channels = this.feedData.orderedChannelsForPlatform(platform);
        this.splitUi.ensureActiveChannel(platform, channels);
      }
    });
  }

  orderedChannels(platform: PlatformType): ChatChannel[] {
    return this.feedData.orderedChannelsForPlatform(platform);
  }

  activeChannel(platform: PlatformType): ChatChannel | undefined {
    const id = this.splitUi.activeChannelId(platform);
    const list = this.orderedChannels(platform);
    return list.find((c) => c.channelId === id) ?? list[0];
  }

  activeChannelId(platform: PlatformType): string | undefined {
    return this.activeChannel(platform)?.channelId;
  }

  selectChannel(platform: PlatformType, channel: ChatChannel): void {
    this.splitUi.setActiveChannel(platform, channel.channelId);
  }

  isChannelActive(platform: PlatformType, channel: ChatChannel): boolean {
    return this.activeChannelId(platform) === channel.channelId;
  }

  sendSplitComposer(platform: PlatformType, input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text) {
      return;
    }
    const reply = this.interactions.replyTargetMessage();
    if (this.interactions.replyTargetMessageId() && reply?.platform === platform) {
      this.interactions.submitReplyFromComposer(text);
      input.value = "";
      return;
    }
    const ch = this.activeChannel(platform);
    if (!ch) {
      return;
    }
    this.chatStateService.sendOutgoingChatMessage(ch.channelId, platform, text);
    input.value = "";
  }

  composerPlaceholder(platform: PlatformType): string {
    const reply = this.interactions.replyTargetMessage();
    if (this.interactions.replyTargetMessageId() && reply?.platform === platform) {
      return "Write a reply…";
    }
    return "Send message…";
  }

  onPlatformDrop(event: CdkDragDrop<PlatformType[]>): void {
    const ordered = [...this.feedData.orderedPlatforms()];
    const byPlatform = this.feedData.channelsByPlatform();
    const visibleCopy = [...this.feedData.visiblePlatformsInOrder()];
    moveItemInArray(visibleCopy, event.previousIndex, event.currentIndex);
    let vi = 0;
    const merged = ordered.map((p) => {
      if ((byPlatform[p]?.length ?? 0) > 0) {
        return visibleCopy[vi++]!;
      }
      return p;
    });
    this.dashboardPreferencesService.setSplitOrderedPlatforms(merged);
  }
}
