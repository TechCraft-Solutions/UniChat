# UniChat Known Issues

**Last Updated:** March 28, 2026  
**Version:** 0.1.0

---

## 🔴 Critical Issues

### 1. Memory Growth During Extended Sessions
**Severity:** High  
**Impact:** Application slowdown after 4+ hours of continuous use  
**Status:** Investigating  
**Tracking:** #001

**Symptoms:**
- Memory usage gradually increases from ~150MB to 500MB+
- UI becomes sluggish after extended periods
- Chat message rendering slows down

**Workaround:**
- Restart application every 3-4 hours during heavy usage
- Limit chat history retention in settings

**Root Cause Analysis:**
- Potential memory leaks in WebSocket event handlers
- Emote cache growing unbounded
- Chat message objects not being garbage collected

**Next Steps:**
- Profile memory allocation with Chrome DevTools
- Implement LRU cache for emotes
- Add message history pagination

---

### 2. Message Loss During Reconnection
**Severity:** High  
**Impact:** Missing chat messages during network instability  
**Status:** Confirmed  
**Tracking:** #002

**Symptoms:**
- Messages lost when WebSocket disconnects briefly
- No indication of message gap in chat timeline
- Timestamps show jumps during reconnection

**Workaround:**
- Monitor connection status indicator
- Use platform native apps as backup during important streams

**Root Cause Analysis:**
- Reconnection logic doesn't request missed messages
- No message sequence tracking implemented
- Platform APIs don't support backfilling by default

**Next Steps:**
- Implement message sequence numbers
- Add reconnection backfill logic per platform
- Display gap indicators in chat stream

---

## 🟡 Moderate Issues

### 3. Emote Cache Staleness
**Severity:** Medium  
**Impact:** Outdated or missing emotes after platform updates  
**Status:** Known  
**Tracking:** #003

**Symptoms:**
- New emotes don't appear until cache is cleared
- Deleted emotes still render
- Third-party emote packs (FFZ, BTTV) lag behind

**Workaround:**
- Clear emote cache in settings
- Restart application after platform emote updates

**Root Cause:**
- No TTL on cached emote data
- Cache invalidation only on application restart
- No webhook/listener for emote updates

**Fix Planned:** v0.3.0

---

### 4. TypeScript Strict Mode Violations
**Severity:** Medium  
**Impact:** Potential runtime errors, reduced type safety  
**Status:** In Progress  
**Tracking:** #004

**Affected Files:**
- `src/app/services/providers/*.ts` - 12 `any` types
- `src/app/helpers/*.ts` - 8 `any` types
- `src/app/models/*.ts` - 5 `any` types

**Workaround:**
- N/A (code quality issue)

**Next Steps:**
- Replace `any` with proper types/interfaces
- Enable `strict: true` in tsconfig.json
- Add ESLint rule to prevent new `any` types

---

### 5. Error Message User Experience
**Severity:** Medium  
**Impact:** Users can't troubleshoot connection issues  
**Status:** Confirmed  
**Tracking:** #005

**Symptoms:**
- Generic "Connection failed" messages
- No actionable troubleshooting steps
- Technical errors shown to end users

**Examples:**
```
❌ "Error: ECONNRESET"
❌ "WebSocket closed: code 1006"
❌ "Failed to fetch: CORS error"
```

**Desired Behavior:**
```
✅ "Twitch chat disconnected. Checking your internet connection..."
✅ "Kick API unavailable. Retrying in 30 seconds."
✅ "YouTube authentication expired. Please reconnect your account."
```

**Fix Planned:** v0.2.0

---

## 🟢 Minor Issues

### 6. UI Responsiveness on Small Screens
**Severity:** Low  
**Impact:** Layout issues on resolutions below 1280x720  
**Status:** Known  
**Tracking:** #006

**Symptoms:**
- Settings modal cutoff on small screens
- Chat message cards overlap at minimum window size
- Sidebar icons misaligned below 1024px width

**Workaround:**
- Use minimum window size of 1366x768
- Enable compact mode in settings

**Fix Planned:** v0.3.0

---

### 7. Keyboard Shortcut Conflicts
**Severity:** Low  
**Impact:** Some shortcuts don't work in certain contexts  
**Status:** Investigating  
**Tracking:** #007

**Reported Conflicts:**
- `Ctrl+K` (search) conflicts with browser dev tools
- `Ctrl+Shift+M` (mute) doesn't work in overlay mode
- `Escape` (close modal) sometimes closes entire app

**Workaround:**
- Customize shortcuts in settings
- Avoid using conflicting key combinations

---

### 8. Dark Mode Flicker on Startup
**Severity:** Low  
**Impact:** Brief white flash before dark theme loads  
**Status:** Confirmed  
**Tracking:** #008

**Symptoms:**
- White screen flash (~200ms) on application launch
- Theme appears to "load" after initial render
- More noticeable on slower systems

**Root Cause:**
- Theme loaded from localStorage after initial paint
- No theme class on `<body>` during bootstrap
- Angular bootstrap sequence timing

**Fix Planned:** v0.2.0

---

## 🔧 Rust Backend Issues

### 9. OAuth Token Refresh Race Condition
**Severity:** Medium  
**Impact:** Occasional authentication failures during token refresh  
**Status:** Investigating  
**Tracking:** #009

**Symptoms:**
- Random 401 errors during active sessions
- Multiple refresh requests sent simultaneously
- Token vault sometimes stores stale tokens

**Affected Services:**
- `src-tauri/src/services/auth/oauth_provider.service.rs`
- `src-tauri/src/services/auth/token_vault.service.rs`

**Root Cause Analysis:**
- Concurrent refresh requests not properly serialized
- Mutex contention on token vault
- No request deduplication logic

**Next Steps:**
- Implement refresh request queue
- Add atomic token operations
- Use `tokio::sync::Mutex` for async safety

---

### 10. YouTube API Rate Limiting
**Severity:** Medium  
**Impact:** Chat disconnects during high-traffic streams  
**Status:** Confirmed  
**Tracking:** #010

**Symptoms:**
- "API quota exceeded" errors
- YouTube chat stops updating after ~1 hour
- Rate limit resets unpredictably

**Workaround:**
- Reduce polling frequency in settings
- Use official YouTube chat for critical streams

**Next Steps:**
- Implement adaptive polling based on rate limit headers
- Add exponential backoff on 429 responses
- Cache API responses where applicable

---

### 11. Platform-Specific Connection Errors
**Severity:** Medium  
**Impact:** Inconsistent behavior across platforms  
**Status:** Known  
**Tracking:** #011

| Platform | Issue | Frequency |
|----------|-------|-----------|
| Twitch | IRC server timeouts | Occasional |
| Kick | WebSocket 1006 errors | Frequent |
| YouTube | API quota exhaustion | Rare |
| Trovo | Connection instability | Frequent |

**Next Steps:**
- Platform-specific reconnection strategies
- Better error classification per platform
- Fallback connection methods

---

## 📋 Deprecated Features

### 12. Legacy Chat Provider Support
**Status:** Deprecated since v0.1.0  
**Removal Planned:** v0.4.0

**Deprecated Platforms:**
- Mixer (shutdown)
- Facebook Gaming (limited support)
- Discord (community request only)

**Migration Path:**
- Users should switch to supported platforms
- Export saved configurations before upgrade

---

## 🚧 Work In Progress Fixes

| Issue | Status | Expected Fix | PR |
|-------|--------|--------------|-----|
| #001 Memory Growth | Investigating | v0.2.0 | - |
| #002 Message Loss | In Progress | v0.2.0 | #45 |
| #004 TypeScript Strict | In Progress | v0.2.0 | #52 |
| #005 Error Messages | Planned | v0.2.0 | - |
| #008 Dark Mode Flicker | Planned | v0.2.0 | - |
| #009 OAuth Race Condition | Investigating | v0.2.0 | #48 |

---

## 📞 Reporting New Issues

### Before Reporting
1. Check existing issues (open and closed)
2. Update to latest version
3. Try troubleshooting steps in this document
4. Collect relevant logs

### How to Report
**GitHub Issues:** https://github.com/rusnakdima/UniChat/issues

**Include:**
- UniChat version
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/videos if applicable
- Logs from:
  - Frontend: `DevTools > Console`
  - Backend: `~/.cache/unichat/logs/`

### Log Collection
```bash
# Enable debug logging
# In settings, enable "Debug Mode"
# Reproduce issue
# Logs located at:
# Linux: ~/.cache/unichat/logs/
# Windows: %APPDATA%\unichat\logs\
# macOS: ~/Library/Application Support/unichat/logs/
```

---

## 📚 Related Documentation

- [ROADMAP.md](ROADMAP.md) - Development priorities and plans
- [README.md](README.md) - Setup and usage guide
- [CONTRIBUTING.md](docs/CONTRIBUTING.md) - How to contribute
- [CHANGELOG.md](docs/CHANGELOG.md) - Version history

---

*This document is updated with each release. Last reviewed: March 28, 2026*
