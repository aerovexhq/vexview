# luxviewer

A modern and minimalistic image and video preview and editor app made for Linux with Rust.

---

## Features

- **Unified Media Experience:** Inspect raster images, vector art (SVG), animations (GIF), and videos within a single streamlined viewer.
- **High-Performance Image Pipeline:**
  - Multi-threaded decoding (PNG, JPEG, WebP, AVIF, BMP, ICO, TIFF).
  - High-DPI vector rendering using `resvg` and `tiny-skia`.
  - Automatic EXIF orientation normalization.
  - SIMD-accelerated thumbnail generation (`fast_image_resize`).
- **Non-Destructive Editing Suite:**
  - Fast transforms: 90°/180°/270° rotation, horizontal/vertical flipping, and arbitrary rectangle cropping.
  - Color adjustments: brightness, contrast, invert, and grayscale.
  - Filters: Gaussian blur and unsharp masking.
  - Multi-format exporter (PNG, JPEG, WebP).
- **Video Inspection & Lossless Processing:**
  - Stream inspection and metadata extraction via `ffprobe`.
  - Lossless video stream trimming without re-encoding.
  - Video frame snapshot capture.
  - Optimized two-pass video-to-GIF converter with palette generation.
- **Modular Rust Architecture:**
  - Clean separation into decoupled, portable crates.
  - Memory-budgeted LRU cache for decoded media buffers.
  - Natural sorting for file navigation (e.g. `1.png`, `2.png`, `10.png`).

---

## Workspace Structure

The project is structured as a Cargo workspace with decoupled responsibilities:

```
luxviewer/
├── crates/
│   ├── lux-core/    # Media models, natural sort directory scanner, config, and LRU cache
│   ├── lux-image/   # Image decoding, EXIF extraction, SVG rendering, and SIMD resizing
│   ├── lux-video/   # Video probing, lossless trimming, frame capture, and GIF export
│   ├── lux-edit/    # Transforms (crop/rotate/flip), color filters, and image exporter
│   └── lux-gui/     # CLI runner and native Linux GUI
├── .github/
│   └── workflows/   # Automated CI (cargo fmt, clippy, test)
└── Cargo.toml       # Workspace root configuration
```

---

## Getting Started

### Prerequisites

* Rust 1.80+ (`rustup`)
* System utilities (optional for video processing): `ffmpeg`, `ffprobe`

### Building & Testing

```bash
# Check code formatting
cargo fmt --check

# Run linter
cargo clippy --all-targets -- -D warnings

# Run all unit and integration tests
cargo test

# Build debug binary
cargo build

# Run CLI media inspector
cargo run -- path/to/image.png
```

---

## License

This project is licensed under the [MIT License](LICENSE).
