import { Injectable } from "@angular/core";
import { createMessageActionState } from "@helpers/chat.helper";
import {
  BaseChatProviderService,
  MockMessageTemplate,
} from "@services/providers/base-chat-provider.service";

@Injectable({
  providedIn: "root",
})
export class KickChatService extends BaseChatProviderService {
  readonly platform = "kick" as const;

  protected getMockMessages(): MockMessageTemplate[] {
    return [
      {
        author: "KickFan123",
        text: "xQc is so funny LMAO",
        badges: ["subscriber"],
      },
      {
        author: "ChatMod",
        text: "Keep it civil in chat please",
        badges: ["mod"],
      },
      {
        author: "Viewer420",
        text: "OMEGALUL",
        badges: [],
      },
    ];
  }

  protected getActionStates() {
    return {
      reply: createMessageActionState(
        "reply",
        "disabled",
        "This channel is watch-only for replies."
      ),
      delete: createMessageActionState(
        "delete",
        "disabled",
        "This channel cannot delete messages."
      ),
    };
  }
}
