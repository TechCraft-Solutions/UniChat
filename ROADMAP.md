# UniChat Development Roadmap

## Project Overview

UniChat is a Tauri-based desktop chat aggregator for streamers, supporting Twitch, Kick, YouTube, and more. Built with Angular (frontend) and Rust (backend).

**Current Version:** 0.1.0
**Last Updated:** March 28, 2026

---

## 🎯 Strategic Goals

### High Priority

1. **Performance Optimization**
   - Reduce memory footprint for high-traffic chat sessions (1000+ msg/min)
   - ✅ Implement virtual scrolling for chat history
   - Optimize WebSocket reconnection logic
   - Profile and reduce Rust backend CPU usage

2. **Stability & Reliability**
   - Comprehensive error handling across all providers
   - Graceful degradation when platforms are unavailable
   - Automated reconnection with exponential backoff
   - Session persistence and recovery

3. **Code Quality**
   - Increase test coverage (target: 70%+)
   - Implement CI/CD pipeline with automated testing
   - Establish code review guidelines
   - Regular dependency updates and security audits

### Medium Priority

4. **Feature Enhancements**
   - Advanced moderation tools (timeout/ban macros)
   - Custom emote support across platforms
   - Chat replay for VOD creation
   - Multi-account management

5. **User Experience**
   - Customizable themes and layouts
   - Configurable keyboard shortcuts
   - Improved search and filtering
   - Notification system for highlights

6. **Platform Support**
   - Mobile companion app (Android/iOS)
   - Linux AppImage and Flatpak distribution
   - Windows MSIX installer
   - macOS notarization for App Store

---

## 📋 Optimization Plan

### Frontend (Angular)

#### Current Focus (0.1.0)
- [x] Fix dark mode flicker on startup
- [x] Add 24-hour TTL to emote cache
- [x] Improve error messages with user-friendly text
- [x] Implement `OnPush` change detection strategy across all components
- [x] Add trackBy functions to all `*ngFor` directives
- [ ] Lazy load non-critical services and components
- [ ] Optimize bundle size with tree-shaking
- [ ] Implement service worker for offline capabilities

#### Next Steps (0.1.0)
- [ ] Migrate to Angular Signals for reactive state management
- [x] Implement virtual scrolling for chat message lists
- [ ] Add memoization for expensive computations (emote parsing, message formatting)
- [ ] Optimize CSS with Tailwind purge configuration
- [ ] Reduce change detection cycles with `async` pipe

#### Future (0.1.0)
- [ ] Implement Web Workers for message parsing
- [ ] Add IndexedDB for chat history caching
- [ ] Optimize image loading with lazy loading and caching
- [ ] Profile and optimize rendering performance

### Backend (Rust/Tauri)

#### Current Focus (0.1.0)
- [ ] Optimize WebSocket connection pooling
- [ ] Implement connection rate limiting
- [x] Add structured logging with tracing crate
- [ ] Improve error propagation with `thiserror`

#### Next Steps (0.1.0)
- [ ] Implement message batching for high-throughput scenarios
- [ ] Add Redis caching for shared state (optional)
- [ ] Optimize JSON serialization with `simd-json`
- [ ] Profile and reduce memory allocations

#### Future (0.1.0)
- [ ] Implement plugin architecture for new platforms
- [ ] Add gRPC support for inter-process communication
- [ ] Optimize tokio runtime configuration
- [ ] Add performance metrics and monitoring

### Build & CI/CD

#### Current Focus (0.1.0)
- [ ] Set up GitHub Actions for automated testing
- [ ] Add clippy and fmt checks for Rust code
- [ ] Implement incremental builds for faster CI
- [ ] Add code coverage reporting

#### Next Steps (0.1.0)
- [ ] Set up automated release pipeline
- [ ] Implement semantic versioning
- [ ] Add changelog generation
- [ ] Create automated performance regression tests

---

## 🗺️ Version Milestones

### v0.1.0 (Current) - Foundation & Stability

**Completed:**
- ✅ Core chat aggregation (Twitch, Kick, YouTube)
- ✅ Mixed and split view modes
- ✅ Basic moderation tools
- ✅ Overlay support
- ✅ Settings management
- ✅ Dark mode flicker fix
- ✅ Emote cache with 24h TTL
- ✅ User-friendly error messages
- ✅ Memory management with auto-pruning
- ✅ Message gap detection on reconnect
- ✅ OAuth token race condition fix
- ✅ YouTube rate limiting with exponential backoff
- ✅ Performance optimizations (OnPush, trackBy) - 25 components, 44+ trackBy
- ✅ Enhanced logging and debugging (Rust backend)
- ✅ Virtual scrolling for chat history (CDK virtual scroll)
- ✅ Chat history export (JSON, TXT, CSV formats)

**In Progress:**
- [ ] Bundle size optimization
- [ ] Advanced moderation dashboard
- [ ] Custom emote management

**Planned:**
- [ ] Multi-language support (i18n)
- [ ] Plugin system for extensibility
- [ ] Mobile companion app
- [ ] Cloud sync for settings (optional)
- [ ] AI-powered chat filtering (optional)
- [ ] Performance dashboard
- [ ] Comprehensive test suite

---

## 🔧 Technical Debt

### Known Issues
1. ~~**Memory usage** - Grows with extended sessions (>4 hours)~~ - ✅ **Fixed** (auto-pruning every 60s)
2. ~~**Reconnection logic** - Can lose messages during network blips~~ - ✅ **Fixed** (gap detection + UI indicators)
3. ~~**Emote caching** - No TTL, can become stale~~ - ✅ **Fixed** (24h TTL)
4. ~~**TypeScript strictness** - Some `any` types remain~~ - ✅ **Fixed** (strict mode enabled, violations resolved)
5. ~~**Error messages** - Not user-friendly in all cases~~ - ✅ **Fixed** (user-friendly messages)
6. ~~**OAuth race condition** - Concurrent token refresh~~ - ✅ **Fixed** (thread-safe cache)
7. ~~**YouTube rate limiting** - API quota exhaustion~~ - ✅ **Fixed** (exponential backoff)

### Refactoring Candidates
1. **Provider abstraction** - Consolidate duplicate logic across platforms
2. **State management** - Centralize with NgRx or Signals
3. **Component structure** - Break down large components (>500 lines)
4. **Service dependencies** - Reduce circular dependencies
5. **Rust error handling** - Consistent error types across modules
6. **Dead code removal** - Remove unused imports, variables, functions
7. **Code deduplication** - Extract reusable utilities

---

## 📊 Metrics & KPIs

### Performance Targets
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Cold start time | ~2s | <1s | Time to interactive |
| Memory usage (idle) | ~150MB | <100MB | RSS after 5 min |
| Memory usage (load) | ~400MB | <250MB | 1000 msg/min |
| Message latency | ~50ms | <20ms | Platform to render |
| CPU usage (idle) | ~2% | <1% | Single core equivalent |
| Bundle size | ~1.26MB | <3MB | Gzipped main bundle |

### Quality Targets
| Metric | Current | Target |
|--------|---------|--------|
| Test coverage | ~20% | 70%+ |
| Linter violations | 0 | 0 |
| TypeScript strict mode | ✅ Full | Full |
| Documentation coverage | ~40% | 80%+ |

---

## 🤝 Contribution Guidelines

### Getting Started
1. Read [README.md](README.md) for setup instructions
2. Check [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines
3. Review existing issues and PRs
4. Join community discussions

### Code Standards
- **TypeScript**: Strict mode, ESLint rules
- **Rust**: Clippy warnings as errors, rustfmt
- **Commits**: Conventional Commits specification
- **PRs**: Include tests, update documentation

---

## 📝 Changelog

See [CHANGELOG.md](docs/CHANGELOG.md) for detailed version history.

---

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/rusnakdima/UniChat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rusnakdima/UniChat/discussions)
- **Email**: rusnakdima03@gmail.com

---

*This roadmap is a living document and will be updated quarterly based on community feedback and project priorities.*
