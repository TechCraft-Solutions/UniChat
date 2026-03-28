/* sys lib */
import { Injectable, inject, signal } from "@angular/core";

/* models */
import { PlatformType } from "@models/chat.model";

/* services */
import { LocalStorageService } from "@services/core/local-storage.service";

/**
 * Custom emote definition
 */
export interface CustomEmote {
  id: string;
  code: string;
  url: string;
  platform?: PlatformType;
  category?: string;
  createdAt: number;
}

/**
 * Emote category
 */
export interface EmoteCategory {
  id: string;
  name: string;
  emotes: CustomEmote[];
}

/**
 * Custom Emote Manager Service
 *
 * Manages user's custom emotes across all platforms
 * - Add/remove custom emotes
 * - Organize emotes by category
 * - Quick emote picker integration
 */
@Injectable({
  providedIn: "root",
})
export class CustomEmoteManagerService {
  private readonly localStorage = inject(LocalStorageService);

  private readonly STORAGE_KEY = "unichat-custom-emotes";

  // Signal-based state management
  private readonly emotesSignal = signal<CustomEmote[]>(this.loadEmotes());
  private readonly categoriesSignal = signal<EmoteCategory[]>(this.loadCategories());

  readonly emotes = this.emotesSignal.asReadonly();
  readonly categories = this.categoriesSignal.asReadonly();

  /**
   * Load emotes from localStorage
   */
  private loadEmotes(): CustomEmote[] {
    return this.localStorage.get<CustomEmote[]>(this.STORAGE_KEY, []);
  }

  /**
   * Load categories from localStorage
   */
  private loadCategories(): EmoteCategory[] {
    const defaultCategories: EmoteCategory[] = [
      { id: "favorites", name: "Favorites", emotes: [] },
      { id: "recent", name: "Recent", emotes: [] },
      { id: "custom", name: "Custom", emotes: [] },
    ];
    return this.localStorage.get<EmoteCategory[]>("unichat-emote-categories", defaultCategories);
  }

  /**
   * Save emotes to localStorage
   */
  private saveEmotes(): void {
    this.localStorage.set(this.STORAGE_KEY, this.emotesSignal());
  }

  /**
   * Add a new custom emote
   */
  addEmote(code: string, url: string, platform?: PlatformType, category?: string): CustomEmote {
    const emote: CustomEmote = {
      id: `emote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code,
      url,
      platform,
      category: category || "custom",
      createdAt: Date.now(),
    };

    this.emotesSignal.update((emotes) => [...emotes, emote]);
    this.saveEmotes();

    // Add to category
    this.addEmoteToCategory(emote.id, emote.category || "custom");

    return emote;
  }

  /**
   * Remove an emote
   */
  removeEmote(emoteId: string): void {
    const emote = this.emotesSignal().find((e) => e.id === emoteId);
    if (emote) {
      this.emotesSignal.update((emotes) => emotes.filter((e) => e.id !== emoteId));
      this.saveEmotes();

      // Remove from category
      this.removeEmoteFromCategory(emoteId, emote.category || "custom");
    }
  }

  /**
   * Get emote by code
   */
  getEmoteByCode(code: string): CustomEmote | undefined {
    return this.emotesSignal().find((e) => e.code.toLowerCase() === code.toLowerCase());
  }

  /**
   * Search emotes by code
   */
  searchEmotes(query: string): CustomEmote[] {
    const lowerQuery = query.toLowerCase();
    return this.emotesSignal()
      .filter((e) => e.code.toLowerCase().includes(lowerQuery))
      .slice(0, 50); // Limit results
  }

  /**
   * Get recent emotes
   */
  getRecentEmotes(limit: number = 20): CustomEmote[] {
    return [...this.emotesSignal()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  /**
   * Add emote to category
   */
  addEmoteToCategory(emoteId: string, categoryId: string): void {
    this.categoriesSignal.update((categories) =>
      categories.map((cat) => {
        if (cat.id === categoryId) {
          const emote = this.emotesSignal().find((e) => e.id === emoteId);
          if (emote && !cat.emotes.find((e) => e.id === emoteId)) {
            return { ...cat, emotes: [...cat.emotes, emote] };
          }
        }
        return cat;
      })
    );
    this.saveCategories();
  }

  /**
   * Remove emote from category
   */
  removeEmoteFromCategory(emoteId: string, categoryId: string): void {
    this.categoriesSignal.update((categories) =>
      categories.map((cat) =>
        cat.id === categoryId ? { ...cat, emotes: cat.emotes.filter((e) => e.id !== emoteId) } : cat
      )
    );
    this.saveCategories();
  }

  /**
   * Save categories to localStorage
   */
  private saveCategories(): void {
    this.localStorage.set("unichat-emote-categories", this.categoriesSignal());
  }

  /**
   * Create new category
   */
  createCategory(name: string): EmoteCategory {
    const category: EmoteCategory = {
      id: `cat-${Date.now()}`,
      name,
      emotes: [],
    };
    this.categoriesSignal.update((cats) => [...cats, category]);
    this.saveCategories();
    return category;
  }

  /**
   * Delete category
   */
  deleteCategory(categoryId: string): void {
    // Don't allow deleting default categories
    if (["favorites", "recent", "custom"].includes(categoryId)) {
      return;
    }
    this.categoriesSignal.update((cats) => cats.filter((c) => c.id !== categoryId));
    this.saveCategories();
  }

  /**
   * Toggle emote as favorite
   */
  toggleFavorite(emoteId: string): void {
    const favoritesCategory = this.categoriesSignal().find((c) => c.id === "favorites");
    const emote = this.emotesSignal().find((e) => e.id === emoteId);

    if (!emote || !favoritesCategory) return;

    const isFavorite = favoritesCategory.emotes.some((e) => e.id === emoteId);

    if (isFavorite) {
      this.removeEmoteFromCategory(emoteId, "favorites");
    } else {
      this.addEmoteToCategory(emoteId, "favorites");
    }
  }

  /**
   * Get emotes by platform
   */
  getEmotesByPlatform(platform: PlatformType): CustomEmote[] {
    return this.emotesSignal().filter((e) => e.platform === platform);
  }

  /**
   * Import emotes from JSON
   */
  importEmotes(emotesData: CustomEmote[]): void {
    const existingEmotes = this.emotesSignal();
    const newEmotes = emotesData.filter(
      (e) => !existingEmotes.some((existing) => existing.code === e.code)
    );

    this.emotesSignal.update((emotes) => [...emotes, ...newEmotes]);
    this.saveEmotes();
  }

  /**
   * Export emotes to JSON
   */
  exportEmotes(): CustomEmote[] {
    return this.emotesSignal();
  }

  /**
   * Clear all custom emotes
   */
  clearAllEmotes(): void {
    this.emotesSignal.set([]);
    this.saveEmotes();

    // Clear custom category but keep default categories
    this.categoriesSignal.update((cats) =>
      cats.map((cat) => (cat.id === "custom" ? { ...cat, emotes: [] } : cat))
    );
    this.saveCategories();
  }
}
