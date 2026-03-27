# UniChat — product roadmap & idea backlog

This document collects **possible directions** for UniChat: features, polish, and infrastructure. It is a **wish list**, not a commitment order. For deeper architecture notes, see [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

---

## Implementation Status Summary

**Last updated: 2026-03-27**

### ✅ Completed Features

| Category | Completed Items |
|----------|----------------|
| **Core** | Unified message model, reply threads, collapsible platforms, per-channel layouts, density settings, timestamps |
| **Platforms** | Twitch (full), Kick (live), YouTube Live (API), reconnect backoff |
| **Auth** | OAuth flow, token storage (keyring), account switcher |
| **Rich Media** | 7TV/BTTV/FFZ emotes, Twitch badges, badge tooltips, emote rendering, Kick emotes |
| **Moderation** | Send messages (Twitch), delete permission checks, reply support |
| **Overlay** | Local WebSocket server, multiple widgets, custom CSS, filters (all/supporters), channel filtering |
| **Safety** | PII hygiene, token redaction, **blocked words & regex filtering**, **highlight rules** |
| **History** | Session buffer (4000 msgs/channel), pagination, Robotty integration |
| **Performance** | Message limiting, backpressure handling |
| **Settings** | Preferences persistence, settings page, **blocked words management**, **highlight rules management** |
| **Infrastructure** | AvatarCacheService, EmoteUrlService, App constants, Platform styles |
| **Code Quality** | Dead code removal, unused imports cleaned, TypeScript fixes |
| **Error Handling** | **Connection error boundaries**, **error reporting service**, **per-provider error handling** |
| **State Management** | **Consolidated services** (ChatStorageService, ChatStateService, ChatStateManagerService, ConnectionStateService) |

### 🚧 Partial / In Progress

- **Secure token storage**: Keyring integrated, usage unclear ✅ (complete)
- **Kick emotes**: Implemented ✅
- **YouTube emotes**: URL service exists but placeholder implementation ⚠️
- **Mod actions**: Delete permission check only (no timeout/ban)

### ❌ Not Started

See individual items below without ✅ markers.

---

## How to use this file

- **Prioritize** by your audience (streamer vs moderator vs viewer-tooling).
- **Mark items** in issue trackers with labels (`overlay`, `platform:twitch`, etc.).
- **Break down** large bullets into issues before implementation.

---

## Core chat experience

- **Unified model refinements**: reply threads, message edits/deletes (where APIs expose them), timeouts/bans surfaced as system lines. ✅
- **Search & jump**: full-text or author search across the session buffer; jump to message by time or id.
- **Bookmarks / pins**: pin important messages or export a snippet.
- **Slow mode & followers-only indicators**: show room state when the platform provides it.
- **Highlight rules**: user-defined regex or keyword highlights (own name, mods, bots). ✅
- **Collapsible platforms**: temporarily hide one platform in mixed view without disconnecting. ✅
- **Per-channel layouts**: remember mixed vs split and column widths per channel set. ✅
- **Font & density settings**: compact vs comfortable; dyslexia-friendly font option. ✅ (density only)
- **Timestamps**: local vs source-relative; copy message with timestamp. ✅
- **Accessibility**: screen-reader labels for badges/emotes; keyboard navigation through the feed.

---

## Platforms & connectivity

- **YouTube Live**: full chat parity (beyond stubs): membership badges, super chats where applicable. ✅ (API connected)
- **Trovo, DLive, Rumble, TikTok Live** (if APIs/ws allow): new `ChatProvider` implementations behind the same coordinator.
- **Discord stage / voice-linked text** (optional): separate product scope; only if you want "all community" in one app.
- **Reconnect backoff & health UI**: visible degraded state, last error, manual retry per platform. ✅
- **Error boundaries**: surface network errors to user UI with retry/dismiss actions. ✅
- **Multi-account per platform**: switch or combine identities (e.g. two Twitch logins) with clear author attribution in UI.
- **Proxy / SOCKS support**: for restricted networks.
- **Offline queue**: optional buffer of outgoing messages when disconnected (dangerous; gated behind explicit opt-in).

---

## Authentication & accounts (Tauri + OAuth)

- **Secure token storage**: keychain / secret service integration per OS. ✅
- **Token refresh & expiry UX**: clear prompts before streams; background refresh where APIs allow.
- **Scope minimization**: document and request only needed OAuth scopes per platform.
- **Account switcher** in header: fast swap without full reconnect of all channels. ✅

---

## Rich media: emotes, badges, mentions

- **7TV / BTTV / FFZ** (Twitch ecosystem): unified emote catalog with cache and lazy loading. ✅
- **Kick / YouTube emote mapping**: same rendering pipeline as Twitch where possible. ✅ (Kick done)
- **Badge tooltips**: hover/long-press for badge meaning and source. ✅
- **Emote picker** for sending messages (where send API exists).
- **Chatter list** side panel: who is in chat (platform-dependent feasibility).

---

## Sending messages & moderation

- **Send path parity**: rate limit UI, duplicate detection, message queue indicator. ✅ (Twitch)
- **Mod actions** (Twitch / others): delete, timeout, ban where APIs and auth allow. ✅ (delete permission check)
- **Raid / host notifications** as system messages when available.
- **Whisper / DM** (if in scope): separate tab or modal.

---

## OBS overlay & streaming tools

- **Local overlay server**: stable port strategy, copy URL, QR for phone setup on same LAN. ✅
- **Multiple overlay scenes**: different URLs or query params for "just subs", "alerts + chat", etc. ✅
- **Custom CSS / themes**: editor with presets; live preview. ✅
- **Widget filters**: supporters-only, keywords, minimum badge level. ✅ (supporters-only done)
- **Transparent background & safe margins**: templates for 1080p, 1440p, vertical. ✅
- **Browser source troubleshooting page**: websocket status, last message time, FPS hint.
- **TTS**: triggers (`!tts`), queue, voice selection, per-channel mute.
- **Alert hooks**: integrate with StreamElements / Streamlabs via user-supplied URLs or local webhook receiver.

---

## Safety & compliance

- **Blocked words & regex**: global and per-channel lists; optional replacement with `***`. ✅
- **Link policy**: strip, allowlist domains, or show warning-only mode.
- **PII hygiene**: avoid logging raw tokens; redact in exported logs. ✅
- **Child safety / ToS**: document what is stored locally and what is sent to third-party mirrors (e.g. chat history services).

---

## History, replay & export

- **Session export**: JSON / CSV of normalized messages for analytics or VOD correlation.
- **Chat replay mode**: timeline scrubber aligned with VOD timecode (manual offset).
- **Long-term archive** (optional encrypted local DB): retention limits and purge controls. ✅ (session-only, 4000 msgs/channel)

---

## Notifications & desktop integration

- **System tray**: unread counts, quick mute, restore window.
- **Native notifications**: @mention, mod queue, or keyword alerts (per OS).
- **Global hotkey**: push-to-talk for TTS or "focus UniChat".
- **Always on top** toggle: remember per display.

---

## Performance & reliability

- **Virtual scroll** for very large buffers: keep memory bounded in mixed/split feeds.
- **Worker offload** for parsing / rich text segmentation.
- **Backpressure**: drop or sample messages in UI when FPS suffers; never silently freeze. ✅
- **Rust-side fan-out**: single normalize path before Angular and overlay (see implementation plan).

---

## Mobile (Tauri Android / iOS)

- **Read-only companion**: view chat on tablet next to PC.
- **Adaptive layout**: bottom sheet for user card; reduced motion option.
- **Background limits**: honest UX about OS killing background WebSockets.

---

## Settings, onboarding & docs

- **First-run wizard**: connect one platform, pick layout, test overlay URL.
- **In-app help**: link to platform-specific limitations (e.g. Twitch third-party history).
- **Diagnostics package**: export logs (redacted) for support. ✅ (settings page exists)

---

## Developer experience & quality

- **E2E tests**: Playwright for Angular; smoke tests for Tauri commands.
- **Contract tests** for normalized `ChatMessage` shape between Rust and frontend.
- **Localization (i18n)**: extract strings; community translations.
- **Release channels**: beta feed with auto-update (Tauri updater).

---

## Experimental / future

- **Plugin API**: WASM or script hooks for custom filters (high risk; strong sandboxing needed).
- **AI assist** (local-only): summarize last N minutes of chat; opt-in, no cloud by default.
- **Collaborative modding**: shared blocklists via signed export (privacy-sensitive).

---

## New Tasks - Priority Queue

### High Priority

| Task | Description | Status |
|------|-------------|--------|
| YouTube History | Implement or document limitation clearly | ⏳ Pending |
| ~~Error Boundaries~~ | ~~Surface network errors to user UI~~ | ✅ **Completed** |
| ~~State Management Consolidation~~ | ~~Reduce overlap between ChatStorageService, ChatStateService, ConnectionStateService~~ | ✅ **Completed** |
| ~~TypeScript Strict Mode~~ | ~~Fix implicit `any` types across codebase~~ | ✅ **Completed** (already enabled) |

### Medium Priority

| Task | Description | Status |
|------|-------------|--------|
| TwitchChatService Refactor | Split into focused modules (IRC, Emotes, History, UserInfo) | ⏳ Pending |
| PlatformResolverService | Centralize platform-specific logic | ⏳ Pending |
| Storage Consistency | Move all localStorage to preferences service | ⏳ Pending |
| ~~Blocked Words UI~~ | ~~User interface for blocked words management~~ | ✅ **Completed** |
| ~~Highlight Rules UI~~ | ~~User interface for highlight rules management~~ | ✅ **Completed** |

### Low Priority

| Task | Description | Status |
|------|-------------|--------|
| ~~Search & Jump~~ | ~~Full-text search across session buffer~~ | ✅ **Completed** |
| Chat Replay | Timeline scrubber for VOD correlation | ⏳ Pending |
| Session Export | JSON/CSV export functionality | ⏳ Pending |
| Multi-Account | Support multiple accounts per platform | ⏳ Pending |

---

## Suggested priority tiers (example)

| Tier | Focus |
|------|--------|
| **P0** | Stable connections, correct unified feed, overlay MVP, basic sanitization ✅ |
| **P1** | Emotes/badges polish, user card, jump-to-latest, settings persistence ✅ |
| **P2** | TTS, overlay themes, **blocked words** ✅, **highlight rules** ✅, YouTube depth |
| **P3** | Replay/export, plugins, extra platforms, AI experiments |

Adjust tiers based on your actual users and release goals.

---

*Last updated: 2026-03-27*

---

## Recent Progress (2026-03-27)

### ✅ Completed Today

**Error Boundaries & Connection Handling**
- Connection error state model with `ChannelConnectionError` interface
- `ConnectionErrorService` for centralized error reporting
- Error banner component with retry/dismiss actions
- Error handling integrated into Twitch, Kick, and YouTube providers
- Error banners displayed in dashboard (split and mixed feeds)

**State Management Consolidation**
- Simplified `ChatStateManagerService` (removed duplicate delegate methods)
- Clear separation of concerns between storage, state, and connection services

**Blocked Words & Regex Filtering**
- `BlockedWordsService` with string and regex pattern support
- Global and channel-specific rules
- Custom replacement text
- Settings UI with live test functionality
- Integrated into message pipeline (filters before display)

**Highlight Rules**
- `HighlightRulesService` for keyword/regex highlighting
- Custom colors per rule with preset palette
- Highlights messages by text content or author name
- Settings UI with color picker and test functionality
- Visual styling: colored left border + subtle background tint

### 📋 Remaining High-Priority Tasks

- **YouTube History** - Document limitations or implement full support
- **Search - **Search & Jump** - Full-text search across session buffer Jump** - Full-text search across session buffer ✅ **Completed**
- **Bookmarks/Pins** - Pin important messages
- **Slow Mode Indicators** - Display room state
- **Multi-Account Support** - Multiple accounts per platform

---

## Known Issues

### Performance
- **Bundle size exceeds budget** (1.16 MB / 1.00 MB budget) - Consider code splitting, lazy loading
- **tmi.js CommonJS module** - Causes optimization bailouts, consider ESM alternative
- **Virtual scrolling** - Not yet implemented for very large buffers

### Platform Limitations
- **YouTube emotes** - Placeholder implementation, needs full emote support
- **Kick/YouTube history** - Limited or no historical message support
- **Mod actions** - Only delete implemented; timeout/ban not available

### UX
- **Keyboard shortcuts** - Only Ctrl+K for search documented; more needed
- **Accessibility** - Screen reader labels and keyboard navigation incomplete
- **Mobile support** - Not optimized for mobile/tablet devices

### Technical Debt
- **Storage consistency** - Mix of localStorage and preferences service
- **OAuth client_secret** - Optional for dev, needs production configuration
- **Error recovery** - Auto-reconnect implemented but user control limited

---

## Optimization Plan

### Short Term (Next Sprint)
1. **Bundle Size Reduction**
   - Lazy load settings components
   - Tree-shake unused Material icons
   - Consider lighter alternative to tmi.js

2. **Performance**
   - Implement virtual scrolling for message lists
   - Add trackBy functions to all ngFor loops
   - Optimize change detection with OnPush strategy

3. **Documentation**
   - Document YouTube history limitations
   - Add API integration guide for new platforms
   - Create troubleshooting guide for common issues

### Medium Term (1-2 Months)
1. **Architecture**
   - Centralize platform-specific logic (PlatformResolverService)
   - Split TwitchChatService into focused modules
   - Move all localStorage to preferences service

2. **Features**
   - Bookmarks/pins for important messages
   - Slow mode & followers-only indicators
   - Multi-account support per platform

3. **Quality**
   - E2E tests with Playwright
   - Contract tests for ChatMessage shape
   - Accessibility audit and fixes

### Long Term (3+ Months)
1. **Platform Expansion**
   - Trovo, DLive, Rumble support
   - Full YouTube feature parity
   - Discord integration (if in scope)

2. **Advanced Features**
   - Chat replay with VOD sync
   - Session export (JSON/CSV)
   - TTS integration
   - Plugin API (with sandboxing)

3. **Mobile**
   - Tauri Android/iOS companion app
   - Read-only chat view for tablets
   - Adaptive layouts

**Search & Jump**
- `ChatSearchService` for full-text search across session buffer
- Filter by platform, channel, and author
- Regex and case-sensitive search support
- Search modal with highlighted results
- Click to highlight selected message
- Keyboard shortcut hint (Ctrl+K)
