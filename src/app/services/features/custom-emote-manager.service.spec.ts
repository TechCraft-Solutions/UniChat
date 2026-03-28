import { TestBed } from "@angular/core/testing";
import { CustomEmoteManagerService } from "./custom-emote-manager.service";
import { LocalStorageService } from "./core/local-storage.service";

describe("CustomEmoteManagerService", () => {
  let service: CustomEmoteManagerService;
  let localStorageService: jasmine.SpyObj<LocalStorageService>;

  beforeEach(() => {
    const localStorageSpy = jasmine.createSpyObj("LocalStorageService", ["get", "set", "remove"]);

    TestBed.configureTestingModule({
      providers: [
        CustomEmoteManagerService,
        { provide: LocalStorageService, useValue: localStorageSpy },
      ],
    });

    service = TestBed.inject(CustomEmoteManagerService);
    localStorageService = TestBed.inject(
      LocalStorageService
    ) as jasmine.SpyObj<LocalStorageService>;
  });

  afterEach(() => {
    jasmine.clearAllMocks();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("loadEmotes", () => {
    it("should load emotes from localStorage", () => {
      const mockEmotes = [
        { id: "1", code: ":test:", url: "http://test.com/1.png", createdAt: 123456 },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      // Access private method through public API
      const emotes = service.emotes();
      expect(emotes).toEqual(mockEmotes);
      expect(localStorageService.get).toHaveBeenCalledWith("unichat-custom-emotes", []);
    });

    it("should return empty array if no emotes in storage", () => {
      localStorageService.get.and.returnValue([]);

      const emotes = service.emotes();
      expect(emotes).toEqual([]);
    });
  });

  describe("addEmote", () => {
    it("should add a new emote", () => {
      const initialEmotes: any[] = [];
      localStorageService.get.and.returnValue(initialEmotes);

      const newEmote = service.addEmote(":test:", "http://test.com/test.png", "twitch", "custom");

      expect(newEmote.code).toBe(":test:");
      expect(newEmote.url).toBe("http://test.com/test.png");
      expect(newEmote.platform).toBe("twitch");
      expect(newEmote.category).toBe("custom");
      expect(newEmote.id).toBeDefined();
      expect(newEmote.createdAt).toBeDefined();
    });

    it("should save emotes to localStorage after adding", () => {
      localStorageService.get.and.returnValue([]);

      service.addEmote(":test:", "http://test.com/test.png");

      expect(localStorageService.set).toHaveBeenCalledWith(
        "unichat-custom-emotes",
        jasmine.any(Array)
      );
    });
  });

  describe("removeEmote", () => {
    it("should remove an emote by id", () => {
      const mockEmotes = [
        {
          id: "1",
          code: ":test:",
          url: "http://test.com/1.png",
          createdAt: 123456,
          category: "custom",
        },
        {
          id: "2",
          code: ":test2:",
          url: "http://test.com/2.png",
          createdAt: 123457,
          category: "custom",
        },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      service.removeEmote("1");

      const remaining = service.emotes();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("2");
    });

    it("should not throw if emote not found", () => {
      localStorageService.get.and.returnValue([]);

      expect(() => service.removeEmote("nonexistent")).not.toThrow();
    });
  });

  describe("searchEmotes", () => {
    it("should search emotes by code", () => {
      const mockEmotes = [
        { id: "1", code: ":PogChamp:", url: "http://test.com/1.png", createdAt: 123456 },
        { id: "2", code: ":Kappa:", url: "http://test.com/2.png", createdAt: 123457 },
        { id: "3", code: ":pog:", url: "http://test.com/3.png", createdAt: 123458 },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      const results = service.searchEmotes("pog");

      expect(results.length).toBe(2);
      expect(results.map((r) => r.code)).toContain(":PogChamp:");
      expect(results.map((r) => r.code)).toContain(":pog:");
    });

    it("should be case insensitive", () => {
      const mockEmotes = [
        { id: "1", code: ":Kappa:", url: "http://test.com/1.png", createdAt: 123456 },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      const results = service.searchEmotes("KAPPA");

      expect(results.length).toBe(1);
    });

    it("should limit results to 50", () => {
      const mockEmotes = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        code: `:emote${i}:`,
        url: `http://test.com/${i}.png`,
        createdAt: Date.now() + i,
      }));
      localStorageService.get.and.returnValue(mockEmotes);

      const results = service.searchEmotes("emote");

      expect(results.length).toBe(50);
    });
  });

  describe("getRecentEmotes", () => {
    it("should return most recent emotes", () => {
      const mockEmotes = [
        { id: "1", code: ":old:", url: "http://test.com/1.png", createdAt: 1000 },
        { id: "2", code: ":new:", url: "http://test.com/2.png", createdAt: 3000 },
        { id: "3", code: ":mid:", url: "http://test.com/3.png", createdAt: 2000 },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      const recent = service.getRecentEmotes(2);

      expect(recent.length).toBe(2);
      expect(recent[0].code).toBe(":new:");
      expect(recent[1].code).toBe(":mid:");
    });

    it("should respect limit parameter", () => {
      const mockEmotes = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        code: `:emote${i}:`,
        url: `http://test.com/${i}.png`,
        createdAt: i * 1000,
      }));
      localStorageService.get.and.returnValue(mockEmotes);

      const recent = service.getRecentEmotes(5);

      expect(recent.length).toBe(5);
    });
  });

  describe("toggleFavorite", () => {
    it("should add emote to favorites if not favorite", () => {
      const mockEmotes = [
        { id: "1", code: ":test:", url: "http://test.com/1.png", createdAt: 123456 },
      ];
      const mockCategories = [
        { id: "favorites", name: "Favorites", emotes: [] },
        { id: "custom", name: "Custom", emotes: [] },
      ];
      localStorageService.get.and.callFake((key: string) => {
        if (key === "unichat-custom-emotes") return mockEmotes;
        if (key === "unichat-emote-categories") return mockCategories;
        return [];
      });

      service.toggleFavorite("1");

      const categories = service.categories();
      const favorites = categories.find((c) => c.id === "favorites");
      expect(favorites?.emotes.length).toBe(1);
    });

    it("should remove emote from favorites if already favorite", () => {
      const mockEmotes = [
        { id: "1", code: ":test:", url: "http://test.com/1.png", createdAt: 123456 },
      ];
      const mockCategories = [
        {
          id: "favorites",
          name: "Favorites",
          emotes: [{ id: "1", code: ":test:", url: "http://test.com/1.png", createdAt: 123456 }],
        },
        { id: "custom", name: "Custom", emotes: [] },
      ];
      localStorageService.get.and.callFake((key: string) => {
        if (key === "unichat-custom-emotes") return mockEmotes;
        if (key === "unichat-emote-categories") return mockCategories;
        return [];
      });

      service.toggleFavorite("1");

      const categories = service.categories();
      const favorites = categories.find((c) => c.id === "favorites");
      expect(favorites?.emotes.length).toBe(0);
    });
  });

  describe("exportEmotes", () => {
    it("should export all emotes", () => {
      const mockEmotes = [
        { id: "1", code: ":test:", url: "http://test.com/1.png", createdAt: 123456 },
        { id: "2", code: ":test2:", url: "http://test.com/2.png", createdAt: 123457 },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      const exported = service.exportEmotes();

      expect(exported).toEqual(mockEmotes);
    });
  });

  describe("importEmotes", () => {
    it("should import new emotes", () => {
      const existingEmotes = [
        { id: "1", code: ":existing:", url: "http://test.com/1.png", createdAt: 123456 },
      ];
      const newEmotes = [
        { id: "2", code: ":new:", url: "http://test.com/2.png", createdAt: 123457 },
      ];
      localStorageService.get.and.returnValue(existingEmotes);

      service.importEmotes(newEmotes);

      const allEmotes = service.emotes();
      expect(allEmotes.length).toBe(2);
    });

    it("should not import duplicate emotes by code", () => {
      const existingEmotes = [
        { id: "1", code: ":test:", url: "http://test.com/1.png", createdAt: 123456 },
      ];
      const duplicateEmotes = [
        { id: "2", code: ":test:", url: "http://test.com/2.png", createdAt: 123457 },
      ];
      localStorageService.get.and.returnValue(existingEmotes);

      service.importEmotes(duplicateEmotes);

      const allEmotes = service.emotes();
      expect(allEmotes.length).toBe(1);
    });
  });

  describe("clearAllEmotes", () => {
    it("should clear all custom emotes", () => {
      const mockEmotes = [
        {
          id: "1",
          code: ":test:",
          url: "http://test.com/1.png",
          createdAt: 123456,
          category: "custom",
        },
      ];
      localStorageService.get.and.returnValue(mockEmotes);

      service.clearAllEmotes();

      const emotes = service.emotes();
      expect(emotes.length).toBe(0);
    });
  });
});
