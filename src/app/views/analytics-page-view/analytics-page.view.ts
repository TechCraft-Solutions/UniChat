/* sys lib */
import { ChangeDetectionStrategy, Component, signal, computed, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { DecimalPipe } from "@angular/common";

/* services */
import { ThemeService } from "@services/core/theme.service";

@Component({
  selector: "app-analytics-page-view",
  standalone: true,
  imports: [MatIconModule, FormsModule, DecimalPipe],
  templateUrl: "./analytics-page.view.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageView {
  readonly themeService = inject(ThemeService);
  readonly themeMode = this.themeService.themeMode;

  readonly timeRangeOptions = ["Last 24 Hours", "Last 7 Days"];
  readonly selectedTimeRange = signal("Last 24 Hours");

  readonly stats = computed(() => {
    return {
      peakViewers: 12402,
      peakViewersChange: 12,
      totalChatMsgs: "45.2k",
      totalChatMsgsStable: true,
      newSubs: 142,
      newSubsChange: 5,
      uniqueChatters: 3890,
      uniqueChattersGreat: true,
    };
  });

  readonly platformDistribution = computed(() => {
    return [
      { name: "Twitch", value: 80, color: "bg-[#9146ff]" },
      { name: "YouTube", value: 33, color: "bg-[#ff0000]" },
      { name: "Kick", value: 40, color: "bg-[#53fc18]" },
    ];
  });
}
