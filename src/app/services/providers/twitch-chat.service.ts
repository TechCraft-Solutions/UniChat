import { Injectable } from "@angular/core";
import { ChatMessage } from "@models/chat.model";
import { createMessageActionState } from "@helpers/chat.helper";
import {
  BaseChatProviderService,
  MockMessageTemplate,
} from "@services/providers/base-chat-provider.service";

@Injectable({
  providedIn: "root",
})
export class TwitchChatService extends BaseChatProviderService {
  readonly platform = "twitch" as const;

  protected getMockMessages(): MockMessageTemplate[] {
    return [
      {
        author: "TwitchViewer1",
        text: "Great stream! Love the content!",
        badges: ["subscriber"],
      },
      {
        author: "ModUser",
        text: "Remember to follow the chat rules everyone",
        badges: ["mod", "vip"],
      },
      {
        author: "NewChatter",
        text: "First time here, this is awesome!",
        badges: [],
      },
    ];
  }

  protected getActionStates() {
    return {
      reply: createMessageActionState("reply", "available"),
      delete: createMessageActionState("delete", "available"),
    };
  }
}
