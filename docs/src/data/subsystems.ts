export interface Subsystem {
  id: string;
  name: string;
  domain: 'decoding' | 'trimming' | 'rendering' | 'windowing';
  tierLabel: string;
  category: string;
  status: string;
  statusTone: 'emerald' | 'cyan' | 'amber' | 'indigo' | 'purple';
  tagline: string;
  metric: string;
  metricDetail: string;
  description: string;
  highlights: string[];
  tags: string[];
  docSectionId: string;
  architectureDetails: {
    pipelineDiagram: string;
    tradeoffs: { choice: string; why: string }[];
    codeSnippet: {
      language: string;
      title: string;
      code: string;
    };
  };
}

export const VEXVIEW_SUBSYSTEMS: Subsystem[] = [
  {
    id: 'hardware_video_decoding',
    name: 'Hardware Video Decoding Pipeline',
    domain: 'decoding',
    tierLabel: 'TIER 1 // VA-API / NVDEC',
    category: 'Hardware Acceleration',
    status: 'ACTIVE',
    statusTone: 'cyan',
    tagline: 'Zero-copy VA-API and NVDEC video decode pipeline with direct Wayland DMA-BUF presentation.',
    metric: '60+ FPS',
    metricDetail: 'Hardware 4K/8K Jitter-Free Playback Throughput at <3% CPU Overhead',
    description: 'Hardware-accelerated video decoding engine offloading MP4, MKV, and WebM streams directly to the GPU via VA-API and NVDEC, eliminating frame drops and high CPU usage.',
    highlights: [
      'Zero-copy DMA-BUF texture sharing with X11 and Wayland compositors',
      'Hardware de-interlacing and color space conversion matrix',
      'Frame-accurate seeking with bidirectional scrubbing cache'
    ],
    tags: ['VA-API', 'NVDEC', 'Zero-Copy', 'DMA-BUF', '4K 60FPS'],
    docSectionId: 'video_pipeline',
    architectureDetails: {
      pipelineDiagram: `Raw Encoded Stream (H.264 / HEVC / AV1 / VP9)
           │
           ▼
[Hardware Parser & Demuxer] ── Packet Extraction & PTS Alignment
           │
           ▼
[GPU Hardware Decoder] ── Zero-Copy Surface Allocation (VA-API / NVDEC)
           │
           ▼
[Wayland DMA-BUF Presenter] ── Sub-Millisecond Display Surface`,
      tradeoffs: [
        { choice: 'GPU Hardware DMA-BUF vs CPU Software Decoding', why: 'Reduces CPU consumption from 45% down to <3% and eliminates thermal throttling on laptops.' },
        { choice: 'Direct Wayland Subsurfaces vs GL Copy-back', why: 'Avoids redundant RAM-to-VRAM round-trips, ensuring zero frame tearing.' }
      ],
      codeSnippet: {
        language: 'rust',
        title: 'Hardware VA-API Surface Presentation',
        code: `pub fn present_hardware_frame(surface: &VaSurface, dmabuf: &DmaBufHandler) -> Result<(), VexError> {
    let prime_fd = surface.export_prime_fd()?;
    dmabuf.import_texture_zero_copy(prime_fd, surface.width(), surface.height())?;
    Ok(())
}`
      }
    }
  },
  {
    id: 'lossless_stream_trimmer',
    name: 'Lossless Bitstream Stream Trimmer',
    domain: 'trimming',
    tierLabel: 'TIER 1 // BITSTREAM FILTER',
    category: 'Lossless Editing',
    status: 'ACTIVE',
    statusTone: 'cyan',
    tagline: 'Instant video cutting without re-encoding, preserving exact original master fidelity.',
    metric: '0 Loss',
    metricDetail: 'Direct Stream Copy Slicing with Sub-500ms Export Latency',
    description: 'Direct bitstream copy engine that slices video and audio packet streams without GPU recompression, generating frame-accurate sub-clips in milliseconds with 0% generational quality loss.',
    highlights: [
      'Keyframe-aligned slicing preserving audio and video PTS timestamps',
      'Instant container remuxing with multi-track audio preservation',
      'Interactive timeline scrub-bar with keyboard hotkey trim markers (I / O)'
    ],
    tags: ['Direct Stream Copy', 'Zero Recompression', 'Keyframe Seeking', 'Sub-Second Export'],
    docSectionId: 'lossless_trimming',
    architectureDetails: {
      pipelineDiagram: `Input Container Stream (MP4 / MKV / WebM)
           │
           ▼
[Keyframe Index & Bitstream Parser] ── Locate Exact In/Out Packet Bounds
           │
           ▼
[Packet Muxer & Remux Filter] ── Packet Passthrough (No Encoding)
           │
           ▼
[Exported Output File] ── Instant Lossless Sub-Clip Created`,
      tradeoffs: [
        { choice: 'Direct Bitstream Copy vs NLE Re-encoding', why: 'Eliminates 10-minute rendering delays and avoids recompression artifacts completely.' },
        { choice: 'Keyframe Boundary Snap vs Forced Re-encode', why: 'Guarantees master-level output quality without requiring GPU encoder sessions.' }
      ],
      codeSnippet: {
        language: 'rust',
        title: 'Lossless Bitstream Slicing Loop',
        code: `pub fn trim_lossless(input: &str, output: &str, start_pts: i64, end_pts: i64) -> Result<(), VexError> {
    let mut demuxer = Demuxer::open(input)?;
    let mut muxer = Muxer::create(output, demuxer.streams())?;
    while let Some(packet) = demuxer.read_packet()? {
        if packet.pts >= start_pts && packet.pts <= end_pts {
            muxer.write_packet_lossless(packet)?;
        }
    }
    muxer.finish()
}`
      }
    }
  },
  {
    id: 'high_bitdepth_engine',
    name: 'High-Bitdepth RAW & HDR Engine',
    domain: 'rendering',
    tierLabel: 'TIER 2 // COLOR PIPELINE',
    category: 'Color Space & Rendering',
    status: 'ACTIVE',
    statusTone: 'cyan',
    tagline: 'Deep 16-bit color gamut mapping with sub-millisecond raster and vector rendering.',
    metric: '16-bit',
    metricDetail: 'Internal Color Precision with sRGB, P3, and Rec.2020 Color Space Mapping',
    description: 'Universal raster and vector rendering core supporting 16-bit PNG, AVIF, WebP, JPEG-XL, SVG, and RAW formats with smooth bilinear zooming, split comparison, and non-destructive exposure adjustments.',
    highlights: [
      'Wide color gamut sRGB, Display P3, and Adobe RGB color profiles',
      'Vector SVG rendering with dynamic tessellation and crisp zoom',
      'Non-destructive image adjustments (exposure, saturation, rotation)'
    ],
    tags: ['16-bit HDR', 'Display P3', 'AVIF / WebP / SVG', 'Bilinear Zoom'],
    docSectionId: 'color_pipeline',
    architectureDetails: {
      pipelineDiagram: `Raw Image File (PNG / AVIF / JPEG-XL / SVG)
           │
           ▼
[Asynchronous Image Decoder] ── 16-bit Linear Color Matrix
           │
           ▼
[Color Space Transform] ── sRGB / Display P3 Tone Mapping
           │
           ▼
[Interactive Zoom Viewport] ── 60 FPS Pan & Inspection`,
      tradeoffs: [
        { choice: '16-bit Linear Pipeline vs 8-bit Clamping', why: 'Preserves shadow and highlight details for scientific and photography inspection.' },
        { choice: 'GPU Tile Texture vs Full Raster in RAM', why: 'Allows fluid panning of 100+ megapixel images with under 50MB RAM.' }
      ],
      codeSnippet: {
        language: 'rust',
        title: 'Color Gamut Mapping Kernel',
        code: `pub fn apply_color_profile(rgb: [f32; 3], profile: ColorProfile) -> [f32; 3] {
    let linear = to_linear_srgb(rgb);
    profile.matrix.transform(linear)
}`
      }
    }
  },
  {
    id: 'minimalist_desktop_shell',
    name: 'Minimalist Linux Desktop Shell',
    domain: 'windowing',
    tierLabel: 'TIER 2 // DESKTOP SYSTEM',
    category: 'System Integration',
    status: 'ACTIVE',
    statusTone: 'cyan',
    tagline: 'Zero-bloat native Linux application with MPRIS media keys and Wayland support.',
    metric: '<6.1 MB',
    metricDetail: 'Universal AppImage Size with Sub-28MB Idle Process Memory',
    description: 'Lightweight desktop application shell designed specifically for Linux environments. Features Wayland fractional scaling, MPRIS media key bindings, MIME associations, and zero telemetry.',
    highlights: [
      'Native Wayland subsurfaces and fractional scaling support',
      'MPRIS v2 D-Bus interface for hardware media keys and desktop notifications',
      'MIME type associations for all major image and video extensions'
    ],
    tags: ['Wayland / X11', 'MPRIS D-Bus', '<6.1MB AppImage', 'Zero Telemetry'],
    docSectionId: 'desktop_shell',
    architectureDetails: {
      pipelineDiagram: `Linux Desktop Environment (GNOME / KDE / Sway / Hyprland)
           │
           ▼
[Wayland / X11 Compositor] ── Window Surface Creation
           │
           ▼
[Vexview Rust Engine] ── D-Bus MPRIS & File Descriptor Integration
           │
           ▼
[Standalone Application Executable] ── Zero Background Daemon`,
      tradeoffs: [
        { choice: 'Standalone Native Shell vs Heavy Electron Runtime', why: 'Reduces binary size from 180MB to 6MB and saves 200MB idle RAM.' },
        { choice: 'Pure Safe Rust & C-ABI vs Python/JS Scripting', why: 'Guarantees sub-20ms cold startup and eliminates runtime dependency crashes.' }
      ],
      codeSnippet: {
        language: 'rust',
        title: 'D-Bus MPRIS v2 Event Handler',
        code: `pub fn handle_mpris_event(cmd: MprisCommand) {
    match cmd {
        MprisCommand::PlayPause => toggle_playback(),
        MprisCommand::Next => seek_relative(5.0),
        MprisCommand::Previous => seek_relative(-5.0),
    }
}`
      }
    }
  }
];
