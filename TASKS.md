# UniChat Implementation Tasks - v0.1.0

**Current Version:** 0.1.0 (unchanged)  
**Last Updated:** March 28, 2026  
**Focus:** Stability, Performance, Code Quality

**Progress:** 3/14 tasks completed (21%)

---

## ✅ Completed Tasks

### Task 12: Fix Dark Mode Flicker (Issue #008) ✅
**Status:** ✅ Done  
**Committed:** `9c0a5a6`  
**Files Modified:** `src/index.html`

**Implementation:**
- Added inline script to apply theme before Angular bootstrap
- Read stored theme from localStorage synchronously
- Fallback to system preference if no stored theme
- **Result:** Eliminated white flash on application launch

---

### Task 4: Fix Emote Cache TTL (Issue #003) ✅
**Status:** ✅ Done  
**Committed:** `9168d30`  
**Files Modified:** `icons-storage.service.ts`, `icons-catalog.service.ts`, `settings-modal.*`

**Implementation:**
- Added TTL validation to IconsStorageService (24 hours default)
- Updated IconsCatalogService from 7-day to 24-hour TTL
- Added clearCache() method to force refresh
- Added refresh button to settings modal
- **Result:** Emotes now automatically refresh every 24 hours

---

### Task 6: Improve Error Messages (Issue #005) ✅
**Status:** ✅ Done  
**Committed:** `fcb1aba`  
**Files Modified:** `connection-error.service.ts`

**Implementation:**
- Added USER_FRIENDLY_MESSAGES mapping for all error codes
- Added getUserFriendlyMessage() method with platform context
- Updated error reporting methods to use friendly messages
- Added title, message, and action fields for UI components
- **Result:** User-friendly error messages instead of technical errors

---

## 📋 Remaining Task Backlog

| Priority | Category | Tasks | Impact |
|----------|----------|-------|--------|
| P0 | Critical | Issues #001, #002, #009 | High |
| P1 | High | Issues #003, #004, #005, #010 | Medium-High |
| P2 | Medium | Performance optimizations | Medium |
| P3 | Low | Issues #006, #007, #008 | Low-Medium |

---

## 📋 Task Backlog

### P0 - Critical Fixes

#### Task 1: Fix Memory Growth (Issue #001)
**Status:** ⏳ Pending  
**Files:** Multiple  
**Estimated:** 4-6 hours

**Subtasks:**
- [ ] Profile memory with Chrome DevTools
- [ ] Implement LRU cache for emotes (src/app/services/ui/emote-url.service.ts)
- [ ] Add message history pagination (src/app/services/data/chat-storage.service.ts)
- [ ] Fix WebSocket event handler leaks (src/app/services/providers/*.ts)
- [ ] Add cleanup on component destroy

**Acceptance Criteria:**
- Memory stable after 4+ hours
- No unbounded growth in emote cache
- Proper GC of old messages

---

#### Task 2: Fix Message Loss on Reconnect (Issue #002)
**Status:** ⏳ Pending  
**Files:** Provider services  
**Estimated:** 6-8 hours

**Subtasks:**
- [ ] Add message sequence tracking (src/app/models/chat.model.ts)
- [ ] Implement reconnection backfill per platform:
  - [ ] Twitch: Use IRC message IDs
  - [ ] Kick: Track timestamps
  - [ ] YouTube: Use pagination tokens
- [ ] Add gap indicators in UI (src/app/components/chat-message-card/)
- [ ] Display "X messages missed" notification

**Acceptance Criteria:**
- Zero message loss on brief disconnects
- User notified of any gaps
- Automatic backfill within 5 seconds

---

#### Task 3: Fix OAuth Token Race Condition (Issue #009)
**Status:** ⏳ Pending  
**Files:** Rust backend  
**Estimated:** 3-4 hours

**Subtasks:**
- [ ] Add tokio::sync::Mutex to token vault (src-tauri/src/services/auth/token_vault.service.rs)
- [ ] Implement refresh request queue
- [ ] Add request deduplication logic
- [ ] Write concurrent access tests

**Acceptance Criteria:**
- No concurrent refresh requests
- Token operations are atomic
- Zero 401 errors during refresh

---

### P1 - High Priority

#### Task 4: Fix Emote Cache Staleness (Issue #003)
**Status:** ⏳ Pending  
**Files:** Emote services  
**Estimated:** 3-4 hours

**Subtasks:**
- [ ] Add TTL to emote cache (24 hours default)
- [ ] Implement cache invalidation on app start
- [ ] Add manual refresh button in settings
- [ ] Cache version tracking

**Acceptance Criteria:**
- Emotes update within 24 hours
- No stale emotes after platform updates
- User can force refresh

---

#### Task 5: Fix TypeScript Strict Mode (Issue #004)
**Status:** ⏳ Pending  
**Files:** All TypeScript  
**Estimated:** 4-6 hours

**Subtasks:**
- [ ] Replace `any` in providers (12 occurrences)
- [ ] Replace `any` in helpers (8 occurrences)
- [ ] Replace `any` in models (5 occurrences)
- [ ] Enable `strict: true` in tsconfig.json
- [ ] Add ESLint no-any rule

**Acceptance Criteria:**
- Zero `any` types in codebase
- TypeScript strict mode enabled
- No compilation errors

---

#### Task 6: Improve Error Messages (Issue #005)
**Status:** ⏳ Pending  
**Files:** Error handling services  
**Estimated:** 3-4 hours

**Subtasks:**
- [ ] Create error message mapper (src/app/services/core/connection-error.service.ts)
- [ ] Add user-friendly messages for all error codes
- [ ] Include troubleshooting steps
- [ ] Add platform-specific guidance

**Acceptance Criteria:**
- All errors have actionable messages
- No technical jargon shown to users
- Includes recovery steps

---

#### Task 7: Fix YouTube Rate Limiting (Issue #010)
**Status:** ⏳ Pending  
**Files:** YouTube provider  
**Estimated:** 4-5 hours

**Subtasks:**
- [ ] Implement adaptive polling (src/app/services/providers/youtube-chat.service.ts)
- [ ] Add exponential backoff on 429
- [ ] Cache API responses
- [ ] Add rate limit header parsing
- [ ] Display quota warning to user

**Acceptance Criteria:**
- No quota exhaustion errors
- Automatic rate limit recovery
- User warned before limits

---

### P2 - Performance Optimizations

#### Task 8: Frontend OnPush Change Detection
**Status:** ⏳ Pending  
**Files:** All components  
**Estimated:** 6-8 hours

**Subtasks:**
- [ ] Add ChangeDetectionStrategy.OnPush to all components
- [ ] Fix change detection issues
- [ ] Add async pipes where needed
- [ ] Test all interactive features

---

#### Task 9: Add trackBy to ngFor
**Status:** ⏳ Pending  
**Files:** All templates  
**Estimated:** 2-3 hours

**Subtasks:**
- [ ] Add trackBy to chat message lists
- [ ] Add trackBy to channel lists
- [ ] Add trackBy to settings lists
- [ ] Create reusable trackBy functions

---

#### Task 10: Backend Connection Pooling
**Status:** ⏳ Pending  
**Files:** Rust WebSocket services  
**Estimated:** 4-5 hours

**Subtasks:**
- [ ] Implement connection pool (src-tauri/src/services/)
- [ ] Add rate limiting
- [ ] Optimize WebSocket reconnection
- [ ] Add connection health checks

---

#### Task 11: Add Structured Logging
**Status:** ⏳ Pending  
**Files:** Rust backend  
**Estimated:** 3-4 hours

**Subtasks:**
- [ ] Add tracing crate to Cargo.toml
- [ ] Replace println! with tracing macros
- [ ] Add log levels (trace, debug, info, warn, error)
- [ ] Configure log output format

---

### P3 - UX Improvements

#### Task 12: Fix Dark Mode Flicker (Issue #008)
**Status:** ⏳ Pending  
**Files:** Theme service, index.html  
**Estimated:** 1-2 hours

**Subtasks:**
- [ ] Add theme class to body in index.html
- [ ] Load theme synchronously on bootstrap
- [ ] Prevent flash of unstyled content

---

#### Task 13: Fix Small Screen UI (Issue #006)
**Status:** ⏳ Pending  
**Files:** CSS, component templates  
**Estimated:** 3-4 hours

**Subtasks:**
- [ ] Add responsive breakpoints
- [ ] Fix settings modal overflow
- [ ] Adjust chat cards for small screens
- [ ] Test down to 1024x768

---

#### Task 14: Fix Keyboard Shortcuts (Issue #007)
**Status:** ⏳ Pending  
**Files:** Keyboard shortcuts service  
**Estimated:** 2-3 hours

**Subtasks:**
- [ ] Fix context-aware shortcuts
- [ ] Add shortcut conflict detection
- [ ] Improve Escape key handling
- [ ] Add overlay mode fixes

---

## 📊 Progress Tracking

### Sprint 1: Critical Fixes (Week 1-2)
- [ ] Task 1: Memory Growth Fix
- [ ] Task 2: Message Loss Fix
- [ ] Task 3: OAuth Race Condition

### Sprint 2: Code Quality (Week 3)
- [ ] Task 4: Emote Cache TTL
- [ ] Task 5: TypeScript Strict
- [ ] Task 6: Error Messages

### Sprint 3: Performance (Week 4-5)
- [ ] Task 7: YouTube Rate Limiting
- [ ] Task 8: OnPush Change Detection
- [ ] Task 9: trackBy Functions

### Sprint 4: Polish (Week 6)
- [ ] Task 10: Connection Pooling
- [ ] Task 11: Structured Logging
- [ ] Task 12: Dark Mode Flicker
- [ ] Task 13: Small Screen UI
- [ ] Task 14: Keyboard Shortcuts

---

## 🚀 Quick Start

### Start with easiest high-impact task:

```bash
# Task 12: Dark Mode Flicker (1-2 hours)
# Files to modify:
# - src/index.html
# - src/app/services/core/theme.service.ts
```

### Or start with critical bug:

```bash
# Task 4: Emote Cache TTL (3-4 hours)
# Files to modify:
# - src/app/services/ui/emote-url.service.ts
# - src/app/services/ui/icons-storage.service.ts
```

---

## 📝 Task Template

```markdown
#### Task X: [Task Name]
**Status:** 🔄 In Progress / ✅ Done / ⏳ Pending  
**Files:** [File paths]  
**Estimated:** X hours

**Subtasks:**
- [ ] Subtask 1
- [ ] Subtask 2

**Acceptance Criteria:**
- Criteria 1
- Criteria 2
```

---

*Ready to start implementation. Pick a task and begin!*
