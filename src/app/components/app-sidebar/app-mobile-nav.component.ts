/* sys lib */
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { Router } from "@angular/router";

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
export class AppMobileNavComponent {
  readonly themeService = inject(ThemeService);

  readonly navItems: NavItem[] = [
    { path: "/dashboard", icon: "home", label: "Home" },
    { path: "/settings", icon: "settings", label: "Settings" },
  ];

  readonly themeMode = this.themeService.themeMode;

  constructor(private readonly router: Router) {}

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  navigate(path: string): void {
    void this.router.navigate([path]);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
