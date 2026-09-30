#!/usr/bin/env bash
set -e

VERSION="0.1.0"
PACKAGE_NAME="luxviewer"
ARCH="amd64"
OUTPUT_DIR="target/debian"
BUILD_ROOT="${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}"

echo "==> Building Debian package for ${PACKAGE_NAME} v${VERSION} (${ARCH})..."

mkdir -p "${BUILD_ROOT}/DEBIAN"
mkdir -p "${BUILD_ROOT}/usr/bin"
mkdir -p "${BUILD_ROOT}/usr/share/applications"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/32x32/apps"

# Find release binary
if [ -f "target/release/luxviewer-app" ]; then
    BINARY_PATH="target/release/luxviewer-app"
elif [ -f "target/release/luxviewer" ]; then
    BINARY_PATH="target/release/luxviewer"
else
    echo "Error: Release binary not found in target/release/. Run cargo build --release first."
    exit 1
fi

install -m 755 "${BINARY_PATH}" "${BUILD_ROOT}/usr/bin/luxviewer"
install -m 644 "packaging/luxviewer.desktop" "${BUILD_ROOT}/usr/share/applications/luxviewer.desktop"
install -m 644 "src-tauri/icons/128x128.png" "${BUILD_ROOT}/usr/share/icons/hicolor/128x128/apps/luxviewer.png"
install -m 644 "src-tauri/icons/32x32.png" "${BUILD_ROOT}/usr/share/icons/hicolor/32x32/apps/luxviewer.png"

# Control file
cat <<EOF > "${BUILD_ROOT}/DEBIAN/control"
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: graphics
Priority: optional
Architecture: ${ARCH}
Depends: libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libgtk-3-0
Maintainer: Larvance <https://github.com/larvance>
Description: Modern and minimalistic image and video viewer and editor app for Linux
 An industrial-grade, distraction-free media viewer built with Rust and Tauri.
 Supports JPEG, PNG, WebP, AVIF, SVG, GIF, MP4, MKV, WebM, lossless trimming,
 and non-destructive image adjustments.
EOF

dpkg-deb --build "${BUILD_ROOT}" "${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
echo "==> Successfully created: ${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
