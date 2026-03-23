import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ChatMessage } from "@models/chat.model";
import { ChatMessagePresentationService } from "@services/ui/chat-message-presentation.service";
import { DashboardChatInteractionService } from "@services/ui/dashboard-chat-interaction.service";

@Component({
  selector: "app-chat-message-card",
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: "./chat-message-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageCardComponent {
  readonly message = input.required<ChatMessage>();
  readonly highlighted = input(false);

  readonly presentation = inject(ChatMessagePresentationService);
  readonly interactions = inject(DashboardChatInteractionService);
}
