import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { PlatformType } from "@models/chat.model";
import { AuthorizationService } from "@services/features/authorization.service";
import { ChatListService } from "@services/data/chat-list.service";
import {
  getAuthorizationUrl,
  getPlatformBadgeClasses,
  getPlatformLabel,
} from "@helpers/chat.helper";

@Component({
  selector: "app-settings-modal",
  imports: [FormsModule, MatIconModule],
  templateUrl: "./settings-modal.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsModal {
  readonly authorizationService = inject(AuthorizationService);
  readonly chatListService = inject(ChatListService);

  readonly isOpen = input<boolean>(false);
  readonly closed = output<void>();

  readonly platforms: PlatformType[] = ["twitch", "kick", "youtube"];
  readonly getPlatformBadgeClasses = getPlatformBadgeClasses;

  newChannelName = "";
  selectedPlatform: PlatformType = "twitch";

  close(): void {
    this.closed.emit();
  }

  authorize(platform: PlatformType): void {
    this.authorizationService.authorize(platform);
  }

  deauthorize(platform: PlatformType): void {
    this.authorizationService.deauthorize(platform);
  }

  addChannel(): void {
    if (!this.newChannelName.trim()) {
      return;
    }

    this.chatListService.addChannel(this.selectedPlatform, this.newChannelName.trim());
    this.newChannelName = "";
  }

  removeChannel(channelId: string): void {
    this.chatListService.removeChannel(channelId);
  }

  toggleChannelVisibility(channelId: string): void {
    this.chatListService.toggleChannelVisibility(channelId);
  }

  getAuthUrl(platform: PlatformType): string {
    return getAuthorizationUrl(platform);
  }

  getPlatformLbl(platform: PlatformType): string {
    return getPlatformLabel(platform);
  }
}
