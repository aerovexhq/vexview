/**
 * Vexview Image Composite Engine
 * High-performance composition of base image with:
 * 1. CSS adjustments (brightness, contrast, blur, saturation, warmth, color filters)
 * 2. Vector annotations (pen, highlighter, line, arrow, shapes, text, blur, mosaic)
 * 3. Crop boundaries
 * 4. Angle rotation & horizontal/vertical flips
 *
 * Produces a full-resolution PNG data URL representing the true end image for clipboard copying.
 */

import { useViewerStore, EditorState } from '../stores/useViewerStore';
import { AnnotationItem } from './ipc';
import { convertFileSrc } from '@tauri-apps/api/core';

export function getFilterString(editor: EditorState): string {
  let filterStr = `brightness(${100 + editor.brightness}%) contrast(${100 + editor.contrast}%) blur(${editor.blur}px) saturate(${100 + editor.saturation}%)`;
  if (editor.filter === 'grayscale') {
    filterStr += ' grayscale(100%)';
  } else if (editor.filter === 'invert') {
    filterStr += ' invert(100%)';
  } else if (editor.filter === 'sepia') {
    filterStr += ' sepia(85%)';
  }
  if (editor.warmth > 0) {
    filterStr += ` sepia(${editor.warmth * 0.4}%)`;
  } else if (editor.warmth < 0) {
    filterStr += ` hue-rotate(${editor.warmth * 0.3}deg)`;
  }
  return filterStr;
}

function toColorString(color: [number, number, number, number]): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;

  const headLen = Math.max(12, Math.min(48, strokeWidth * 3.5));
  const headWidth = headLen * 0.65;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const baseX = toX - ux * headLen;
  const baseY = toY - uy * headLen;

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(baseX + nx * headWidth, baseY + ny * headWidth);
  ctx.lineTo(baseX - nx * headWidth, baseY - ny * headWidth);
  ctx.closePath();
  ctx.fill();
}

export function renderAnnotationsToCanvas(
  ctx: CanvasRenderingContext2D,
  annotations: AnnotationItem[],
  sourceImg: CanvasImageSource,
  naturalW: number,
  naturalH: number
): void {
  if (!annotations || annotations.length === 0) return;

  // Pass 1: Privacy redactions (BlurRect and MosaicRect)
  for (const item of annotations) {
    if (item.type === 'BlurRect') {
      ctx.save();
      ctx.beginPath();
      if (item.polygon_points && item.polygon_points.length >= 3) {
        ctx.moveTo(item.polygon_points[0].x, item.polygon_points[0].y);
        for (let i = 1; i < item.polygon_points.length; i++) {
          ctx.lineTo(item.polygon_points[i].x, item.polygon_points[i].y);
        }
        ctx.closePath();
      } else {
        ctx.rect(item.x, item.y, item.width, item.height);
      }
      ctx.clip();
      ctx.filter = `blur(${item.sigma > 16 ? 24 : 10}px)`;
      ctx.drawImage(sourceImg, 0, 0, naturalW, naturalH);
      ctx.restore();
    } else if (item.type === 'MosaicRect') {
      const blockSize = item.block_size || 14;
      const sw = Math.max(1, Math.round(item.width));
      const sh = Math.max(1, Math.round(item.height));
      const sx = Math.max(0, Math.round(item.x));
      const sy = Math.max(0, Math.round(item.y));
      const cols = Math.max(1, Math.round(sw / blockSize));
      const rows = Math.max(1, Math.round(sh / blockSize));

      const downCanvas = document.createElement('canvas');
      downCanvas.width = cols;
      downCanvas.height = rows;
      const downCtx = downCanvas.getContext('2d');
      if (downCtx) {
        downCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, cols, rows);
        ctx.save();
        if (item.polygon_points && item.polygon_points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(item.polygon_points[0].x, item.polygon_points[0].y);
          for (let i = 1; i < item.polygon_points.length; i++) {
            ctx.lineTo(item.polygon_points[i].x, item.polygon_points[i].y);
          }
          ctx.closePath();
          ctx.clip();
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(downCanvas, 0, 0, cols, rows, sx, sy, sw, sh);
        ctx.restore();
      }
    }
  }

  // Pass 2: Vector strokes, lines, shapes, and text
  for (const item of annotations) {
    switch (item.type) {
      case 'Pen': {
        if (item.points.length === 0) break;
        ctx.save();
        ctx.strokeStyle = toColorString(item.color);
        ctx.lineWidth = item.stroke_width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'Highlighter': {
        if (item.points.length === 0) break;
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = toColorString(item.color);
        ctx.lineWidth = item.stroke_width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'Line': {
        ctx.save();
        ctx.strokeStyle = toColorString(item.color);
        ctx.lineWidth = item.stroke_width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(item.start.x, item.start.y);
        ctx.lineTo(item.end.x, item.end.y);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'Arrow': {
        ctx.save();
        ctx.strokeStyle = toColorString(item.color);
        ctx.fillStyle = toColorString(item.color);
        ctx.lineWidth = item.stroke_width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(item.start.x, item.start.y);
        ctx.lineTo(item.end.x, item.end.y);
        ctx.stroke();
        drawArrowHead(ctx, item.start.x, item.start.y, item.end.x, item.end.y, item.stroke_width);
        if (item.double_headed) {
          drawArrowHead(ctx, item.end.x, item.end.y, item.start.x, item.start.y, item.stroke_width);
        }
        ctx.restore();
        break;
      }
      case 'Rectangle': {
        ctx.save();
        if (item.fill) {
          ctx.fillStyle = toColorString(item.fill);
          ctx.fillRect(item.x, item.y, item.width, item.height);
        }
        if (item.stroke_width > 0) {
          ctx.strokeStyle = toColorString(item.color);
          ctx.lineWidth = item.stroke_width;
          ctx.strokeRect(item.x, item.y, item.width, item.height);
        }
        ctx.restore();
        break;
      }
      case 'Ellipse': {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(item.cx, item.cy, Math.abs(item.rx), Math.abs(item.ry), 0, 0, Math.PI * 2);
        if (item.fill) {
          ctx.fillStyle = toColorString(item.fill);
          ctx.fill();
        }
        if (item.stroke_width > 0) {
          ctx.strokeStyle = toColorString(item.color);
          ctx.lineWidth = item.stroke_width;
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'Text': {
        ctx.save();
        ctx.font = `600 ${item.font_size}px system-ui, -apple-system, sans-serif`;
        const metrics = ctx.measureText(item.content);
        const pad = 6;
        if (item.bg_pill) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(
            item.x - pad,
            item.y - pad,
            metrics.width + pad * 2,
            item.font_size * 1.25 + pad * 2
          );
        }
        ctx.fillStyle = toColorString(item.color);
        ctx.textBaseline = 'top';
        ctx.fillText(item.content, item.x, item.y);
        ctx.restore();
        break;
      }
      case 'StepBadge': {
        ctx.save();
        ctx.beginPath();
        ctx.arc(item.cx, item.cy, item.radius, 0, Math.PI * 2);
        ctx.fillStyle = toColorString(item.bg_color);
        ctx.fill();
        ctx.fillStyle = toColorString(item.text_color);
        ctx.font = `bold ${item.radius * 1.1}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(item.number), item.cx, item.cy);
        ctx.restore();
        break;
      }
      case 'BlurRect':
      case 'MosaicRect':
        // Already handled in Pass 1
        break;
    }
  }
}

export async function renderCompositeEndImage(): Promise<string> {
  const store = useViewerStore.getState();
  const { items, currentIndex, editor, annotations, cropBox, activeSubTool } = store;
  const current = items[currentIndex];
  if (!current) {
    throw new Error('No current item loaded');
  }

  // 1. Resolve source image element
  let sourceImg: HTMLImageElement | null =
    (document.querySelector('img[class*="imageElement"]') as HTMLImageElement | null) ||
    (document.querySelector('img') as HTMLImageElement | null);

  if (!sourceImg || !sourceImg.complete || sourceImg.naturalWidth === 0) {
    const srcUrl = convertFileSrc(current.path);
    sourceImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load source image: ${e}`));
      img.src = srcUrl;
    });
  }

  const naturalW = sourceImg.naturalWidth || 1920;
  const naturalH = sourceImg.naturalHeight || 1080;

  // 2. Base canvas for full-resolution image + filters + annotations
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = naturalW;
  baseCanvas.height = naturalH;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    throw new Error('Failed to create 2D canvas context');
  }

  // 3. Draw base image with filters applied
  baseCtx.filter = getFilterString(editor);
  baseCtx.drawImage(sourceImg, 0, 0, naturalW, naturalH);
  baseCtx.filter = 'none';

  // 4. Render committed vector annotations on top of base image
  renderAnnotationsToCanvas(baseCtx, annotations, sourceImg, naturalW, naturalH);

  // 5. Determine crop boundaries (editor.crop or active cropBox)
  const activeCrop = editor.crop || (activeSubTool === 'crop' && cropBox ? cropBox : null);
  const cropX = activeCrop ? Math.max(0, Math.min(naturalW - 1, Math.round(activeCrop.x))) : 0;
  const cropY = activeCrop ? Math.max(0, Math.min(naturalH - 1, Math.round(activeCrop.y))) : 0;
  const cropW = activeCrop ? Math.max(1, Math.min(naturalW - cropX, Math.round(activeCrop.width))) : naturalW;
  const cropH = activeCrop ? Math.max(1, Math.min(naturalH - cropY, Math.round(activeCrop.height))) : naturalH;

  // 6. Handle rotation and flip
  const rot = ((editor.rotation % 360) + 360) % 360;
  const isPerpendicular = rot === 90 || rot === 270;
  const finalW = isPerpendicular ? cropH : cropW;
  const finalH = isPerpendicular ? cropW : cropH;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW;
  finalCanvas.height = finalH;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    return baseCanvas.toDataURL('image/png');
  }

  finalCtx.translate(finalW / 2, finalH / 2);
  finalCtx.rotate((rot * Math.PI) / 180);
  finalCtx.scale(editor.flipH ? -1 : 1, editor.flipV ? -1 : 1);
  finalCtx.drawImage(
    baseCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    -cropW / 2,
    -cropH / 2,
    cropW,
    cropH
  );

  return finalCanvas.toDataURL('image/png');
}
