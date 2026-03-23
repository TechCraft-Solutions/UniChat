import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ChatListService } from "@services/data/chat-list.service";
import { ChatMessagePresentationService } from "@services/ui/chat-message-presentation.service";
import { DashboardChatInteractionService } from "@services/ui/dashboard-chat-interaction.service";
import { DashboardFeedDataService } from "@services/ui/dashboard-feed-data.service";
import { ChatScrollRegionDirective } from "@directives/chat-scroll-region.directive";
import { ChatMessageCardComponent } from "@components/chat-message-card/chat-message-card.component";

@Component({
  selector: "app-dashboard-mixed-feed",
  host: {
    class: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
  },
  imports: [ChatScrollRegionDirective, ChatMessageCardComponent],
  templateUrl: "./dashboard-mixed-feed.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardMixedFeedComponent {
  readonly feedData = inject(DashboardFeedDataService);
  readonly chatListService = inject(ChatListService);
  readonly presentation = inject(ChatMessagePresentationService);
  readonly interactions = inject(DashboardChatInteractionService);

  readonly disabledChannels = signal<Set<string>>(new Set());

  toggleChannelFilter(channelId: string): void {
    this.disabledChannels.update((disabled) => {
      const next = new Set(disabled);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }

  isChannelDisabled(channelId: string): boolean {
    return this.disabledChannels().has(channelId);
  }

  enableAllChannels(): void {
    this.disabledChannels.set(new Set());
  }

  disableAllChannels(): void {
    const channels = this.chatListService.getVisibleChannels();
    this.disabledChannels.set(new Set(channels.map((ch) => ch.channelId)));
  }
}
