import {
  afterNextRender,
  Directive,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  Injector,
  input,
  untracked,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";
import { throttleTime } from "rxjs/operators";

@Directive({
  selector: "[appChatScrollRegion]",
  standalone: true,
})
export class ChatScrollRegionDirective {
  private static readonly nearBottomPx = 64;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private pinnedToBottom = true;

  readonly scrollToken = input.required<string>({ alias: "appChatScrollRegion" });

  constructor() {
    fromEvent(this.el.nativeElement, "scroll", { passive: true })
      .pipe(throttleTime(50), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updatePinnedFromScroll());

    fromEvent(globalThis, "resize", { passive: true })
      .pipe(throttleTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.pinnedToBottom) {
          this.scrollToBottom();
        }
      });

    effect(() => {
      this.scrollToken();
      untracked(() => {
        afterNextRender(
          () => {
            if (!this.pinnedToBottom) {
              return;
            }
            queueMicrotask(() => {
              requestAnimationFrame(() => {
                if (this.pinnedToBottom) {
                  this.scrollToBottom();
                }
              });
            });
          },
          { injector: this.injector }
        );
      });
    });
  }

  private updatePinnedFromScroll(): void {
    const node = this.el.nativeElement;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    this.pinnedToBottom = distance <= ChatScrollRegionDirective.nearBottomPx;
  }

  private scrollToBottom(): void {
    const node = this.el.nativeElement;
    node.scrollTop = node.scrollHeight;
  }
}
