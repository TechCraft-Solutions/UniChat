/* sys lib */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterOutlet, NavigationEnd } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { Subscription, filter } from "rxjs";

/* services */
import { ThemeService } from "@services/core/theme.service";

/* components */
import { AppSidebarComponent } from "@components/app-sidebar/app-sidebar.component";
import { AppMobileNavComponent } from "@components/app-sidebar/app-mobile-nav.component";
import { DebugPanelComponent } from "@components/debug-panel/debug-panel.component";
import { RouteAwareHeaderComponent } from "@components/shared-header/route-aware-header.component";
import { KeyboardShortcutsDialogComponent } from "@components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.component";

/** Sidebar width in pixels (matches w-16 = 64px) */
const SIDEBAR_WIDTH = 64;

@Component({
  selector: "app-dashboard-layout",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    AppSidebarComponent,
    AppMobileNavComponent,
    DebugPanelComponent,
    RouteAwareHeaderComponent,
    KeyboardShortcutsDialogComponent,
  ],
  templateUrl: "./dashboard-layout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLayoutComponent implements OnDestroy {
  readonly themeService = inject(ThemeService);
  readonly themeMode = this.themeService.themeMode;
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();

  readonly currentPath = signal<string>("");
  readonly showShortcutDialog = signal(false);

  readonly isOnDashboard = computed(() => this.currentPath() === "/dashboard");

  readonly showDebugPanel = computed(() => {
    if (typeof window !== "undefined" && window.localStorage?.getItem("unichat_debug") === "true") {
      return true;
    }
    return false;
  });

  readonly SIDEBAR_WIDTH = SIDEBAR_WIDTH;

  constructor() {
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          this.currentPath.set(event.urlAfterRedirects);
        })
    );
    this.currentPath.set(this.router.url);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  openShortcutDialog(): void {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      void this.router.navigate(["/keyboard-shortcuts"]);
    } else {
      this.showShortcutDialog.set(true);
    }
  }

  closeShortcutDialog(): void {
    this.showShortcutDialog.set(false);
  }
}
