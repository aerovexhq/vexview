use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct CliArgs {
    pub targets: Vec<String>,
    pub edit: bool,
    pub fullscreen: bool,
    pub slideshow: bool,
    pub info: bool,
    pub convert: Option<String>,
    pub quality: Option<u8>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub completions: Option<String>,
    pub help: bool,
    pub version: bool,
    pub daemon: bool,
    pub quit: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CliLaunchOptions {
    pub target: Option<String>,
    pub targets: Vec<String>,
    pub edit: bool,
    pub fullscreen: bool,
    pub slideshow: bool,
}

impl CliArgs {
    pub fn to_launch_options(&self) -> CliLaunchOptions {
        CliLaunchOptions {
            target: self.targets.first().cloned(),
            targets: self.targets.clone(),
            edit: self.edit,
            fullscreen: self.fullscreen,
            slideshow: self.slideshow,
        }
    }
}

pub fn parse_args<I: IntoIterator<Item = String>>(args: I) -> CliArgs {
    let mut parsed = CliArgs::default();
    let mut iter = args.into_iter().skip(1).peekable();
    let mut positional_only = false;

    while let Some(arg) = iter.next() {
        if positional_only {
            parsed.targets.push(arg);
            continue;
        }

        if arg == "--" {
            positional_only = true;
            continue;
        }

        if arg == "-h" || arg == "--help" {
            parsed.help = true;
        } else if arg == "-V" || arg == "--version" {
            parsed.version = true;
        } else if arg == "-d" || arg == "--daemon" || arg == "--background" {
            parsed.daemon = true;
        } else if arg == "--quit" {
            parsed.quit = true;
        } else if arg == "-e" || arg == "--edit" {
            parsed.edit = true;
        } else if arg == "-f" || arg == "--fullscreen" {
            parsed.fullscreen = true;
        } else if arg == "-s" || arg == "--slideshow" {
            parsed.slideshow = true;
        } else if arg == "-i" || arg == "--info" {
            parsed.info = true;
        } else if arg == "-c" || arg == "--convert" {
            if let Some(next_arg) = iter.peek() {
                if !next_arg.starts_with('-') {
                    parsed.convert = Some(iter.next().unwrap());
                }
            }
        } else if let Some(val) = arg.strip_prefix("--convert=") {
            parsed.convert = Some(val.to_string());
        } else if arg == "-q" || arg == "--quality" {
            if let Some(next_arg) = iter.next() {
                if let Ok(q) = next_arg.parse::<u8>() {
                    parsed.quality = Some(q);
                }
            }
        } else if let Some(val) = arg.strip_prefix("--quality=") {
            if let Ok(q) = val.parse::<u8>() {
                parsed.quality = Some(q);
            }
        } else if arg == "--width" {
            if let Some(next_arg) = iter.next() {
                if let Ok(w) = next_arg.parse::<u32>() {
                    parsed.width = Some(w);
                }
            }
        } else if let Some(val) = arg.strip_prefix("--width=") {
            if let Ok(w) = val.parse::<u32>() {
                parsed.width = Some(w);
            }
        } else if arg == "--height" {
            if let Some(next_arg) = iter.next() {
                if let Ok(h) = next_arg.parse::<u32>() {
                    parsed.height = Some(h);
                }
            }
        } else if let Some(val) = arg.strip_prefix("--height=") {
            if let Ok(h) = val.parse::<u32>() {
                parsed.height = Some(h);
            }
        } else if arg == "--completions" || arg == "--completion" {
            if let Some(next_arg) = iter.next() {
                parsed.completions = Some(next_arg.to_lowercase());
            }
        } else if let Some(val) = arg.strip_prefix("--completions=") {
            parsed.completions = Some(val.to_lowercase());
        } else if let Some(val) = arg.strip_prefix("--completion=") {
            parsed.completions = Some(val.to_lowercase());
        } else if !arg.starts_with('-') {
            parsed.targets.push(arg);
        }
    }

    parsed
}

pub fn print_help() {
    println!(
        "vexview 0.1.0\n\
        Modern and minimalistic media viewer and editor for Linux\n\n\
        USAGE:\n    \
            vexview [OPTIONS] [PATH...]\n\n\
        ARGUMENTS:\n    \
            [PATH...]                  File or folder path to open (image or video)\n\n\
        OPTIONS:\n    \
            -d, --daemon               Run as persistent background pre-warming service\n    \
                --quit                 Terminate running background service\n    \
            -e, --edit                 Open directly in edit and annotation mode\n    \
            -f, --fullscreen           Launch application in fullscreen mode\n    \
            -s, --slideshow            Start slideshow mode immediately\n    \
            -i, --info                 Inspect media metadata in terminal and exit\n    \
            -c, --convert <OUTPUT>     Convert input image to output format headlessly\n    \
            -q, --quality <1-100>      Output compression quality (default: 90)\n        \
                --width <PIXELS>       Target width in pixels for resize\n        \
                --height <PIXELS>      Target height in pixels for resize\n        \
                --completions <SHELL>  Generate shell completion (bash, zsh, fish, powershell)\n    \
            -h, --help                 Print help information\n    \
            -V, --version              Print version information\n\n\
        EXAMPLES:\n    \
            vexview image.png                          Open image\n    \
            vexview video.mp4                          Open and inspect video\n    \
            vexview ~/Pictures                         Browse directory\n    \
            vexview -e diagram.png                     Open directly in edit mode\n    \
            vexview -f presentation.png                Open in fullscreen\n    \
            vexview -i photo.jpg                       Inspect EXIF & resolution in CLI\n    \
            vexview photo.png -c photo.webp            Convert PNG to WebP\n    \
            vexview photo.png -c thumb.jpg -q 85 --width 400\n    \
            vexview --completions bash > ~/.local/share/bash-completion/completions/vexview\n\n\
        SUPPORTED FORMATS:\n    \
            Images: PNG, JPEG, WebP, AVIF, SVG, GIF, BMP, ICO, TIFF\n    \
            Videos: MP4, MKV, WebM, MOV, AVI"
    );
}

pub fn print_version() {
    println!("vexview 0.1.0");
}

pub fn generate_completions(shell: &str) -> Result<String, String> {
    match shell.trim().to_lowercase().as_str() {
        "bash" => Ok(BASH_COMPLETION.to_string()),
        "zsh" => Ok(ZSH_COMPLETION.to_string()),
        "fish" => Ok(FISH_COMPLETION.to_string()),
        "powershell" | "pwsh" => Ok(POWERSHELL_COMPLETION.to_string()),
        other => Err(format!(
            "Unsupported shell: '{}'. Supported shells: bash, zsh, fish, powershell",
            other
        )),
    }
}

pub fn execute_info(target_path: &str) -> Result<(), String> {
    let path = Path::new(target_path);
    if !path.exists() {
        return Err(format!("File not found: {}", target_path));
    }

    let metadata = path
        .metadata()
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();
    let size_str = format_file_size(file_size);

    let media_type = vex_core::detect_media_type(path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "UNKNOWN".to_string());

    println!("Media Metadata Inspector");
    println!("--------------------------------------------------");
    println!("File:         {}", path.display());
    println!("File Size:    {} ({} bytes)", size_str, file_size);
    println!("Format:       {}", ext);

    match media_type {
        vex_core::MediaType::Video => {
            println!("Type:         Video Stream");
            if let Some(video_meta) = vex_video::probe_video(path) {
                let duration_formatted = format_duration(video_meta.duration_seconds);
                println!(
                    "Duration:     {} ({:.2}s)",
                    duration_formatted, video_meta.duration_seconds
                );
                if video_meta.width > 0 && video_meta.height > 0 {
                    let aspect = format_aspect_ratio(video_meta.width, video_meta.height);
                    println!(
                        "Resolution:   {}x{} ({})",
                        video_meta.width, video_meta.height, aspect
                    );
                }
                if let Some(v_codec) = video_meta.video_codec {
                    println!("Video Codec:  {}", v_codec);
                }
                if let Some(fps) = video_meta.frame_rate {
                    println!("Frame Rate:   {:.2} fps", fps);
                }
                if let Some(a_codec) = video_meta.audio_codec {
                    println!("Audio Codec:  {}", a_codec);
                }
                if let Some(br) = video_meta.bit_rate {
                    println!("Bitrate:      {} kb/s", br / 1000);
                }
            } else {
                println!("Notice:       ffprobe not found or format probe failed.");
            }
        }
        vex_core::MediaType::Audio => {
            println!("Type:         Audio File");
            if let Some(audio_meta) = vex_video::probe_audio(path) {
                let duration_formatted = format_duration(audio_meta.duration_seconds);
                println!(
                    "Duration:     {} ({:.2}s)",
                    duration_formatted, audio_meta.duration_seconds
                );
                if let Some(codec) = audio_meta.audio_codec {
                    println!("Audio Codec:  {}", codec);
                }
                if let Some(rate) = audio_meta.sample_rate {
                    println!("Sample Rate:  {} Hz", rate);
                }
                if let Some(ch) = audio_meta.channels {
                    println!("Channels:     {}", ch);
                }
                if let Some(br) = audio_meta.bit_rate {
                    println!("Bitrate:      {} kb/s", br / 1000);
                }
                if let Some(title) = audio_meta.title {
                    println!("Track Title:  {}", title);
                }
                if let Some(artist) = audio_meta.artist {
                    println!("Artist:       {}", artist);
                }
                if let Some(album) = audio_meta.album {
                    println!("Album:        {}", album);
                }
            } else {
                println!("Notice:       ffprobe not found or audio probe failed.");
            }
        }
        vex_core::MediaType::Svg => {
            println!("Type:         Scalable Vector Graphics (SVG)");
        }
        vex_core::MediaType::AnimatedImage | vex_core::MediaType::Image => {
            let is_anim = media_type == vex_core::MediaType::AnimatedImage;
            println!(
                "Type:         {}",
                if is_anim {
                    "Animated Image"
                } else {
                    "Raster Image"
                }
            );

            // Read dimensions
            if let Ok((w, h)) = image::image_dimensions(path) {
                let aspect = format_aspect_ratio(w, h);
                println!("Dimensions:   {}x{} ({})", w, h, aspect);

                let exif = vex_image::extract_metadata(path, w, h);
                if let Some(make) = exif.make {
                    println!("Camera Make:  {}", make);
                }
                if let Some(model) = exif.model {
                    println!("Camera Model: {}", model);
                }
                if let Some(dt) = exif.date_time {
                    println!("Timestamp:    {}", dt);
                }
                if let Some(exp) = exif.exposure_time {
                    println!("Exposure:     {}", exp);
                }
                if let Some(f) = exif.f_number {
                    println!("Aperture:     {}", f);
                }
                if let Some(iso) = exif.iso {
                    println!("ISO Speed:    {}", iso);
                }
            } else {
                println!("Notice:       Could not read image dimensions.");
            }
        }
        _ => {
            println!("Type:         Unknown Media Format");
        }
    }
    println!("--------------------------------------------------");
    Ok(())
}

pub fn execute_convert(
    input_path: &str,
    output_path: &str,
    quality: Option<u8>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<(), String> {
    let in_ref = Path::new(input_path);
    if !in_ref.exists() {
        return Err(format!("Input file not found: {}", input_path));
    }

    let out_ref = Path::new(output_path);
    let out_ext = out_ref
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let in_media = vex_core::MediaType::from_path(in_ref);
    let is_audio_target = matches!(
        out_ext.as_str(),
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "oga" | "m4a" | "opus" | "wma" | "aiff"
    );

    if in_media.is_audio() || in_media.is_video() || is_audio_target {
        let bitrate_val = quality.map(|q| format!("{}k", (q as u32 * 320) / 100));
        vex_video::convert_audio(in_ref, out_ref, &out_ext, bitrate_val.as_deref(), None)
            .map_err(|e| format!("Audio/Video conversion failed: {}", e))?;
    } else {
        let target_format = vex_edit::ExportFormat::from_ext_or_name(&out_ext);
        vex_edit::convert_image_file(in_ref, out_ref, target_format, width, height, quality)
            .map_err(|e| format!("Conversion failed: {}", e))?;
    }

    let in_size = in_ref.metadata().map(|m| m.len()).unwrap_or(0);
    let out_size = out_ref.metadata().map(|m| m.len()).unwrap_or(0);

    println!(
        "Successfully converted:\n  Source:      {} ({})\n  Destination: {} ({})",
        input_path,
        format_file_size(in_size),
        output_path,
        format_file_size(out_size)
    );

    Ok(())
}

fn format_file_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * 1024;
    const GB: u64 = 1024 * 1024 * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn format_duration(seconds: f64) -> String {
    let s = seconds.max(0.0) as u64;
    let hours = s / 3600;
    let mins = (s % 3600) / 60;
    let secs = s % 60;
    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, mins, secs)
    } else {
        format!("{:02}:{:02}", mins, secs)
    }
}

fn format_aspect_ratio(width: u32, height: u32) -> String {
    if width == 0 || height == 0 {
        return "1:1".to_string();
    }
    let gcd_val = gcd(width, height);
    let rw = width / gcd_val;
    let rh = height / gcd_val;
    if (rw == 16 && rh == 9) || (rw == 4 && rh == 3) || (rw == 1 && rh == 1) || (rw == 21 && rh == 9) {
        format!("{}:{}", rw, rh)
    } else {
        format!("{:.2}:1", width as f64 / height as f64)
    }
}

fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

pub const BASH_COMPLETION: &str = r#"# bash completion for vexview
_vexview() {
    shopt -s extglob 2>/dev/null
    local cur prev
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    local opts="-h --help -V --version -e --edit -f --fullscreen -s --slideshow -i --info -c --convert -q --quality --width --height --completions"

    case "${prev}" in
        --completions|--completion)
            COMPREPLY=( $(compgen -W "bash zsh fish powershell" -- "${cur}") )
            return 0
            ;;
        -q|--quality)
            COMPREPLY=( $(compgen -W "100 95 90 85 80 75 50" -- "${cur}") )
            return 0
            ;;
        --width|--height)
            COMPREPLY=( $(compgen -W "1920 1280 1080 800 640 512 256 128" -- "${cur}") )
            return 0
            ;;
        -c|--convert)
            if declare -F _filedir >/dev/null 2>&1; then
                _filedir
            else
                COMPREPLY=( $(compgen -f -- "${cur}") )
            fi
            return 0
            ;;
    esac

    if [[ "${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
        return 0
    fi

    local media_pattern="*.@(png|jpg|jpeg|webp|svg|gif|bmp|avif|tiff|ico|mp4|mkv|webm|mov|avi|flv|wmv|PNG|JPG|JPEG|WEBP|SVG|GIF|BMP|AVIF|TIFF|ICO|MP4|MKV|WEBM|MOV|AVI)"

    if declare -F _filedir >/dev/null 2>&1; then
        local media_exts="png|jpg|jpeg|webp|svg|gif|bmp|avif|tiff|ico|mp4|mkv|webm|mov|avi|PNG|JPG|JPEG|WEBP|SVG|GIF|BMP|AVIF|TIFF|ICO|MP4|MKV|WEBM|MOV|AVI"
        _filedir "@(${media_exts})"
    else
        local files dirs
        files=$(compgen -f -X "!${media_pattern}" -- "${cur}")
        dirs=$(compgen -d -S / -- "${cur}")
        COMPREPLY=( ${files} ${dirs} )
    fi
}
complete -F _vexview vexview
"#;

pub const ZSH_COMPLETION: &str = r#"#compdef vexview

_vexview() {
    local -a media_files
    media_files=(
        '*:media file:_files -g "*.(#i)(png|jpg|jpeg|webp|svg|gif|bmp|avif|tiff|ico|mp4|mkv|webm|mov|avi|flv|wmv)(-.)"'
    )

    _arguments -s -S \
        '(-h --help)'{-h,--help}'[Print help information]' \
        '(-V --version)'{-V,--version}'[Print version information]' \
        '(-e --edit)'{-e,--edit}'[Open directly in edit and annotation mode]' \
        '(-f --fullscreen)'{-f,--fullscreen}'[Launch application in fullscreen mode]' \
        '(-s --slideshow)'{-s,--slideshow}'[Start slideshow mode immediately]' \
        '(-i --info)'{-i,--info}'[Inspect media metadata in terminal and exit]' \
        '(-c --convert)'{-c,--convert}'[Convert input image to output format]:output file:_files' \
        '(-q --quality)'{-q,--quality}'[Compression quality (1-100)]:quality:(100 95 90 85 80 75 50)' \
        '--width[Target width in pixels for resize]:width:(1920 1280 1080 800 640 512 256 128)' \
        '--height[Target height in pixels for resize]:height:(1920 1280 1080 800 640 512 256 128)' \
        '--completions[Generate shell completion script]:shell:(bash zsh fish powershell)' \
        $media_files
}

_vexview "$@"
"#;

pub const FISH_COMPLETION: &str = r#"# fish completion for vexview

complete -c vexview -s h -l help -d "Print help information"
complete -c vexview -s V -l version -d "Print version information"
complete -c vexview -s e -l edit -d "Open directly in edit mode"
complete -c vexview -s f -l fullscreen -d "Launch in fullscreen mode"
complete -c vexview -s s -l slideshow -d "Start slideshow mode immediately"
complete -c vexview -s i -l info -d "Inspect media metadata in terminal and exit"
complete -c vexview -s c -l convert -r -d "Convert input image to output format"
complete -c vexview -s q -l quality -x -a "100 95 90 85 80 75 50" -d "Compression quality (1-100)"
complete -c vexview -l width -x -d "Target width in pixels"
complete -c vexview -l height -x -d "Target height in pixels"
complete -c vexview -l completions -x -a "bash zsh fish powershell" -d "Generate shell completion script"

complete -c vexview -k -a "(__fish_complete_suffix .png .jpg .jpeg .webp .svg .gif .bmp .avif .tiff .ico .mp4 .mkv .webm .mov .avi)"
"#;

pub const POWERSHELL_COMPLETION: &str = r#"# PowerShell completion for vexview
Register-ArgumentCompleter -Native -CommandName vexview -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $options = @('-h', '--help', '-V', '--version', '-e', '--edit', '-f', '--fullscreen', '-s', '--slideshow', '-i', '--info', '-c', '--convert', '-q', '--quality', '--width', '--height', '--completions')
    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
    }
}
"#;
