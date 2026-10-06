#!/usr/bin/env bash
set -e

# vexview universal installer for Linux
# Repository: https://github.com/aerovexhq/vexview

REPO="aerovexhq/vexview"
APP_NAME="vexview"
VERSION="${VEXVIEW_VERSION:-latest}"

# Determine installation paths (root vs non-root)
if [ "$(id -u)" -eq 0 ]; then
    BIN_DIR="/usr/local/bin"
    APPS_DIR="/usr/share/applications"
    ICON_DIR="/usr/share/icons/hicolor"
    AUTOSTART_DIR="/etc/xdg/autostart"
else
    BIN_DIR="${HOME}/.local/bin"
    APPS_DIR="${HOME}/.local/share/applications"
    ICON_DIR="${HOME}/.local/share/icons/hicolor"
    AUTOSTART_DIR="${HOME}/.config/autostart"
fi

# Handle uninstall flag
if [ "$1" = "--uninstall" ] || [ "$1" = "-u" ]; then
    echo "==> Uninstalling ${APP_NAME}..."
    rm -f "${BIN_DIR}/${APP_NAME}"
    rm -f "${APPS_DIR}/${APP_NAME}.desktop"
    rm -f "${AUTOSTART_DIR}/${APP_NAME}.desktop"
    rm -f "${ICON_DIR}/128x128/apps/${APP_NAME}.png"
    rm -f "${ICON_DIR}/32x32/apps/${APP_NAME}.png"
    echo "==> ${APP_NAME} successfully uninstalled."
    exit 0
fi

echo "=========================================================="
echo "           vexview Universal Linux Installer              "
echo "  Modern & Minimalistic Image & Video Viewer & Editor     "
echo "=========================================================="

ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ]; then
    echo "Error: Currently only x86_64 architecture is supported (detected: $ARCH)."
    exit 1
fi

# Resolve version
if [ "$VERSION" = "latest" ]; then
    echo "==> Detecting latest release..."
    TAG=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$TAG" ]; then
        TAG="0.1.0"
    fi
else
    TAG="$VERSION"
fi

TARBALL_URL="https://github.com/${REPO}/releases/download/${TAG}/vexview-linux-x86_64.tar.gz"
echo "==> Downloading ${APP_NAME} (${TAG})..."

TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT

curl -fsSL "$TARBALL_URL" -o "${TMP_DIR}/vexview.tar.gz"

echo "==> Extracting archive..."
tar -xzf "${TMP_DIR}/vexview.tar.gz" -C "${TMP_DIR}"

echo "==> Installing files..."
mkdir -p "${BIN_DIR}" "${APPS_DIR}" "${AUTOSTART_DIR}" "${ICON_DIR}/128x128/apps" "${ICON_DIR}/32x32/apps"

install -m 755 "${TMP_DIR}/vexview" "${BIN_DIR}/${APP_NAME}"
install -m 644 "${TMP_DIR}/vexview.desktop" "${APPS_DIR}/${APP_NAME}.desktop"
install -m 644 "${TMP_DIR}/vexview.desktop" "${AUTOSTART_DIR}/${APP_NAME}.desktop"
if [ -f "${TMP_DIR}/icons/128x128.png" ]; then
    install -m 644 "${TMP_DIR}/icons/128x128.png" "${ICON_DIR}/128x128/apps/${APP_NAME}.png"
fi
if [ -f "${TMP_DIR}/icons/32x32.png" ]; then
    install -m 644 "${TMP_DIR}/icons/32x32.png" "${ICON_DIR}/32x32/apps/${APP_NAME}.png"
fi

# Update caches if available
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "${APPS_DIR}" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f "${ICON_DIR}" 2>/dev/null || true

echo ""
echo "=========================================================="
echo "  ✓ Installation complete!"
echo "  Executable: ${BIN_DIR}/${APP_NAME}"
echo "  Desktop entry: ${APPS_DIR}/${APP_NAME}.desktop"
echo ""
echo "  You can launch it from your application launcher or by running:"
echo "    vexview [path/to/media]"
echo ""
echo "  To uninstall: ${BIN_DIR}/${APP_NAME} --uninstall (or re-run installer with --uninstall)"
echo "=========================================================="
