/* sys lib */
import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { Router, RouterEvent, NavigationEnd } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

/* services */
import { ThemeService } from "@services/core/theme.service";
interface MenuItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./app-sidebar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent implements OnInit, OnDestroy {
  readonly themeService = inject(ThemeService);

  readonly menu: MenuItem[] = [
    { path: "/dashboard", icon: "forum", label: "UniChat" },
    { path: "/connections", icon: "power", label: "Platforms" },
    { path: "/analytics", icon: "bar_chart", label: "Analytics" },
    { path: "/export", icon: "download", label: "Export Chat" },
    { path: "/settings", icon: "settings", label: "Settings" },
    { path: "/updates", icon: "system_update", label: "Updates" },
  ];

  readonly themeMode = this.themeService.themeMode;

  private readonly router = inject(Router);
  private routerSub: Subscription | null = null;

  activePath: string = "";

  ngOnInit(): void {
    this.activePath = this.router.url;
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.activePath = event.urlAfterRedirects;
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  isActive(path: string): boolean {
    return this.activePath === path;
  }

  navigate(path: string): void {
    this.activePath = path;
    void this.router.navigate([path]);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
