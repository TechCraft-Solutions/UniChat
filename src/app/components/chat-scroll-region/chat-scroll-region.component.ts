/* sys lib */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
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
export class ChatScrollRegionComponent implements AfterViewInit {
  private static readonly detachFromBottomPx = 100;
  private static readonly reattachToBottomPx = 150;
  private static readonly scrollNoiseThresholdPx = 8;

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly scrollToken = input.required<string>();
  readonly messages = input.required<readonly ChatMessage[]>();

  private readonly scrollContainer = viewChild<HTMLElement>("scrollContainer");

  readonly pinnedToBottom = signal(true);
  readonly pendingNewCount = signal(0);
  private snapshotLength = 0;
  private prevMessageLen = 0;
  private prevNewestMessageId: string | null = null;
  private lastScrollTop = 0;
  readonly distanceFromBottom = signal(0);

  readonly showJumpButton = computed(() => {
    return this.distanceFromBottom() > 10 || this.pendingNewCount() > 0;
  });

  readonly showUnreadCount = computed(
    () => this.distanceFromBottom() > 10 && this.pendingNewCount() > 0
  );

  private prevTotalHeight = 0;
  private prevOldestMessageId: string | null = null;

  private getScrollContainer(): HTMLElement | null {
    const container = this.scrollContainer();
    return container ?? null;
  }

  ngAfterViewInit(): void {
    const node = this.getScrollContainer();
    if (!node) return;

    this.prevTotalHeight = node.scrollHeight;

    fromEvent(node, "scroll", { passive: true })
      .pipe(throttleTime(16), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onScroll());

    fromEvent(window, "resize", { passive: true })
      .pipe(throttleTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.pinnedToBottom()) {
          const n = this.getScrollContainer();
          if (n) {
            n.scrollTop = n.scrollHeight;
          }
        }
      });

    if (this.pinnedToBottom()) {
      requestAnimationFrame(() => {
        node.scrollTop = node.scrollHeight;
        this.prevTotalHeight = node.scrollHeight;
      });
    }
  }

  constructor() {
    effect(() => {
      this.scrollToken();
      untracked(() => {
        const node = this.getScrollContainer();
        if (!node) return;

        this.lastScrollTop = node.scrollTop ?? 0;
        this.distanceFromBottom.set(0);
        this.snapshotLength = this.messages().length;
        this.prevNewestMessageId = this.getNewestMessageId();
        this.prevOldestMessageId = this.getOldestMessageId();

        if (this.pinnedToBottom()) {
          this.pendingNewCount.set(0);
          requestAnimationFrame(() => {
            node.scrollTop = node.scrollHeight;
            this.prevTotalHeight = node.scrollHeight;
            this.cdr.markForCheck();
          });
        } else {
          this.pendingNewCount.set(0);
        }

        this.prevMessageLen = this.messages().length;
      });
    });

    this.destroyRef.onDestroy(() => {});

    effect(() => {
      const messages = this.messages();
      const len = messages.length;
      const newestMessageId = this.getNewestMessageId(messages);
      const oldestMessageId = this.getOldestMessageId(messages);
      untracked(() => {
        const delta = len - this.prevMessageLen;
        const grew = len > this.prevMessageLen;
        const newestChanged = newestMessageId !== this.prevNewestMessageId;
        const oldestChanged = oldestMessageId !== this.prevOldestMessageId;
        const wasPrepend = grew && oldestChanged && !newestChanged;
        const wasAppend = grew && newestChanged;

        this.prevMessageLen = len;
        this.prevNewestMessageId = newestMessageId;
        this.prevOldestMessageId = oldestMessageId;

        if (!grew) {
          if (len < this.snapshotLength) {
            this.snapshotLength = len;
            this.pendingNewCount.set(0);
          }
          return;
        }

        if (wasPrepend) {
          this.snapshotLength = Math.max(0, this.snapshotLength + delta);
          this.preserveScrollPositionOnPrepend();
          return;
        }

        if (!newestChanged) {
          this.snapshotLength = Math.max(0, this.snapshotLength + delta);
          return;
        }

        if (this.pinnedToBottom()) {
          this.pendingNewCount.set(0);
          this.snapshotLength = len;
          requestAnimationFrame(() => {
            const node = this.getScrollContainer();
            if (!node) return;
            node.scrollTop = node.scrollHeight;
            this.prevTotalHeight = node.scrollHeight;
            this.distanceFromBottom.set(0);
            this.cdr.markForCheck();
          });
        } else {
          this.pendingNewCount.update((count) => count + delta);
          this.cdr.markForCheck();
        }
      });
    });
  }

  onScroll(): void {
    const node = this.getScrollContainer();
    if (!node) return;

    const scrollTop = node.scrollTop;
    const distance = Math.max(0, node.scrollHeight - node.scrollTop - node.clientHeight);
    this.distanceFromBottom.set(distance);

    const isAtBottom = distance === 0;
    const shouldReattach = distance <= ChatScrollRegionComponent.reattachToBottomPx;

    if (!this.pinnedToBottom() && (isAtBottom || shouldReattach)) {
      this.pinnedToBottom.set(true);
      this.snapshotLength = this.messages().length;
      this.pendingNewCount.set(0);
      this.lastScrollTop = scrollTop;
      this.prevTotalHeight = node.scrollHeight;
      this.cdr.markForCheck();
      return;
    }

    if (this.pinnedToBottom()) {
      const scrollDelta = Math.abs(scrollTop - this.lastScrollTop);

      if (scrollDelta < ChatScrollRegionComponent.scrollNoiseThresholdPx) {
        return;
      }

      if (distance > ChatScrollRegionComponent.detachFromBottomPx) {
        this.pinnedToBottom.set(false);
        this.snapshotLength = this.messages().length;
        this.lastScrollTop = scrollTop;
        this.prevTotalHeight = node.scrollHeight;
        this.cdr.markForCheck();
        return;
      }

      this.lastScrollTop = scrollTop;
      this.prevTotalHeight = node.scrollHeight;
    }
  }

  jumpToBottom(): void {
    const node = this.getScrollContainer();
    if (!node) return;

    node.scrollTop = node.scrollHeight;
    this.pinnedToBottom.set(true);
    this.snapshotLength = this.messages().length;
    this.pendingNewCount.set(0);
    this.distanceFromBottom.set(0);
    this.prevTotalHeight = node.scrollHeight;
    this.cdr.markForCheck();
  }

  private getNewestMessageId(messages: readonly ChatMessage[] = this.messages()): string | null {
    if (messages.length === 0) return null;
    return messages[messages.length - 1]?.id ?? null;
  }

  private getOldestMessageId(messages: readonly ChatMessage[] = this.messages()): string | null {
    if (messages.length === 0) return null;
    return messages[0]?.id ?? null;
  }

  private preserveScrollPositionOnPrepend(): void {
    const node = this.getScrollContainer();
    if (!node) return;

    const newTotalHeight = node.scrollHeight;
    const heightDelta = newTotalHeight - this.prevTotalHeight;

    if (heightDelta > 0) {
      node.scrollTop += heightDelta;
    }

    this.prevTotalHeight = newTotalHeight;
  }
}
