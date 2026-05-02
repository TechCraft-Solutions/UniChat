/* sys lib */
import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet } from "@angular/router";

/* components */
import { AppSidebarComponent } from "@components/app-sidebar/app-sidebar.component";
import { DebugPanelComponent } from "@components/debug-panel/debug-panel.component";
import { ENVIRONMENT } from "../../environments/environment";

/** Sidebar width in pixels (matches w-14 = 56px) */
const SIDEBAR_WIDTH = 56;

@Component({
  selector: "app-dashboard-layout",
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppSidebarComponent, DebugPanelComponent],
  templateUrl: "./dashboard-layout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLayoutComponent {
  readonly showSidebar = computed(() => {
    return true;
  });

  readonly showDebugPanel = computed(() => {
    if (ENVIRONMENT.DEBUG_PANEL_ENABLED) {
      return true;
    }
    if (typeof window !== "undefined" && window.localStorage?.getItem("unichat_debug") === "true") {
      return true;
    }
    return false;
  });

  readonly SIDEBAR_WIDTH = SIDEBAR_WIDTH;
}
