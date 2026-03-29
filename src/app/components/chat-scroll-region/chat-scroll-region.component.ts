/* sys lib */
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatIconModule } from "@angular/material/icon";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { fromEvent } from "rxjs";
import { throttleTime } from "rxjs/operators";

/* models */
import { ChatMessage } from "@models/chat.model";
@Component({
  selector: "app-chat-scroll-region",
  standalone: true,
  imports: [MatIconModule, ScrollingModule],
  templateUrl: "./chat-scroll-region.component.html",
  host: {
    class: "flex min-h-0 min-w-0 flex-1 flex-col",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatScrollRegionComponent {
  private static readonly nearBottomPx = 400; // Increased threshold for better "near bottom" detection (Twitch-like)
  private static readonly suppressAutoScrollThresholdPx = 30; // Reduced to detect smaller intentional scrolls
  private static readonly messageItemHeight = 80; // Approximate height in pixels for virtual scroll
  private static readonly scrollBehavior: ScrollBehavior = "smooth"; // Smooth scroll animation

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly scrollToken = input.required<string>();
  readonly messages = input.required<readonly ChatMessage[]>();

  private readonly viewport = viewChild<ElementRef<HTMLElement>>("viewport");

  private readonly pinnedToBottom = signal(true);
  private readonly atTop = signal(false);
  readonly pendingNewCount = signal(0);
  private snapshotLength = 0;
  private prevMessageLen = 0;
  private lastScrollTop = 0; // Track scroll position to detect intentional scrolling

  readonly showJumpButton = computed(() => !this.pinnedToBottom());
  readonly showUnreadCount = computed(() => !this.pinnedToBottom() && this.pendingNewCount() > 0);

  // Virtual scroll configuration
  readonly virtualScrollItemSize = ChatScrollRegionComponent.messageItemHeight;

  constructor() {
    fromEvent(globalThis, "resize", { passive: true })
      .pipe(throttleTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.pinnedToBottom()) {
          this.scrollToBottom();
        }
      });

    // Add scroll event listener to viewport after it's initialized
    afterNextRender(() => {
      const node = this.viewport()?.nativeElement;
      if (node) {
        node.addEventListener('scroll', () => this.onScroll(), { passive: true });
      }
    });

    effect(() => {
      this.scrollToken();
      untracked(() => {
        // When scroll token changes (channel switch), reset to bottom
        // BUT only if user is currently at bottom - respect their scroll position if scrolled up
        const node = this.viewport()?.nativeElement;
        const distance = node ? node.scrollHeight - node.scrollTop - node.clientHeight : 0;
        const nearBottom = distance <= ChatScrollRegionComponent.nearBottomPx;

        // Reset scroll tracking for new channel
        this.lastScrollTop = node?.scrollTop ?? 0;

        if (nearBottom) {
          // User is at bottom - scroll to new bottom
          this.pinnedToBottom.set(true);
          this.pendingNewCount.set(0);
          runInInjectionContext(this.injector, () => {
            afterNextRender(() => {
              queueMicrotask(() => {
                requestAnimationFrame(() => this.scrollToBottom());
              });
            });
          });
        } else {
          // User is scrolled up - keep their position, just update snapshot
          this.snapshotLength = this.messages().length;
          this.pendingNewCount.set(0);
        }

        this.prevMessageLen = this.messages().length;
      });
    });

    effect(() => {
      const len = this.messages().length;
      untracked(() => {
        const grew = len > this.prevMessageLen;
        this.prevMessageLen = len;

        // CRITICAL: Only auto-scroll when pinnedToBottom is true
        // When user scrolls up, pinnedToBottom becomes false and STAYS false
        // until they manually scroll back to bottom or click "Latest" button
        if (this.pinnedToBottom() && grew) {
          // We're at bottom and new messages arrived - auto-scroll
          this.pendingNewCount.set(0);
          this.snapshotLength = len;

          runInInjectionContext(this.injector, () => {
            afterNextRender(() => {
              requestAnimationFrame(() => this.scrollToBottom());
            });
          });
          return;
        }

        // User scrolled up OR messages were prepended (history) - don't auto-scroll
        // Just count pending messages
        if (grew) {
          this.pendingNewCount.set(Math.max(0, len - this.snapshotLength));
        }
      });
    });
  }

  onScroll(): void {
    const node = this.viewport()?.nativeElement;
    if (!node) {
      return;
    }

    const scrollTop = node.scrollTop;
    const scrollDelta = Math.abs(scrollTop - this.lastScrollTop);

    // Ignore tiny scroll movements (less than 50px) to prevent accidental button toggle
    if (scrollDelta < ChatScrollRegionComponent.suppressAutoScrollThresholdPx) {
      return;
    }

    this.lastScrollTop = scrollTop;

    const distance = node.scrollHeight - scrollTop - node.clientHeight;
    const nearBottom = distance <= ChatScrollRegionComponent.nearBottomPx;

    // User scrolled UP (away from bottom) - disable auto-scroll
    if (!nearBottom) {
      if (this.pinnedToBottom()) {
        // First time scrolling up intentionally - mark as not pinned
        this.pinnedToBottom.set(false);
        this.snapshotLength = this.messages().length;
      }
      // Keep pinnedToBottom=false while scrolled up
    }
    // User scrolled DOWN to bottom - re-enable auto-scroll
    else if (nearBottom && !this.pinnedToBottom()) {
      this.pinnedToBottom.set(true);
      this.snapshotLength = this.messages().length;
      this.pendingNewCount.set(0);
    }
  }

  jumpToBottom(): void {
    this.scrollToBottom(true); // Use smooth scroll when user clicks button
    this.pinnedToBottom.set(true);
    this.snapshotLength = this.messages().length;
    this.pendingNewCount.set(0);
  }

  private scrollToBottom(smooth: boolean = false): void {
    const node = this.viewport()?.nativeElement;
    if (node) {
      if (smooth) {
        // Use smooth scrolling for user-initiated jumps
        node.scrollTo({
          top: node.scrollHeight,
          behavior: ChatScrollRegionComponent.scrollBehavior,
        });
      } else {
        // Instant scroll for auto-scroll on new messages
        node.scrollTop = node.scrollHeight;
      }
    }
  }
}
