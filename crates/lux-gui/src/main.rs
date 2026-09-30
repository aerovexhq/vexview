use std::env;
use std::path::{Path, PathBuf};

fn main() -> anyhow::Result<()> {
    env_logger::init();

    let args: Vec<String> = env::args().collect();
    println!("luxviewer v0.1.0 - Modern & Minimalistic Image & Video Viewer for Linux");

    if args.len() < 2 || args[1] == "--help" || args[1] == "-h" {
        print_usage();
        return Ok(());
    }

    let target_path = PathBuf::from(&args[1]);
    if !target_path.exists() {
        eprintln!("Error: Path '{}' does not exist.", target_path.display());
        std::process::exit(1);
    }

    #[cfg(feature = "gtk")]
    {
        println!(
            "Launching GTK4/Libadwaita GUI for: {}",
            target_path.display()
        );
        run_gtk_app(&target_path)?;
    }

    #[cfg(not(feature = "gtk"))]
    {
        inspect_media(&target_path);
    }

    Ok(())
}

fn print_usage() {
    println!("\nUsage:");
    println!("  luxviewer <path-to-media-or-directory>");
    println!("  luxviewer --help\n");
    println!("Supported Formats:");
    println!("  Images: PNG, JPEG, WebP, AVIF, SVG, GIF, BMP, ICO, TIFF");
    println!("  Videos: MP4, MKV, WebM, AVI, MOV, FLV, WMV\n");
}

fn inspect_media(path: &Path) {
    let parent = if path.is_dir() {
        path
    } else {
        path.parent().unwrap_or_else(|| Path::new("."))
    };

    println!("\nScanning directory: {}", parent.display());
    let items = lux_core::scan_directory(parent, lux_core::ScanFilter::AllMedia);
    println!("Found {} media items in directory.", items.len());

    if path.is_file() {
        let media_type = lux_core::detect_media_type(path);
        println!("\nTarget: {}", path.display());
        println!("Detected Media Type: {:?}", media_type);

        if media_type.is_image() {
            println!("Loading image data...");
            match lux_image::load_image(path) {
                Ok(loaded) => {
                    println!(
                        "Dimensions: {}x{}",
                        loaded.metadata.width, loaded.metadata.height
                    );
                    println!("Orientation: {}", loaded.metadata.orientation);
                    if let Some(make) = &loaded.metadata.make {
                        println!("Camera Make: {}", make);
                    }
                    if let Some(model) = &loaded.metadata.model {
                        println!("Camera Model: {}", model);
                    }
                    if let Some(dt) = &loaded.metadata.date_time {
                        println!("Date/Time: {}", dt);
                    }
                }
                Err(e) => eprintln!("Failed to load image: {}", e),
            }
        } else if media_type.is_video() {
            println!("Probing video streams...");
            if let Some(meta) = lux_video::probe_video(path) {
                println!("Resolution: {}x{}", meta.width, meta.height);
                println!("Duration: {:.2} seconds", meta.duration_seconds);
                if let Some(codec) = &meta.video_codec {
                    println!("Video Codec: {}", codec);
                }
                if let Some(fps) = meta.frame_rate {
                    println!("Framerate: {:.2} fps", fps);
                }
            } else {
                println!("Note: Install ffprobe for detailed stream inspection.");
            }
        }
    }
}

#[cfg(feature = "gtk")]
fn run_gtk_app(_path: &Path) -> anyhow::Result<()> {
    // GTK 4 / Libadwaita integration entrypoint
    Ok(())
}
