/* sys lib */
import { Injectable, inject } from "@angular/core";
import tmi from "tmi.js";

/* services */
import { ConnectionStateService } from "@services/data/connection-state.service";

export type RoomStateUpdate = {
  isSlowMode: boolean;
  slowModeWaitTime: number | undefined;
  isFollowersOnly: boolean;
  followersOnlyMinutes: number | undefined;
  isSubscribersOnly: boolean;
  isEmotesOnly: boolean;
  isR9k: boolean;
};

@Injectable({
  providedIn: "root",
})
export class TwitchRoomStateService {
  private readonly roomstateListeners = new Map<
    string,
    (channel: string, state: tmi.RoomState) => void
  >();
  private readonly connectionStateService = inject(ConnectionStateService);

  createRoomStateListener(channelId: string): (channel: string, state: tmi.RoomState) => void {
    const listener = (channel: string, state: tmi.RoomState) => {
      this.roomStateHandler(channelId, state);
    };
    this.roomstateListeners.set(channelId, listener);
    return listener;
  }

  removeRoomStateListener(channelId: string, client: tmi.Client): void {
    const listener = this.roomstateListeners.get(channelId);
    if (listener) {
      client.removeListener("roomstate", listener);
      this.roomstateListeners.delete(channelId);
    }
  }

  roomStateHandler(channelId: string, state: tmi.RoomState): void {
    const slowValue = state.slow;
    const slowModeWaitTime =
      typeof slowValue === "string" ? parseInt(slowValue, 10) : slowValue ? 0 : undefined;

    const followersValue = state["followers-only"];
    const isFollowersOnly = followersValue === true || followersValue === "0";
    const followersOnlyMinutes =
      isFollowersOnly && typeof followersValue === "string" && followersValue !== "0"
        ? parseInt(followersValue, 10)
        : undefined;

    this.connectionStateService.updateRoomState(channelId, {
      isSlowMode: slowValue === true || (typeof slowValue === "string" && slowValue !== "0"),
      slowModeWaitTime: slowModeWaitTime,
      isFollowersOnly,
      followersOnlyMinutes,
      isSubscribersOnly: state["subs-only"] ?? false,
      isEmotesOnly: state["emote-only"] ?? false,
      isR9k: state.r9k ?? false,
    });
  }

  clearRoomState(channelId: string): void {
    this.connectionStateService.clearRoomState(channelId);
  }
}
