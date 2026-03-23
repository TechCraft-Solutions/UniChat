import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  getDensityTextClasses,
  getPlatformBadgeClasses,
  getPlatformLabel,
  getWidgetSummary,
} from "@helpers/chat.helper";
import { ChatMessage, DensityMode, PlatformType } from "@models/chat.model";
import { DashboardStateService } from "@services/features/dashboard-state.service";
import { ChatMessagePresentationService } from "@services/ui/chat-message-presentation.service";

@Component({
  selector: "app-overlay-view",
  imports: [RouterLink, MatTooltipModule],
  templateUrl: "./overlay.view.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayView {
  readonly dashboardState = inject(DashboardStateService);
  readonly presentation = inject(ChatMessagePresentationService);

  platformLabel(platform: PlatformType): string {
    return getPlatformLabel(platform);
  }

  platformBadgeClasses(platform: PlatformType): string {
    return `${getPlatformBadgeClasses(platform)} px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]`;
  }

  densityTextClasses(densityMode: DensityMode): string {
    return getDensityTextClasses(densityMode);
  }

  messageTimeLabel(message: ChatMessage): string {
    return new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  featuredSummary(): string {
    const widget = this.dashboardState.featuredWidget();

    if (!widget) {
      return "Widget preview unavailable";
    }

    return getWidgetSummary(widget, this.dashboardState.messages());
  }
}
