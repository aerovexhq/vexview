#!/usr/bin/env bash
set -e

VERSION="0.1.0"
PACKAGE_NAME="vexview"
ARCH="amd64"
OUTPUT_DIR="target/debian"
BUILD_ROOT="${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}"

echo "==> Building Debian package for ${PACKAGE_NAME} v${VERSION} (${ARCH})..."

mkdir -p "${BUILD_ROOT}/DEBIAN"
mkdir -p "${BUILD_ROOT}/usr/bin"
mkdir -p "${BUILD_ROOT}/usr/share/applications"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/32x32/apps"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/256x256/apps"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${BUILD_ROOT}/usr/share/icons/hicolor/scalable/apps"
mkdir -p "${BUILD_ROOT}/usr/share/bash-completion/completions"
mkdir -p "${BUILD_ROOT}/usr/share/zsh/vendor-completions"
mkdir -p "${BUILD_ROOT}/usr/share/fish/vendor_completions.d"

# Find or build release binary
if [ -f "target/release/vexview-app" ]; then
    BINARY_PATH="target/release/vexview-app"
elif [ -f "target/release/vexview" ]; then
    BINARY_PATH="target/release/vexview"
else
    echo "==> Release binary not found. Building vexview in release mode..."
    npm run build
    cargo build --release -p vexview-app
    BINARY_PATH="target/release/vexview-app"
fi

install -m 755 "${BINARY_PATH}" "${BUILD_ROOT}/usr/bin/vexview"
install -m 644 "packaging/vexview.desktop" "${BUILD_ROOT}/usr/share/applications/vexview.desktop"
install -m 644 "src-tauri/icons/32x32.png" "${BUILD_ROOT}/usr/share/icons/hicolor/32x32/apps/vexview.png"
install -m 644 "src-tauri/icons/128x128.png" "${BUILD_ROOT}/usr/share/icons/hicolor/128x128/apps/vexview.png"
install -m 644 "src-tauri/icons/128x128@2x.png" "${BUILD_ROOT}/usr/share/icons/hicolor/256x256/apps/vexview.png"
install -m 644 "src-tauri/icons/icon.png" "${BUILD_ROOT}/usr/share/icons/hicolor/512x512/apps/vexview.png"
install -m 644 "packaging/vexview.svg" "${BUILD_ROOT}/usr/share/icons/hicolor/scalable/apps/vexview.svg"
install -m 644 "packaging/completions/vexview.bash" "${BUILD_ROOT}/usr/share/bash-completion/completions/vexview"
install -m 644 "packaging/completions/_vexview" "${BUILD_ROOT}/usr/share/zsh/vendor-completions/_vexview"
install -m 644 "packaging/completions/vexview.fish" "${BUILD_ROOT}/usr/share/fish/vendor_completions.d/vexview.fish"

# Control file
cat <<EOF > "${BUILD_ROOT}/DEBIAN/control"
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: graphics
Priority: optional
Architecture: ${ARCH}
Depends: libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libgtk-3-0
Recommends: ffmpeg
Maintainer: aerovexhq <https://github.com/aerovexhq>
Description: Modern and minimalistic image and video viewer and editor app for Linux
 An industrial-grade, distraction-free media viewer built with Rust and Tauri.
 Supports JPEG, PNG, WebP, AVIF, SVG, GIF, MP4, MKV, WebM, lossless trimming,
 and non-destructive image adjustments.
EOF

# Post-installation script (MIME database, icon cache, and default application association)
cat <<'EOF' > "${BUILD_ROOT}/DEBIAN/postinst"
#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
    # Update desktop database
    if which update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q /usr/share/applications || true
    fi

    # Update MIME database
    if which update-mime-database >/dev/null 2>&1; then
        update-mime-database /usr/share/mime || true
    fi

    # Update icon cache
    if which gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
    fi

    # Primary media MIME types handled by vexview
    MIMES="image/png image/jpeg image/webp image/svg+xml image/gif image/bmp image/avif image/tiff video/mp4 video/x-matroska video/webm video/quicktime video/x-msvideo"

    # 1. System-wide default in /etc/xdg/mimeapps.list
    mkdir -p /etc/xdg
    if [ ! -f /etc/xdg/mimeapps.list ]; then
        echo "[Default Applications]" > /etc/xdg/mimeapps.list
    elif ! grep -q "\[Default Applications\]" /etc/xdg/mimeapps.list; then
        printf "\n[Default Applications]\n" >> /etc/xdg/mimeapps.list
    fi

    for mime in $MIMES; do
        if grep -q "^${mime}=" /etc/xdg/mimeapps.list; then
            sed -i "s|^${mime}=.*|${mime}=vexview.desktop;|" /etc/xdg/mimeapps.list
        else
            sed -i "/\[Default Applications\]/a ${mime}=vexview.desktop;" /etc/xdg/mimeapps.list
        fi
    done

    # 2. System-wide legacy defaults in /usr/share/applications/defaults.list
    if [ -f /usr/share/applications/defaults.list ]; then
        for mime in $MIMES; do
            if grep -q "^${mime}=" /usr/share/applications/defaults.list; then
                sed -i "s|^${mime}=.*|${mime}=vexview.desktop;|" /usr/share/applications/defaults.list
            else
                echo "${mime}=vexview.desktop;" >> /usr/share/applications/defaults.list
            fi
        done
    fi

    # 3. User-level defaults for active user and all real home directories
    USERS=""
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
        USERS="$SUDO_USER"
    fi
    for d in /home/*; do
        if [ -d "$d" ]; then
            u=$(basename "$d")
            if [ "$u" != "lost+found" ] && id "$u" >/dev/null 2>&1; then
                case " $USERS " in
                    *" $u "*) ;;
                    *) USERS="$USERS $u" ;;
                esac
            fi
        fi
    done

    for u in $USERS; do
        UHOME=$(getent passwd "$u" | cut -d: -f6)
        if [ -d "$UHOME/.config" ]; then
            UMIME="$UHOME/.config/mimeapps.list"
            if [ ! -f "$UMIME" ]; then
                echo "[Default Applications]" > "$UMIME"
                chown "$u:$u" "$UMIME" 2>/dev/null || true
            elif ! grep -q "\[Default Applications\]" "$UMIME"; then
                printf "\n[Default Applications]\n" >> "$UMIME"
            fi
            for mime in $MIMES; do
                if grep -q "^${mime}=" "$UMIME"; then
                    sed -i "s|^${mime}=.*|${mime}=vexview.desktop;|" "$UMIME"
                else
                    sed -i "/\[Default Applications\]/a ${mime}=vexview.desktop;" "$UMIME"
                fi
            done
            chown "$u:$u" "$UMIME" 2>/dev/null || true
        fi

        # Register in user's active desktop session if utilities are present
        if which xdg-mime >/dev/null 2>&1; then
            su - "$u" -c "xdg-mime default vexview.desktop $MIMES" 2>/dev/null || true
        fi
        if which gio >/dev/null 2>&1; then
            for mime in $MIMES; do
                su - "$u" -c "gio mime $mime vexview.desktop" 2>/dev/null || true
            done
        fi
    done
fi

exit 0
EOF
chmod 755 "${BUILD_ROOT}/DEBIAN/postinst"

# Post-removal script
cat <<'EOF' > "${BUILD_ROOT}/DEBIAN/postrm"
#!/bin/sh
set -e

if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    if which update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q /usr/share/applications || true
    fi
    if which update-mime-database >/dev/null 2>&1; then
        update-mime-database /usr/share/mime || true
    fi
    if which gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
    fi
fi

exit 0
EOF
chmod 755 "${BUILD_ROOT}/DEBIAN/postrm"

dpkg-deb --build --root-owner-group "${BUILD_ROOT}" "${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
echo "==> Successfully created: ${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
