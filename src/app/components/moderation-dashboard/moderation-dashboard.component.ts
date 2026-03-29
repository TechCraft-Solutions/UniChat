/* sys lib */
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { NgClass, TitleCasePipe, DecimalPipe } from "@angular/common";

/* models */
import { ChatMessage, PlatformType } from "@models/chat.model";

/* services */
import {
  ModerationService,
  ModerationMacro,
  DEFAULT_MODERATION_MACROS,
} from "@services/features/moderation.service";

/**
 * Moderation Dashboard Component
 *
 * Provides quick access to moderation actions for a selected user/message
 */
@Component({
  selector: "app-moderation-dashboard",
  standalone: true,
  imports: [NgClass, MatIconModule, MatTooltipModule, TitleCasePipe, DecimalPipe],
  templateUrl: "./moderation-dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationDashboardComponent {
  private readonly moderationService = inject(ModerationService);

  readonly message = input<ChatMessage | undefined>(undefined);
  readonly platform = input<PlatformType>("twitch");
  readonly channelId = input<string>("");

  readonly macros = DEFAULT_MODERATION_MACROS;

  /**
   * Get color classes for macro button
   */
  getMacroColorClasses(macro: ModerationMacro): string {
    const colorMap: Record<string, string> = {
      amber:
        "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50",
      orange:
        "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50",
      red: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50",
      slate:
        "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
      emerald:
        "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
      blue: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50",
    };
    const color = macro.color ?? "slate";
    return colorMap[color] ?? colorMap["slate"];
  }

  /**
   * Get icon for moderation action
   */
  getMacroIcon(action: string): string {
    const iconMap: Record<string, string> = {
      timeout: "timer",
      ban: "block",
      unban: "unblock",
      delete: "delete",
      vip: "star",
      unvip: "star_outline",
      mod: "verified",
      unmod: "verified_outlined",
    };
    return iconMap[action] ?? "gavel";
  }

  /**
   * Execute moderation macro
   */
  async executeMacro(macro: ModerationMacro): Promise<void> {
    if (!this.message()) return;

    await this.moderationService.executeMacro(
      this.message()!.platform,
      this.message()!.sourceChannelId,
      this.message()!.author,
      macro
    );
  }

  /**
   * Check if moderation is available
   */
  canModerate(): boolean {
    if (!this.message()) return false;
    return this.moderationService.canModerate(
      this.message()!.platform,
      this.message()!.sourceChannelId
    );
  }

  /**
   * Get available macros for current platform
   */
  getAvailableMacros(): ModerationMacro[] {
    if (!this.message()) return [];
    return this.moderationService.getMacrosForPlatform(this.message()!.platform);
  }
}
