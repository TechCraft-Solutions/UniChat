import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ThemeService } from "@services/core/theme.service";

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  templateUrl: "./app.html",
})
export class App {
  private readonly themeService = inject(ThemeService);

  constructor() {
    this.themeService.hydrateTheme();
  }
}
