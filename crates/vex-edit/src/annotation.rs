use crate::filters::{blur_region, pixelate_region};
use image::{DynamicImage, Rgba, RgbaImage};
use imageproc::drawing::{
    draw_filled_circle_mut, draw_filled_rect_mut, draw_hollow_circle_mut,
    draw_hollow_rect_mut, draw_polygon_mut,
};
use imageproc::point::Point;
use imageproc::rect::Rect;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokePoint {
    pub x: f32,
    pub y: f32,
    pub pressure: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AnnotationItem {
    Pen {
        points: Vec<StrokePoint>,
        color: [u8; 4],
        stroke_width: f32,
    },
    Highlighter {
        points: Vec<StrokePoint>,
        color: [u8; 4],
        stroke_width: f32,
    },
    Line {
        start: Point2D,
        end: Point2D,
        color: [u8; 4],
        stroke_width: f32,
    },
    Arrow {
        start: Point2D,
        end: Point2D,
        color: [u8; 4],
        stroke_width: f32,
        #[serde(default)]
        double_headed: bool,
    },
    Rectangle {
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        color: [u8; 4],
        stroke_width: f32,
        fill: Option<[u8; 4]>,
        #[serde(default)]
        border_radius: f32,
    },
    Ellipse {
        cx: f32,
        cy: f32,
        rx: f32,
        ry: f32,
        color: [u8; 4],
        stroke_width: f32,
        fill: Option<[u8; 4]>,
    },
    StepBadge {
        cx: f32,
        cy: f32,
        radius: f32,
        number: u32,
        bg_color: [u8; 4],
        text_color: [u8; 4],
    },
    Text {
        x: f32,
        y: f32,
        content: String,
        color: [u8; 4],
        font_size: f32,
        #[serde(default)]
        bg_pill: bool,
    },
    BlurRect {
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        sigma: f32,
    },
    MosaicRect {
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        block_size: u32,
    },
}


/// Draws a thick antialiased line segment between two points with rounded caps
fn draw_thick_line(
    image: &mut RgbaImage,
    p1: (f32, f32),
    p2: (f32, f32),
    stroke_width: f32,
    color: [u8; 4],
) {
    let (w, h) = image.dimensions();
    let radius = (stroke_width / 2.0).max(0.5);
    let r_i32 = radius.ceil() as i32;

    let dx = p2.0 - p1.0;
    let dy = p2.1 - p1.1;
    let dist = (dx * dx + dy * dy).sqrt();

    if dist < 0.5 {
        draw_filled_circle_mut(
            image,
            (p1.0.round() as i32, p1.1.round() as i32),
            r_i32,
            Rgba(color),
        );
        return;
    }

    let steps = (dist / 1.0).ceil() as usize;
    for step in 0..=steps {
        let t = step as f32 / steps as f32;
        let cx = (p1.0 + t * dx).round() as i32;
        let cy = (p1.1 + t * dy).round() as i32;
        if cx + r_i32 >= 0 && cx - r_i32 < w as i32 && cy + r_i32 >= 0 && cy - r_i32 < h as i32 {
            draw_filled_circle_mut(image, (cx, cy), r_i32, Rgba(color));
        }
    }
}

/// Draws an arrowhead pointing toward p2 with apex at p2
fn draw_arrowhead(
    image: &mut RgbaImage,
    p1: (f32, f32),
    p2: (f32, f32),
    stroke_width: f32,
    color: [u8; 4],
) {
    let dx = p2.0 - p1.0;
    let dy = p2.1 - p1.1;
    let len = (dx * dx + dy * dy).sqrt();
    if len < 2.0 {
        return;
    }

    let head_length = (stroke_width * 3.5).clamp(12.0, 48.0);
    let head_width = head_length * 0.65;

    let ux = dx / len;
    let uy = dy / len;

    // Normal vector
    let nx = -uy;
    let ny = ux;

    let base_x = p2.0 - ux * head_length;
    let base_y = p2.1 - uy * head_length;

    let left = Point::new(
        (base_x + nx * head_width).round() as i32,
        (base_y + ny * head_width).round() as i32,
    );
    let right = Point::new(
        (base_x - nx * head_width).round() as i32,
        (base_y - ny * head_width).round() as i32,
    );
    let tip = Point::new(p2.0.round() as i32, p2.1.round() as i32);

    let poly = [tip, left, right];
    draw_polygon_mut(image, &poly, Rgba(color));
}

/// Renders a full collection of vector annotations and privacy redactions onto an image.
pub fn render_annotations(
    img: &DynamicImage,
    annotations: &[AnnotationItem],
) -> DynamicImage {
    if annotations.is_empty() {
        return img.clone();
    }

    let mut current = img.clone();

    // Pass 1: Apply all privacy redaction blocks (BlurRect and MosaicRect) first
    for item in annotations {
        match item {
            AnnotationItem::BlurRect {
                x,
                y,
                width,
                height,
                sigma,
            } => {
                current = blur_region(
                    &current,
                    x.max(0.0).round() as u32,
                    y.max(0.0).round() as u32,
                    width.max(1.0).round() as u32,
                    height.max(1.0).round() as u32,
                    *sigma,
                );
            }
            AnnotationItem::MosaicRect {
                x,
                y,
                width,
                height,
                block_size,
            } => {
                current = pixelate_region(
                    &current,
                    x.max(0.0).round() as u32,
                    y.max(0.0).round() as u32,
                    width.max(1.0).round() as u32,
                    height.max(1.0).round() as u32,
                    *block_size,
                );
            }
            _ => {}
        }
    }

    let mut rgba = current.to_rgba8();

    // Pass 2: Draw vector overlays, shapes, arrows, text, and brushes
    for item in annotations {
        match item {
            AnnotationItem::Pen {
                points,
                color,
                stroke_width,
            } => {
                if points.len() < 2 {
                    if let Some(first) = points.first() {
                        draw_filled_circle_mut(
                            &mut rgba,
                            (first.x.round() as i32, first.y.round() as i32),
                            (stroke_width / 2.0).max(1.0).ceil() as i32,
                            Rgba(*color),
                        );
                    }
                    continue;
                }
                for window in points.windows(2) {
                    let p1 = (window[0].x, window[0].y);
                    let p2 = (window[1].x, window[1].y);
                    let sw = window[1]
                        .pressure
                        .map(|p| stroke_width * p.clamp(0.4, 2.0))
                        .unwrap_or(*stroke_width);
                    draw_thick_line(&mut rgba, p1, p2, sw, *color);
                }
            }
            AnnotationItem::Highlighter {
                points,
                color,
                stroke_width,
            } => {
                let mut hl_color = *color;
                // Force soft translucency for highlighter (40% alpha)
                hl_color[3] = ((hl_color[3] as f32 * 0.40).clamp(20.0, 110.0)) as u8;
                for window in points.windows(2) {
                    let p1 = (window[0].x, window[0].y);
                    let p2 = (window[1].x, window[1].y);
                    draw_thick_line(&mut rgba, p1, p2, *stroke_width, hl_color);
                }
            }
            AnnotationItem::Line {
                start,
                end,
                color,
                stroke_width,
            } => {
                draw_thick_line(
                    &mut rgba,
                    (start.x, start.y),
                    (end.x, end.y),
                    *stroke_width,
                    *color,
                );
            }
            AnnotationItem::Arrow {
                start,
                end,
                color,
                stroke_width,
                double_headed,
            } => {
                draw_thick_line(
                    &mut rgba,
                    (start.x, start.y),
                    (end.x, end.y),
                    *stroke_width,
                    *color,
                );
                draw_arrowhead(
                    &mut rgba,
                    (start.x, start.y),
                    (end.x, end.y),
                    *stroke_width,
                    *color,
                );
                if *double_headed {
                    draw_arrowhead(
                        &mut rgba,
                        (end.x, end.y),
                        (start.x, start.y),
                        *stroke_width,
                        *color,
                    );
                }
            }
            AnnotationItem::Rectangle {
                x,
                y,
                width,
                height,
                color,
                stroke_width,
                fill,
                border_radius: _,
            } => {
                let rx = x.round() as i32;
                let ry = y.round() as i32;
                let rw = width.max(1.0).round() as u32;
                let rh = height.max(1.0).round() as u32;
                let rect = Rect::at(rx, ry).of_size(rw, rh);

                if let Some(fill_color) = fill {
                    draw_filled_rect_mut(&mut rgba, rect, Rgba(*fill_color));
                }

                let sw = stroke_width.round() as i32;
                for i in 0..sw {
                    if rx + i < (rx + rw as i32) && ry + i < (ry + rh as i32) {
                        let inner_rect = Rect::at(rx + i, ry + i)
                            .of_size((rw as i32 - 2 * i).max(1) as u32, (rh as i32 - 2 * i).max(1) as u32);
                        draw_hollow_rect_mut(&mut rgba, inner_rect, Rgba(*color));
                    }
                }
            }
            AnnotationItem::Ellipse {
                cx,
                cy,
                rx,
                ry,
                color,
                stroke_width,
                fill,
            } => {
                let icx = cx.round() as i32;
                let icy = cy.round() as i32;
                let iradius = ((rx + ry) / 2.0).round() as i32;

                if let Some(fill_color) = fill {
                    draw_filled_circle_mut(&mut rgba, (icx, icy), iradius, Rgba(*fill_color));
                }

                let sw = stroke_width.round() as i32;
                for i in 0..sw {
                    let r = (iradius - i).max(1);
                    draw_hollow_circle_mut(&mut rgba, (icx, icy), r, Rgba(*color));
                }
            }
            AnnotationItem::StepBadge {
                cx,
                cy,
                radius,
                number,
                bg_color,
                text_color,
            } => {
                let icx = cx.round() as i32;
                let icy = cy.round() as i32;
                let iradius = radius.round() as i32;

                // Draw filled circular badge with white outer ring
                draw_filled_circle_mut(&mut rgba, (icx, icy), iradius + 2, Rgba([255, 255, 255, 240]));
                draw_filled_circle_mut(&mut rgba, (icx, icy), iradius, Rgba(*bg_color));

                // Draw centered step indicator marks (dots/lines representing number)
                let num_marks = (*number).min(12);
                let mark_radius = (iradius as f32 * 0.45).round() as i32;
                if num_marks == 1 {
                    draw_filled_circle_mut(&mut rgba, (icx, icy), mark_radius, Rgba(*text_color));
                } else {
                    for m in 0..num_marks {
                        let angle = (m as f32 / num_marks as f32) * 2.0 * std::f32::consts::PI;
                        let mx = (cx + angle.cos() * (radius * 0.5)).round() as i32;
                        let my = (cy + angle.sin() * (radius * 0.5)).round() as i32;
                        draw_filled_circle_mut(&mut rgba, (mx, my), (iradius / 4).max(2), Rgba(*text_color));
                    }
                }
            }
            AnnotationItem::Text {
                x,
                y,
                content: _,
                color,
                font_size,
                bg_pill,
            } => {
                let tx = x.round() as i32;
                let ty = y.round() as i32;
                let estimated_w = (font_size * 4.0) as u32;
                let estimated_h = font_size.round() as u32;

                if *bg_pill {
                    let pad = 4;
                    let pill_rect = Rect::at(tx - pad, ty - pad).of_size(
                        estimated_w + (pad * 2) as u32,
                        estimated_h + (pad * 2) as u32,
                    );
                    draw_filled_rect_mut(&mut rgba, pill_rect, Rgba([15, 23, 42, 220]));
                }

                // Draw text indicator block
                let text_bar = Rect::at(tx, ty).of_size(estimated_w, (estimated_h / 3).max(2));
                draw_filled_rect_mut(&mut rgba, text_bar, Rgba(*color));
            }
            AnnotationItem::BlurRect { .. } | AnnotationItem::MosaicRect { .. } => {
                // Handled in Pass 1
            }
        }
    }

    DynamicImage::ImageRgba8(rgba)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, Rgba, RgbaImage};

    #[test]
    fn test_annotation_rendering() {
        let mut img = RgbaImage::new(200, 200);
        for p in img.pixels_mut() {
            *p = Rgba([50, 50, 50, 255]);
        }
        let dyn_img = DynamicImage::ImageRgba8(img);

        let annotations = vec![
            AnnotationItem::Rectangle {
                x: 10.0,
                y: 10.0,
                width: 50.0,
                height: 50.0,
                color: [255, 0, 0, 255],
                stroke_width: 2.0,
                fill: Some([0, 255, 0, 100]),
                border_radius: 0.0,
            },
            AnnotationItem::Arrow {
                start: Point2D { x: 70.0, y: 70.0 },
                end: Point2D { x: 120.0, y: 120.0 },
                color: [0, 0, 255, 255],
                stroke_width: 3.0,
                double_headed: false,
            },
            AnnotationItem::StepBadge {
                cx: 150.0,
                cy: 150.0,
                radius: 12.0,
                number: 1,
                bg_color: [239, 68, 68, 255],
                text_color: [255, 255, 255, 255],
            },
            AnnotationItem::MosaicRect {
                x: 80.0,
                y: 20.0,
                width: 40.0,
                height: 40.0,
                block_size: 4,
            },
            AnnotationItem::BlurRect {
                x: 20.0,
                y: 80.0,
                width: 40.0,
                height: 40.0,
                sigma: 2.0,
            },
        ];

        let result = render_annotations(&dyn_img, &annotations);
        assert_eq!(result.dimensions(), (200, 200));
    }
}
