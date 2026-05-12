/* sys lib */
import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { Router, NavigationEnd } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

/* services */
import { ThemeService } from "@services/core/theme.service";

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: "app-mobile-nav",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./app-mobile-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppMobileNavComponent implements OnInit, OnDestroy {
  readonly themeService = inject(ThemeService);
  readonly router = inject(Router);

  readonly navItems: NavItem[] = [
    { path: "/dashboard", icon: "forum", label: "Chat" },
    { path: "/connections", icon: "power", label: "Links" },
    { path: "/analytics", icon: "bar_chart", label: "Stats" },
    { path: "/export", icon: "download", label: "Export" },
    { path: "/settings", icon: "settings", label: "Settings" },
  ];

  readonly themeMode = this.themeService.themeMode;

  activePath: string = "";
  private routerSub: Subscription | null = null;

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
