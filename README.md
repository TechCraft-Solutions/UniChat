# UniChat

UniChat is a desktop chat client built with [Tauri](https://tauri.app/) and [Angular](https://angular.dev/). It aggregates live chat from multiple streaming platforms (Twitch, Kick, YouTube, and more) in **mixed** or **split** views, with replies, channel switching, and a workflow tuned for streamers and moderators.

## Installation

### Check toolchain

```bash
node -v
npm -v
rustc --version
```

Install [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/tools/install) if anything is missing.

### Install dependencies

```bash
npm install
```

## Usage

### Development

```bash
npm run tauri:dev
```

This runs the Angular dev server and opens the Tauri shell.

### Production build

```bash
npm run tauri:build
```

Artifacts appear under `src-tauri/target/release/bundle/`.

## Build optimization

Smart scripts skip rebuilding the Angular bundle when `src/` has not changed (unless `CI=true` or `FORCE_BUILD=true`):

```bash
npm run build:smart
npm run build:smart:debug
npm run build:smart:android
npm run build:clean
```

Traditional shortcuts:

```bash
npm run build:prod
npm run tauri:build
npm run tauri:build:fast
npm run tauri:build:android
```

### Formatting

```bash
npm run format
npm run format:rust
npm run format:all
```

### Flatpak (Linux)

See [`flatpak/README.md`](flatpak/README.md).

### Mobile CI (optional)

GitHub Actions workflows for **Android** and **iOS** expect a generated Tauri mobile project:

- Android: run `npx tauri android init` and commit `src-tauri/gen/android`.
- iOS: run `npx tauri ios init` and commit `src-tauri/gen/apple`. Adjust Xcode scheme names in `.github/workflows/ios.yml` if they differ from `unichat_iOS` / `unichat.xcodeproj`.

## Authors

- [Dmitriy303](https://github.com/rusnakdima)

## License

This project is licensed under the [MIT License](LICENSE.MD).

## Contact

Questions or feedback: [rusnakdima03@gmail.com](mailto:rusnakdima03@gmail.com).
