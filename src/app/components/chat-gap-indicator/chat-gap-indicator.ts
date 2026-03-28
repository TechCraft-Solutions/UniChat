/* sys lib */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

/* services */
import { ReconnectionService } from "@services/core/reconnection.service";

/**
 * Chat Gap Indicator Component
 * Displays a notification when messages were missed during reconnection
 */
@Component({
  selector: "app-chat-gap-indicator",
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (hasGap && missedCount > 0) {
      <div
        class="mx-4 my-2 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 backdrop-blur-sm dark:text-amber-400"
      >
        <mat-icon class="h-4 w-4">warning</mat-icon>
        <span>
          <strong>{{ missedCount }}</strong> messages missed during reconnection
        </span>
        <button
          type="button"
          (click)="dismiss()"
          class="ml-2 rounded-lg p-1 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
          title="Dismiss"
        >
          <mat-icon class="h-3 w-3">close</mat-icon>
        </button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatGapIndicator implements OnInit, OnDestroy {
  private readonly reconnectionService = inject(ReconnectionService);

  readonly channelId = input.required<string>();

  hasGap = false;
  missedCount = 0;

  private unsubscribe: (() => void) | null = null;

  ngOnInit(): void {
    this.hasGap = this.reconnectionService.hasGap(this.channelId());
    this.missedCount = this.reconnectionService.getMissedCount(this.channelId());

    // Subscribe to gap updates
    this.unsubscribe = this.reconnectionService.onGap(
      this.channelId(),
      (missedCount, _platform) => {
        this.hasGap = missedCount > 0;
        this.missedCount = missedCount;
      }
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  dismiss(): void {
    this.reconnectionService.clearGap(this.channelId());
    this.hasGap = false;
    this.missedCount = 0;
  }
}
