#!/usr/bin/env bash
set -euo pipefail

# vexview unified release script
# Builds and uploads strictly:
# 1. vexview_<version>_amd64.AppImage
# 2. vexview-<version>-linux-x86_64.tar.gz
# 3. vexview_<version>_amd64.deb

REPO="aerovexhq/vexview"
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

# Determine target release tag / version
TAG="${1:-}"
if [ -z "${TAG}" ]; then
  # Try to get latest release tag from GitHub
  TAG=$(gh release view -R "${REPO}" --json tagName -q .tagName 2>/dev/null || true)
  if [ -z "${TAG}" ]; then
    # Fallback to Cargo.toml
    TAG=$(grep -m1 '^version' Cargo.toml | awk -F '"' '{print $2}')
  fi
fi

VERSION="${TAG#v}"
echo "==> Preparing release for vexview version ${VERSION} (tag: ${TAG})..."

# Ensure tools are present
command -v appimagetool >/dev/null 2>&1 || {
  echo "Error: appimagetool not found in PATH. Ensure ~/.local/bin is in PATH." >&2
  exit 1
}
command -v dpkg-deb >/dev/null 2>&1 || {
  echo "Error: dpkg-deb not found in PATH." >&2
  exit 1
}
command -v gh >/dev/null 2>&1 || {
  echo "Error: gh CLI not found in PATH." >&2
  exit 1
}

# Dedicated staging directory for release artifacts (isolated from Vite frontend dist/)
DIST_DIR="${ROOT_DIR}/dist-release"
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

echo "==> Building frontend assets with Vite..."
npm run build

echo "==> Compiling vexview release binary..."
cargo build --release -p vexview-app
cp target/release/vexview-app target/release/vexview
strip target/release/vexview target/release/vexview-app || true

echo "==> Building Debian package..."
bash packaging/deb/build_deb.sh "${VERSION}"
cp "target/debian/vexview_${VERSION}_amd64.deb" "${DIST_DIR}/vexview_${VERSION}_amd64.deb"

echo "==> Assembling AppImage..."
APPDIR="${ROOT_DIR}/target/vexview_appdir"
rm -rf "${APPDIR}"
mkdir -p "${APPDIR}/usr/bin" \
         "${APPDIR}/usr/share/applications" \
         "${APPDIR}/usr/share/icons/hicolor/scalable/apps" \
         "${APPDIR}/usr/share/icons/hicolor/256x256/apps" \
         "${APPDIR}/usr/share/icons/hicolor/128x128/apps" \
         "${APPDIR}/usr/share/icons/hicolor/32x32/apps"

cp target/release/vexview "${APPDIR}/usr/bin/vexview"
chmod +x "${APPDIR}/usr/bin/vexview"
cp packaging/vexview.desktop "${APPDIR}/vexview.desktop"
cp packaging/vexview.desktop "${APPDIR}/usr/share/applications/vexview.desktop"
cp src-tauri/icons/128x128@2x.png "${APPDIR}/vexview.png"
cp src-tauri/icons/128x128@2x.png "${APPDIR}/usr/share/icons/hicolor/256x256/apps/vexview.png"
cp src-tauri/icons/128x128.png "${APPDIR}/usr/share/icons/hicolor/128x128/apps/vexview.png"
cp src-tauri/icons/32x32.png "${APPDIR}/usr/share/icons/hicolor/32x32/apps/vexview.png"
cp packaging/vexview.svg "${APPDIR}/usr/share/icons/hicolor/scalable/apps/vexview.svg"

cat <<'EOF' > "${APPDIR}/AppRun"
#!/bin/sh
HERE="$(dirname "$(readlink -f "${0}")")"
exec "${HERE}/usr/bin/vexview" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

ARCH=x86_64 appimagetool "${APPDIR}" "${DIST_DIR}/vexview_${VERSION}_amd64.AppImage"

echo "==> Creating portable tarball..."
TAR_DIR="${ROOT_DIR}/target/tarball_staging"
rm -rf "${TAR_DIR}"
mkdir -p "${TAR_DIR}/icons"

cp target/release/vexview "${TAR_DIR}/vexview"
chmod +x "${TAR_DIR}/vexview"
cp install.sh "${TAR_DIR}/install.sh"
chmod +x "${TAR_DIR}/install.sh"
cp packaging/vexview.desktop "${TAR_DIR}/vexview.desktop"
cp README.md LICENSE "${TAR_DIR}/" 2>/dev/null || true
cp src-tauri/icons/128x128.png "${TAR_DIR}/icons/"
cp src-tauri/icons/32x32.png "${TAR_DIR}/icons/"

tar -czf "${DIST_DIR}/vexview-${VERSION}-linux-x86_64.tar.gz" -C "${TAR_DIR}" .

echo "==> Staged release assets in dist-release/:"
ls -lh "${DIST_DIR}"

# Check upload flag (default: true)
UPLOAD="${UPLOAD:-true}"
if [ "${UPLOAD}" = "true" ]; then
  echo "==> Uploading assets to GitHub release ${TAG} in ${REPO}..."
  if gh release view "${TAG}" -R "${REPO}" >/dev/null 2>&1; then
    gh release upload "${TAG}" "${DIST_DIR}"/* --clobber -R "${REPO}"
  else
    echo "Creating new release ${TAG}..."
    gh release create "${TAG}" "${DIST_DIR}"/* \
      --title "vexview ${VERSION}: Modern and Minimalistic Linux Media Viewer and Editor" \
      --notes "Modern and minimalistic image, video and audio viewer and editor for Linux." \
      -R "${REPO}"
  fi
  echo "==> Release assets successfully uploaded to ${REPO} @ ${TAG}!"
else
  echo "==> UPLOAD=false specified; skipping upload."
fi
