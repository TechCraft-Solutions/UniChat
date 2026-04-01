import { TestBed } from "@angular/core/testing";
import { BlockedWordsService } from "./blocked-words.service";
import { ChatListService } from "../data/chat-list.service";

describe("BlockedWordsService", () => {
  let service: BlockedWordsService;
  let chatListService: jasmine.SpyObj<ChatListService>;

  beforeEach(() => {
    const chatListSpy = jasmine.createSpyObj("ChatListService", ["getChannels"]);

    TestBed.configureTestingModule({
      providers: [BlockedWordsService, { provide: ChatListService, useValue: chatListSpy }],
    });

    service = TestBed.inject(BlockedWordsService);
    chatListService = TestBed.inject(ChatListService) as jasmine.SpyObj<ChatListService>;

    chatListService.getChannels.and.returnValue([]);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("filterMessage", () => {
    it("should return original text when no rules match", () => {
      const text = "Hello, World!";
      const result = service.filterMessage(text, "twitch:test-channel");

      expect(result.wasFiltered).toBe(false);
      expect(result.filtered).toBe(text);
    });

    it("should filter exact word matches", () => {
      // Add a blocked word rule
      service.addRule("spam", false, false);
      TestBed.flushEffects();

      const text = "This is spam content";
      const result = service.filterMessage(text, "twitch:test-channel");

      expect(result.wasFiltered).toBe(true);
      expect(result.filtered).toContain("****");
    });

    it("should filter regex patterns", () => {
      // Add a regex rule for URLs
      service.addRule("https?://\\S+", true, false);
      TestBed.flushEffects();

      const text = "Check out https://example.com";
      const result = service.filterMessage(text, "twitch:test-channel");

      expect(result.wasFiltered).toBe(true);
      expect(result.filtered).not.toContain("https://");
    });

    it("should handle multiple rules", () => {
      service.addRule("bad", false, false);
      service.addRule("worst", false, false);
      TestBed.flushEffects();

      const text = "This is bad and worst";
      const result = service.filterMessage(text, "twitch:test-channel");

      expect(result.wasFiltered).toBe(true);
    });

    it("should be case-insensitive", () => {
      service.addRule("SPAM", false, false);
      TestBed.flushEffects();

      const text = "This is Spam content";
      const result = service.filterMessage(text, "twitch:test-channel");

      expect(result.wasFiltered).toBe(true);
    });

    it("should handle empty text", () => {
      service.addRule("test", false, false);
      TestBed.flushEffects();

      const result = service.filterMessage("", "twitch:test-channel");

      expect(result.wasFiltered).toBe(false);
      expect(result.filtered).toBe("");
    });

    it("should handle channel-specific rules", () => {
      const globalRuleId = service.addRule("global", false, true);
      const channelRuleId = service.addRule("specific", false, false, ["twitch:specific-channel"]);
      TestBed.flushEffects();

      // Test global rule on any channel
      const globalResult = service.filterMessage("global test", "twitch:any-channel");
      expect(globalResult.wasFiltered).toBe(true);

      // Test channel-specific rule only on specified channel
      const specificResult = service.filterMessage("specific test", "twitch:specific-channel");
      expect(specificResult.wasFiltered).toBe(true);

      const otherChannelResult = service.filterMessage("specific test", "twitch:other-channel");
      expect(otherChannelResult.wasFiltered).toBe(false);
    });
  });

  describe("addRule", () => {
    it("should add a new blocked word rule", () => {
      const ruleId = service.addRule("test", false, false);

      expect(ruleId).toBeTruthy();
      const rules = service.getRules();
      expect(rules.length).toBe(1);
      expect(rules[0].pattern).toBe("test");
      expect(rules[0].isRegex).toBe(false);
      expect(rules[0].isGlobal).toBe(false);
    });

    it("should add a regex rule", () => {
      const ruleId = service.addRule("\\d+", true, false);

      expect(ruleId).toBeTruthy();
      const rules = service.getRules();
      expect(rules[0].isRegex).toBe(true);
      expect(rules[0].pattern).toBe("\\d+");
    });

    it("should add a global rule", () => {
      const ruleId = service.addRule("global", false, true);

      const rules = service.getRules();
      expect(rules[0].isGlobal).toBe(true);
      expect(rules[0].channelIds).toBeUndefined();
    });

    it("should add a channel-specific rule", () => {
      const channelIds = ["twitch:channel1", "kick:channel2"];
      const ruleId = service.addRule("specific", false, false, channelIds);

      const rules = service.getRules();
      expect(rules[0].isGlobal).toBe(false);
      expect(rules[0].channelIds).toEqual(channelIds);
    });
  });

  describe("updateRule", () => {
    it("should update an existing rule", () => {
      const ruleId = service.addRule("old", false, false);

      service.updateRule(ruleId, { pattern: "new", isRegex: true });

      const rules = service.getRules();
      expect(rules[0].pattern).toBe("new");
      expect(rules[0].isRegex).toBe(true);
    });

    it("should not update non-existent rule", () => {
      expect(() => service.updateRule("non-existent", { pattern: "new" })).not.toThrow();
    });
  });

  describe("deleteRule", () => {
    it("should delete an existing rule", () => {
      const ruleId = service.addRule("test", false, false);

      service.deleteRule(ruleId);

      const rules = service.getRules();
      expect(rules.length).toBe(0);
    });

    it("should handle deleting non-existent rule", () => {
      expect(() => service.deleteRule("non-existent")).not.toThrow();
    });
  });

  describe("getRules", () => {
    it("should return all rules", () => {
      service.addRule("rule1", false, false);
      service.addRule("rule2", true, false);
      service.addRule("rule3", false, true);

      const rules = service.getRules();
      expect(rules.length).toBe(3);
    });

    it("should return empty array when no rules", () => {
      const rules = service.getRules();
      expect(rules.length).toBe(0);
    });
  });

  describe("getActiveRules", () => {
    it("should return rules active for a channel", () => {
      const globalRuleId = service.addRule("global", false, true);
      const channelRuleId = service.addRule("specific", false, false, ["twitch:test-channel"]);
      const otherChannelRuleId = service.addRule("other", false, false, ["twitch:other-channel"]);
      TestBed.flushEffects();

      const activeRules = service.getActiveRules("twitch:test-channel");

      expect(activeRules.length).toBe(2);
      expect(activeRules.map((r) => r.id)).toContain(globalRuleId);
      expect(activeRules.map((r) => r.id)).toContain(channelRuleId);
      expect(activeRules.map((r) => r.id)).not.toContain(otherChannelRuleId);
    });
  });

  describe("clearAllRules", () => {
    it("should remove all rules", () => {
      service.addRule("rule1", false, false);
      service.addRule("rule2", false, false);

      service.clearAllRules();

      const rules = service.getRules();
      expect(rules.length).toBe(0);
    });
  });

  describe("regex compilation", () => {
    it("should handle invalid regex gracefully", () => {
      // Invalid regex pattern
      service.addRule("[invalid", true, false);
      TestBed.flushEffects();

      // Should not throw, just not filter
      const result = service.filterMessage("test [invalid test", "twitch:test-channel");
      expect(result.wasFiltered).toBe(false);
    });

    it("should escape non-regex patterns", () => {
      service.addRule("test.*pattern", false, false);
      TestBed.flushEffects();

      // The .* should be treated as literal characters, not regex
      const result = service.filterMessage("test.*pattern", "twitch:test-channel");
      expect(result.wasFiltered).toBe(true);
    });
  });

  describe("performance", () => {
    it("should handle many rules efficiently", () => {
      // Add 100 rules
      for (let i = 0; i < 100; i++) {
        service.addRule(`word${i}`, false, false);
      }
      TestBed.flushEffects();

      const startTime = performance.now();
      service.filterMessage("This contains word50 and word99", "twitch:test-channel");
      const endTime = performance.now();

      // Should complete in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
