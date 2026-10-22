export interface DocSectionContent {
  title: string;
  badge: string;
  description: string;
  configJson?: string;
  rustCode?: string;
  tsCode?: string;
  callout?: {
    type: 'note' | 'tip' | 'warning' | 'spec';
    title: string;
    text: string;
  };
  specs?: { param: string; val: string; note: string }[];
  steps?: { title: string; desc: string; cmd?: string }[];
}

export interface DocSection {
  id: string;
  title: string;
  badge: string;
  content: DocSectionContent;
}

export interface DocCategory {
  id: string;
  title: string;
  badge: string;
  sections: DocSection[];
}

export const VEXVIEW_DOC_TREE: DocCategory[] = [
  {
    id: 'getting_started',
    title: '1. Getting Started',
    badge: 'CORE',
    sections: [
      {
        id: 'why_vexview',
        title: 'Why Vexview',
        badge: 'OVERVIEW',
        content: {
          title: 'Modern Minimalist Media Inspector & Lossless Trimmer',
          badge: 'ARCHITECTURE',
          description: 'Vexview is an industrial-grade image and video inspection desktop application designed specifically for Linux. It combines instant raster and vector image rendering with hardware-accelerated video playback and zero-recompression stream trimming in a lightweight <6.1MB bundle with zero telemetry.',
          callout: {
            type: 'spec',
            title: 'Zero Recompression & Zero Telemetry',
            text: 'Vexview operates entirely offline with zero background tracking or network phone-home daemons. Video trimming operates at the bitstream packet level, guaranteeing 100% loss-free master preservation.'
          },
          specs: [
            { param: 'Standalone AppImage Size', val: '<6.1 MB', note: 'Self-contained executable with embedded codecs' },
            { param: 'Idle Process Memory', val: '<28 MB', note: 'Compared to 150MB+ for VLC and Shotcut' },
            { param: 'Cold Launch Latency', val: '<20 ms', note: 'Instant native window initialization' },
            { param: 'Trimming Latency', val: '<500 ms', note: 'Direct packet stream copy without re-encoding' }
          ],
          steps: [
            { title: 'Download Binary', desc: 'Download the universal AppImage or install via the single-line script', cmd: 'curl -sSL https://raw.githubusercontent.com/aerovexhq/vexview/main/install.sh | bash' },
            { title: 'Launch on File', desc: 'Open any image or video file directly from the terminal or file manager', cmd: 'vexview video.mp4' },
            { title: 'Inspect & Trim', desc: 'Press I to mark in-point, O to mark out-point, and Ctrl+S to export the lossless sub-clip instantly.' }
          ]
        }
      },
      {
        id: 'installation',
        title: 'Installation & Packages',
        badge: 'SETUP',
        content: {
          title: 'Linux Distribution Packages & Binaries',
          badge: 'DEPLOYMENT',
          description: 'Vexview is packaged in three official formats: Universal Linux AppImage (runs on all modern x86_64 distributions), Debian/Ubuntu package (.deb) with desktop file and MIME type associations, and portable tarball (.tar.gz).',
          callout: {
            type: 'tip',
            title: 'Non-Root Execution',
            text: 'The AppImage and portable tarball can be executed completely without root privileges: chmod +x vexview_0.1.0_amd64.AppImage && ./vexview_0.1.0_amd64.AppImage'
          },
          steps: [
            { title: 'Ubuntu / Debian (.deb)', desc: 'Install via dpkg with automatic desktop entry generation', cmd: 'sudo dpkg -i vexview_0.1.0_amd64.deb' },
            { title: 'Universal AppImage', desc: 'Make executable and launch anywhere', cmd: 'chmod +x vexview_0.1.0_amd64.AppImage && ./vexview_0.1.0_amd64.AppImage' },
            { title: 'Portable Tarball', desc: 'Extract anywhere and execute standalone', cmd: 'tar -xzf vexview-0.1.0-linux-x86_64.tar.gz && ./vexview/vexview' }
          ]
        }
      }
    ]
  },
  {
    id: 'engines',
    title: '2. Core Subsystems',
    badge: 'SYSTEMS',
    sections: [
      {
        id: 'video_pipeline',
        title: 'Hardware Video Pipeline',
        badge: 'GPU',
        content: {
          title: 'Zero-Copy VA-API & NVDEC Hardware Decoding',
          badge: 'HARDWARE',
          description: 'Vexview delegates video decoding directly to GPU silicon via VA-API and NVDEC. Video surfaces are maintained in GPU VRAM and shared with Wayland compositors via zero-copy DMA-BUF file descriptors.',
          specs: [
            { param: 'Hardware Decoders', val: 'VA-API, NVDEC, VDPAU', note: 'Automatic detection with CPU fallback' },
            { param: 'Color Conversions', val: 'GPU Shader Matrix', note: 'YUV420P to RGB color conversion in hardware' },
            { param: 'Max Resolution', val: '8K (7680x4320) @ 60FPS', note: 'Tested on AMD Radeon, Intel Iris, and NVIDIA RTX' }
          ]
        }
      },
      {
        id: 'lossless_trimming',
        title: 'Lossless Stream Trimming',
        badge: 'REPACKING',
        content: {
          title: 'Direct Bitstream Packet Slicing',
          badge: 'BITSTREAM',
          description: 'Unlike video editors that decode and recompress footage (causing generational quality loss and high export delays), Vexview copies encoded packets directly from source container to destination container.',
          callout: {
            type: 'spec',
            title: 'Bitstream Passthrough Guarantee',
            text: 'Every video frame between the selected bounds is transferred bit-for-bit without touching a video encoder, guaranteeing zero degradation and instant export.'
          }
        }
      },
      {
        id: 'color_pipeline',
        title: 'RAW & High-Bitdepth Engine',
        badge: 'COLOR',
        content: {
          title: '16-bit Precision & Wide Color Gamut',
          badge: 'COLOR_MANAGEMENT',
          description: 'Full support for high-dynamic-range and professional photography files: 16-bit PNG, AVIF, WebP, JPEG-XL, and SVG vector graphics with sRGB, Display P3, and Adobe RGB color profiles.'
        }
      },
      {
        id: 'desktop_shell',
        title: 'Keyboard Shortcuts & CLI',
        badge: 'ERGONOMICS',
        content: {
          title: 'Hotkeys, Media Keys & CLI Workflows',
          badge: 'CONTROL',
          description: 'Vexview is designed for power users with comprehensive keyboard bindings: Space (Play/Pause), I (Set Trim In-Point), O (Set Trim Out-Point), Ctrl+S (Export Lossless Trim), Left/Right (Frame Step), +/- (Zoom), F (Toggle Fullscreen).'
        }
      }
    ]
  }
];
