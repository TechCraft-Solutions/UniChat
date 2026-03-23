import { Routes } from "@angular/router";
import { DashboardView } from "@views/dashboard-view/dashboard.view";
import { OverlayView } from "@views/overlay-view/overlay.view";

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "dashboard",
  },
  {
    path: "dashboard",
    component: DashboardView,
  },
  {
    path: "overlay",
    component: OverlayView,
  },
  {
    path: "**",
    redirectTo: "dashboard",
  },
];
