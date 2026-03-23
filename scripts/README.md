# Scripts

Utility scripts for the UniChat project.

## Build (`build-optimized.sh` / `build-optimized.cmd`)

Optimized builds that skip the Angular bundle when `src/` has not changed (unless `CI=true` or `FORCE_BUILD=true`).

### Linux / macOS

```bash
chmod +x scripts/build-optimized.sh

./scripts/build-optimized.sh build desktop release
./scripts/build-optimized.sh build desktop debug
./scripts/build-optimized.sh build android release
./scripts/build-optimized.sh build desktop release --target aarch64-apple-darwin

FORCE_BUILD=true ./scripts/build-optimized.sh build
./scripts/build-optimized.sh clean
```

### Windows

Prefer Git Bash and `build-optimized.sh`. The `.cmd` helper runs a full `npm run build:prod` and `npm run tauri:build`.

## Version sync (`sync-versions.sh`)

Keeps `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, optional `src/environments/environment.ts`, and Flatpak metadata in sync.

```bash
./scripts/sync-versions.sh 1.2.3
```
