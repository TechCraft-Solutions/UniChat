import { Injectable } from "@angular/core";
import { ChatMessage, PlatformType } from "@models/chat.model";
import { getPlatformBadgeClasses, getPlatformLabel } from "@helpers/chat.helper";

@Injectable({
  providedIn: "root",
})
export class ChatMessagePresentationService {
  readonly getPlatformBadgeClasses = getPlatformBadgeClasses;

  platformLabel(platform: PlatformType): string {
    return getPlatformLabel(platform);
  }

  messageTimeLabel(message: ChatMessage): string {
    return new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  messageFullTimeLabel(message: ChatMessage): string {
    return new Date(message.timestamp).toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  messageBadgeClasses(message: ChatMessage): string {
    return `${getPlatformBadgeClasses(message.platform)} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]`;
  }

  usernameColorClasses(author: string): string {
    const colors = [
      "text-red-500 dark:text-red-400",
      "text-orange-500 dark:text-orange-400",
      "text-amber-500 dark:text-amber-400",
      "text-yellow-500 dark:text-yellow-400",
      "text-lime-500 dark:text-lime-400",
      "text-green-500 dark:text-green-400",
      "text-emerald-500 dark:text-emerald-400",
      "text-teal-500 dark:text-teal-400",
      "text-cyan-500 dark:text-cyan-400",
      "text-sky-500 dark:text-sky-400",
      "text-blue-500 dark:text-blue-400",
      "text-indigo-500 dark:text-indigo-400",
      "text-violet-500 dark:text-violet-400",
      "text-purple-500 dark:text-purple-400",
      "text-fuchsia-500 dark:text-fuchsia-400",
      "text-pink-500 dark:text-pink-400",
      "text-rose-500 dark:text-rose-400",
    ];

    let hash = 0;
    for (let i = 0; i < author.length; i++) {
      hash = author.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
