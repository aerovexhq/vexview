# vexview

A modern and minimalistic image and video viewer and editor app made for Linux with Rust and Tauri.

---

## Quick Installation

### 1. Universal One-Liner (All Linux Distros)

Install or update `vexview` with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/aerovexhq/vexview/main/install.sh | bash
```

> **Note:** To uninstall at any time, run: `curl -fsSL https://raw.githubusercontent.com/aerovexhq/vexview/main/install.sh | bash -s -- --uninstall`

---

### 2. Ubuntu / Debian / Linux Mint (`.deb`)

Download the latest Debian package from [Releases](https://github.com/aerovexhq/vexview/releases) and install via `apt` or `dpkg`:

```bash
# Download and install the latest .deb package
curl -LO https://github.com/aerovexhq/vexview/releases/latest/download/vexview_0.1.0_amd64.deb
sudo dpkg -i vexview_0.1.0_amd64.deb || sudo apt-get install -f -y
```

---

### 3. Arch Linux / Manjaro (PKGBUILD / AUR)

```bash
git clone https://github.com/aerovexhq/vexview.git
cd vexview/packaging/arch
makepkg -si
```

---

### 4. Fedora / RHEL / Generic Linux (Pre-built Tarball)

Download and extract the standalone portable archive:

```bash
curl -LO https://github.com/aerovexhq/vexview/releases/latest/download/vexview-linux-x86_64.tar.gz
tar -xzf vexview-linux-x86_64.tar.gz
./install.sh
```

---

## Features

- **Unified Media Experience:** Inspect raster images, vector art (SVG), animations (GIF), and videos within a single streamlined viewer.
- **Human-Crafted Industrial Aesthetic:**
  - Content-first 100% canvas with deep obsidian/matte surfaces (`#090a0d`).
  - Tactile monospace tabular figures for zero-jitter scrubbing.
  - Floating translucent HUD pill with auto-hide timer on mouse idle.
- **High-Performance Image Pipeline:**
  - Multi-threaded decoding (PNG, JPEG, WebP, AVIF, BMP, ICO, TIFF).
  - High-DPI vector rendering using `resvg` and `tiny-skia`.
  - Automatic EXIF orientation normalization.
  - SIMD-accelerated thumbnail generation (`fast_image_resize`).
- **Interactive Studio Editing Suite:**
  - Quick filter presets (B&W, Sepia, Invert, Original).
  - Fast transforms: 90°/180°/270° rotation, horizontal/vertical flipping, and rectangle cropping.
  - Precision adjustments: exposure, contrast, saturation, warmth, and Gaussian blur.
  - Safe non-destructive saving next to original by default with optional overwrite toggle.
  - Multi-level compression and quality selection (100% Original, 90% High, 75% Balanced, 50% Compact + custom slider).
- **Video Inspection & Lossless Processing:**
  - Sub-pixel timeline scrubber with frame stepping.
  - Instant lossless video stream trimming without re-encoding (`-c copy`) or multi-level CRF compression.
  - Video frame snapshot capture.
  - Two-pass animated GIF exporter with palette generation.
  - Multi-clip sequencer with background soundtrack and music composition.
- **Tactile Desktop Keyboard Controls:**
  - `Arrow Left` / `[` : Previous item
  - `Arrow Right` / `]` : Next item
  - `Space` : Play / Pause video
  - `0` : Reset zoom to 100%
  - `+` / `-` : Zoom in / out
  - `E` : Toggle Studio Adjustments drawer
  - `T` : Toggle Lossless Video Trimmer
  - `I` : Toggle EXIF & Media Inspector
  - `B` : Toggle bottom thumbnail filmstrip
  - `Esc` : Return to default view

---

## Workspace Structure

The project is structured as a Cargo workspace with decoupled responsibilities:

```
vexview/
├── crates/
│   ├── vex-core/    # Media models, natural sort directory scanner, config, and LRU cache
│   ├── vex-image/   # Image decoding, EXIF extraction, SVG rendering, and SIMD resizing
│   ├── vex-video/   # Video probing, lossless trimming, frame capture, and sequence composer
│   └── vex-edit/    # Transforms (crop/rotate/flip), color filters, and image exporter
├── src-tauri/       # Tauri 2 native desktop backend and typed IPC bridge
├── src/             # React 19 + TypeScript + PostCSS studio frontend
├── packaging/       # .deb, Arch PKGBUILD, and desktop integration specs
├── install.sh       # Universal Linux single-line installer
└── Cargo.toml       # Workspace root configuration
```

---

## Building from Source

### Prerequisites

* Rust 1.80+ (`rustup`)
* Node.js 20+ (`npm`)
* Linux dev headers: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`
* Utilities (optional for video processing): `ffmpeg`, `ffprobe`

### Commands

```bash
# Install frontend dependencies
npm install

# Run desktop app in development mode
npm run tauri dev

# Run all test suites
cargo test --workspace

# Build production binary
npm run tauri build -- --no-bundle
```

---

## License

This project is licensed under the [MIT License](LICENSE).
