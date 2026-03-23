import { Injectable } from "@angular/core";
import { createMessageActionState } from "@helpers/chat.helper";
import {
  BaseChatProviderService,
  MockMessageTemplate,
} from "@services/providers/base-chat-provider.service";

@Injectable({
  providedIn: "root",
})
export class YouTubeChatService extends BaseChatProviderService {
  readonly platform = "youtube" as const;

  protected getMockMessages(): MockMessageTemplate[] {
    return [
      {
        author: "YTMember123",
        text: "Been watching since the beginning!",
        badges: ["member"],
      },
      {
        author: "SuperChat_Fan",
        text: "Great video as always!",
        badges: ["member", "supporter"],
      },
      {
        author: "NewSubscriber",
        text: "Just subscribed, love this content",
        badges: ["subscriber"],
      },
    ];
  }

  protected getActionStates() {
    return {
      reply: createMessageActionState("reply", "available"),
      delete: createMessageActionState(
        "delete",
        "disabled",
        "This channel cannot delete messages."
      ),
    };
  }
}
