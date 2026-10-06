fn main() -> Result<(), Box<dyn std::error::Error>> {
    let svg_path = "packaging/vexview.svg";
    println!("Generating icons from {}...", svg_path);

    // 1. Render primary PNG sizes
    let sizes = [
        (512, "src-tauri/icons/icon.png"),
        (256, "src-tauri/icons/128x128@2x.png"),
        (128, "src-tauri/icons/128x128.png"),
        (32, "src-tauri/icons/32x32.png"),
    ];

    for (size, path) in sizes {
        let img = vex_image::render_svg(svg_path, Some(size), Some(size))?;
        img.save(path)?;
        println!("Saved {} ({}x{})", path, size, size);
    }

    // 2. Render and encode icon.ico (256x256)
    let ico_img = vex_image::render_svg(svg_path, Some(256), Some(256))?;
    image::DynamicImage::ImageRgba8(ico_img).save("src-tauri/icons/icon.ico")?;
    println!("Saved src-tauri/icons/icon.ico");

    println!("All icons generated successfully!");
    Ok(())
}
