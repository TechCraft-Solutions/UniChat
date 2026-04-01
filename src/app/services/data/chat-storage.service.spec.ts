import { TestBed } from "@angular/core/testing";
import { ChatStorageService } from "./chat-storage.service";
import { BlockedWordsService } from "../ui/blocked-words.service";
import { MessageTypeDetectorService } from "../ui/message-type-detector.service";
import { HighlightNotificationsService } from "../ui/highlight-notifications.service";
import { OverlayMessageBridgeService } from "../overlay/overlay-message-bridge.service";
import { ChatMessage } from "@models/chat.model";

describe("ChatStorageService", () => {
  let service: ChatStorageService;
  let blockedWordsService: jasmine.SpyObj<BlockedWordsService>;
  let messageTypeDetector: jasmine.SpyObj<MessageTypeDetectorService>;
  let highlightNotifications: jasmine.SpyObj<HighlightNotificationsService>;
  let overlayBridge: jasmine.SpyObj<OverlayMessageBridgeService>;

  beforeEach(() => {
    const blockedWordsSpy = jasmine.createSpyObj("BlockedWordsService", ["filterMessage"]);
    const messageTypeSpy = jasmine.createSpyObj("MessageTypeDetectorService", [
      "detectMessageType",
      "updateLastMessageTime",
    ]);
    const highlightSpy = jasmine.createSpyObj("HighlightNotificationsService", ["maybeNotify"]);
    const overlaySpy = jasmine.createSpyObj("OverlayMessageBridgeService", ["forwardMessage"]);

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        { provide: BlockedWordsService, useValue: blockedWordsSpy },
        { provide: MessageTypeDetectorService, useValue: messageTypeSpy },
        { provide: HighlightNotificationsService, useValue: highlightSpy },
        { provide: OverlayMessageBridgeService, useValue: overlaySpy },
      ],
    });

    service = TestBed.inject(ChatStorageService);
    blockedWordsService = TestBed.inject(
      BlockedWordsService
    ) as jasmine.SpyObj<BlockedWordsService>;
    messageTypeDetector = TestBed.inject(
      MessageTypeDetectorService
    ) as jasmine.SpyObj<MessageTypeDetectorService>;
    highlightNotifications = TestBed.inject(
      HighlightNotificationsService
    ) as jasmine.SpyObj<HighlightNotificationsService>;
    overlayBridge = TestBed.inject(
      OverlayMessageBridgeService
    ) as jasmine.SpyObj<OverlayMessageBridgeService>;

    // Setup default mock behaviors
    blockedWordsService.filterMessage.and.returnValue({ filtered: "", wasFiltered: false });
    messageTypeDetector.detectMessageType.and.returnValue({ type: "regular" });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("addMessage", () => {
    it("should add a message to the specified channel", () => {
      const channelId = "twitch:test-channel";
      const message: ChatMessage = createTestMessage("msg-1", "Hello, World!");

      service.addMessage(channelId, message);

      // Flush pending batches
      TestBed.flushEffects();

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe("msg-1");
    });

    it("should apply blocked words filtering", () => {
      const channelId = "twitch:test-channel";
      const message: ChatMessage = createTestMessage("msg-1", "Hello, World!");

      blockedWordsService.filterMessage.and.returnValue({
        filtered: "Hello, *****!",
        wasFiltered: true,
      });

      service.addMessage(channelId, message);

      expect(blockedWordsService.filterMessage).toHaveBeenCalledWith(
        "Hello, World!",
        jasmine.any(String)
      );
    });

    it("should detect message type", () => {
      const channelId = "twitch:test-channel";
      const message: ChatMessage = createTestMessage("msg-1", "Hello!");

      messageTypeDetector.detectMessageType.and.returnValue({
        type: "highlighted",
        reason: "Special badge",
      });

      service.addMessage(channelId, message);

      expect(messageTypeDetector.detectMessageType).toHaveBeenCalledWith(message);
    });

    it("should handle multiple messages in the same channel", () => {
      const channelId = "twitch:test-channel";
      const message1: ChatMessage = createTestMessage("msg-1", "First");
      const message2: ChatMessage = createTestMessage("msg-2", "Second");
      const message3: ChatMessage = createTestMessage("msg-3", "Third");

      service.addMessage(channelId, message1);
      service.addMessage(channelId, message2);
      service.addMessage(channelId, message3);

      TestBed.flushEffects();

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(3);
      expect(messages.map((m) => m.id)).toEqual(["msg-1", "msg-2", "msg-3"]);
    });

    it("should handle messages from different channels separately", () => {
      const channel1 = "twitch:channel1";
      const channel2 = "kick:channel2";
      const message1: ChatMessage = createTestMessage("msg-1", "Channel 1");
      const message2: ChatMessage = createTestMessage("msg-2", "Channel 2");

      service.addMessage(channel1, message1);
      service.addMessage(channel2, message2);

      TestBed.flushEffects();

      expect(service.getMessagesByChannel(channel1).length).toBe(1);
      expect(service.getMessagesByChannel(channel2).length).toBe(1);
    });
  });

  describe("prependMessages", () => {
    it("should prepend messages to existing channel messages", () => {
      const channelId = "twitch:test-channel";
      const existingMessage: ChatMessage = createTestMessage(
        "msg-2",
        "Existing",
        "2024-01-01T12:00:00Z"
      );
      const newMessage: ChatMessage = createTestMessage("msg-1", "New", "2024-01-01T11:00:00Z");

      // Add existing message first
      service.addMessage(channelId, existingMessage);
      TestBed.flushEffects();

      // Then prepend older message
      service.prependMessages(channelId, [newMessage]);

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(2);
      // Messages should be sorted chronologically (oldest first)
      expect(messages[0].id).toBe("msg-1");
      expect(messages[1].id).toBe("msg-2");
    });

    it("should handle empty message arrays", () => {
      const channelId = "twitch:test-channel";
      service.prependMessages(channelId, []);

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(0);
    });
  });

  describe("updateMessage", () => {
    it("should update an existing message", () => {
      const channelId = "twitch:test-channel";
      const message: ChatMessage = createTestMessage("msg-1", "Original");

      service.addMessage(channelId, message);
      TestBed.flushEffects();

      service.updateMessage(channelId, "msg-1", { text: "Updated" });

      const messages = service.getMessagesByChannel(channelId);
      expect(messages[0].text).toBe("Updated");
    });

    it("should not update non-existent message", () => {
      const channelId = "twitch:test-channel";
      const message: ChatMessage = createTestMessage("msg-1", "Original");

      service.addMessage(channelId, message);
      TestBed.flushEffects();

      // Try to update non-existent message
      service.updateMessage(channelId, "msg-999", { text: "Updated" });

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(1);
      expect(messages[0].text).toBe("Original");
    });
  });

  describe("deleteMessage", () => {
    it("should delete a message from the channel", () => {
      const channelId = "twitch:test-channel";
      const message1: ChatMessage = createTestMessage("msg-1", "First");
      const message2: ChatMessage = createTestMessage("msg-2", "Second");

      service.addMessage(channelId, message1);
      service.addMessage(channelId, message2);
      TestBed.flushEffects();

      service.deleteMessage(channelId, "msg-1");

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe("msg-2");
    });

    it("should handle deleting non-existent message", () => {
      const channelId = "twitch:test-channel";
      const message: ChatMessage = createTestMessage("msg-1", "Only");

      service.addMessage(channelId, message);
      TestBed.flushEffects();

      // Should not throw
      expect(() => service.deleteMessage(channelId, "msg-999")).not.toThrow();

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(1);
    });
  });

  describe("clearChannel", () => {
    it("should remove all messages from a channel", () => {
      const channelId = "twitch:test-channel";
      const message1: ChatMessage = createTestMessage("msg-1", "First");
      const message2: ChatMessage = createTestMessage("msg-2", "Second");

      service.addMessage(channelId, message1);
      service.addMessage(channelId, message2);
      TestBed.flushEffects();

      service.clearChannel(channelId);

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBe(0);
    });

    it("should not affect other channels", () => {
      const channel1 = "twitch:channel1";
      const channel2 = "kick:channel2";
      const message1: ChatMessage = createTestMessage("msg-1", "Channel 1");
      const message2: ChatMessage = createTestMessage("msg-2", "Channel 2");

      service.addMessage(channel1, message1);
      service.addMessage(channel2, message2);
      TestBed.flushEffects();

      service.clearChannel(channel1);

      expect(service.getMessagesByChannel(channel1).length).toBe(0);
      expect(service.getMessagesByChannel(channel2).length).toBe(1);
    });
  });

  describe("memory limits", () => {
    it("should prune messages when exceeding MAX_MESSAGES_PER_CHANNEL", () => {
      const channelId = "twitch:test-channel";
      const maxMessages = 2000; // APP_CONFIG.MAX_MESSAGES_PER_CHANNEL

      // Add more than max messages
      for (let i = 0; i < maxMessages + 100; i++) {
        const message: ChatMessage = createTestMessage(
          `msg-${i}`,
          `Message ${i}`,
          new Date(Date.now() + i * 1000).toISOString()
        );
        service.addMessage(channelId, message);
      }

      TestBed.flushEffects();

      const messages = service.getMessagesByChannel(channelId);
      expect(messages.length).toBeLessThanOrEqual(maxMessages);
    });
  });
});

/**
 * Helper function to create test messages
 */
function createTestMessage(id: string, text: string, timestamp?: string): ChatMessage {
  return {
    id,
    platform: "twitch",
    sourceMessageId: id,
    sourceChannelId: "test-channel",
    sourceUserId: "user-123",
    author: "Test User",
    text,
    timestamp: timestamp || new Date().toISOString(),
    badges: [],
    isSupporter: false,
    isOutgoing: false,
    isDeleted: false,
    canRenderInOverlay: true,
    messageType: "regular",
  } as ChatMessage;
}
