import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import { StrokePoint, Point2D } from '../lib/ipc';
import styles from './AnnotationLayer.module.css';

interface AnnotationLayerProps {
  mediaWidth: number;
  mediaHeight: number;
  imageElement?: HTMLImageElement | null;
  displaySrc?: string | null;
}

function getConstrainedBox(
  p1: Point2D,
  p2: Point2D,
  constrainSquare: boolean
): { x: number; y: number; w: number; h: number } {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let absDx = Math.abs(dx);
  let absDy = Math.abs(dy);

  if (constrainSquare) {
    const side = Math.max(absDx, absDy);
    absDx = side;
    absDy = side;
    dx = (dx >= 0 ? 1 : -1) * side;
    dy = (dy >= 0 ? 1 : -1) * side;
  }

  const x = dx >= 0 ? p1.x : p1.x - absDx;
  const y = dy >= 0 ? p1.y : p1.y - absDy;
  return { x, y, w: absDx, h: absDy };
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  mediaWidth,
  mediaHeight,
  imageElement,
  displaySrc,
}) => {
  const {
    activeMode,
    activeSubTool,
    activeSelection,
    setActiveSelection,
    applyBlurToSelection,
    strokeColor,
    fillColor,
    strokeWidth,
    fontSize,
    annotations,
    addAnnotation,
    setStrokeColor,
    setAnnotations,
  } = useViewerStore();

  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);
  const [startPoint, setStartPoint] = useState<Point2D | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point2D | null>(null);
  const [lasssoPoints, setLassoPoints] = useState<Point2D[] | null>(null);
  const [polygonNodes, setPolygonNodes] = useState<Point2D[]>([]);
  const [polyCursorPoint, setPolyCursorPoint] = useState<Point2D | null>(null);

  const [textInputPos, setTextInputPos] = useState<Point2D | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [isShiftDown, setIsShiftDown] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Track global Shift key for 1:1 aspect ratio constraints
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(true);
      if (e.key === 'Escape') {
        if (polygonNodes.length > 0) setPolygonNodes([]);
        if (activeSelection) setActiveSelection(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [polygonNodes, activeSelection, setActiveSelection]);

  // Focus text input when opened
  useEffect(() => {
    if (textInputPos && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInputPos]);

  const isInteracting =
    activeMode === 'edit' &&
    activeSubTool !== 'crop';

  const toColorString = (rgba: [number, number, number, number], alphaOverride?: number) => {
    const a = alphaOverride !== undefined ? alphaOverride : rgba[3] / 255;
    return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${a})`;
  };

  const getMediaCoordinates = useCallback(
    (e: React.PointerEvent): Point2D => {
      if (!svgRef.current || mediaWidth <= 0 || mediaHeight <= 0) {
        return { x: 0, y: 0 };
      }
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const scaleX = mediaWidth / rect.width;
      const scaleY = mediaHeight / rect.height;

      return {
        x: Math.max(0, Math.min(clientX * scaleX, mediaWidth)),
        y: Math.max(0, Math.min(clientY * scaleY, mediaHeight)),
      };
    },
    [mediaWidth, mediaHeight]
  );

  const samplePixelColor = (p: Point2D) => {
    const clampedX = Math.max(0, Math.min(mediaWidth - 1, Math.floor(p.x)));
    const clampedY = Math.max(0, Math.min(mediaHeight - 1, Math.floor(p.y)));

    const img =
      imageElement && imageElement.complete && imageElement.naturalWidth > 0
        ? imageElement
        : (document.querySelector('img[class*="imageElement"]') as HTMLImageElement | null ||
           document.querySelector('img') as HTMLImageElement | null);

    if (img && img.complete) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, clampedX, clampedY, 1, 1, 0, 0, 1, 1);
          const pixel = ctx.getImageData(0, 0, 1, 1).data;
          if (pixel[3] > 0 || pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0) {
            setStrokeColor([pixel[0], pixel[1], pixel[2], pixel[3]]);
            return;
          }
        }
      } catch (_) {
        // Tainted canvas fallback below
      }
    }

    if (displaySrc) {
      const offImg = new Image();
      offImg.crossOrigin = 'anonymous';
      offImg.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(offImg, clampedX, clampedY, 1, 1, 0, 0, 1, 1);
            const pixel = ctx.getImageData(0, 0, 1, 1).data;
            setStrokeColor([pixel[0], pixel[1], pixel[2], pixel[3]]);
          }
        } catch (_) {}
      };
      offImg.src = displaySrc;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isInteracting || e.button !== 0) return; // Left click only for drawing/selecting
    e.stopPropagation();
    const p = getMediaCoordinates(e);

    if (activeSubTool === 'eyedropper') {
      samplePixelColor(p);
      return;
    }

    if (activeSubTool === 'text') {
      if (textInputPos && textInputValue.trim()) {
        handleTextSubmit();
      }
      setTextInputPos(p);
      setTextInputValue('');
      return;
    }

    if (activeSubTool === 'select_polygon') {
      // Magnetic polygon select: check if clicking close to the first point to close
      if (polygonNodes.length >= 2) {
        const first = polygonNodes[0];
        const dist = Math.hypot(p.x - first.x, p.y - first.y);
        if (dist < 18) {
          // Close the polygon selection!
          const pts = [...polygonNodes, first];
          const minX = Math.min(...pts.map((pt) => pt.x));
          const maxX = Math.max(...pts.map((pt) => pt.x));
          const minY = Math.min(...pts.map((pt) => pt.y));
          const maxY = Math.max(...pts.map((pt) => pt.y));
          setActiveSelection({
            type: 'polygon',
            points: pts,
            box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          });
          setPolygonNodes([]);
          setPolyCursorPoint(null);
          return;
        }
      }
      setPolygonNodes((prev) => [...prev, p]);
      setPolyCursorPoint(p);
      return;
    }

    if (activeSubTool === 'select_lasso') {
      setLassoPoints([p]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (activeSubTool === 'pen' || activeSubTool === 'highlighter') {
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1.0;
      setCurrentStroke([{ x: p.x, y: p.y, pressure }]);
    } else {
      setStartPoint(p);
      setCurrentPoint(p);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isInteracting) return;
    const p = getMediaCoordinates(e);

    if (activeSubTool === 'eyedropper') {
      if (e.buttons === 1) {
        samplePixelColor(p);
      }
      return;
    }

    if (activeSubTool === 'select_polygon') {
      setPolyCursorPoint(p);
      return;
    }

    if (lasssoPoints) {
      e.stopPropagation();
      const last = lasssoPoints[lasssoPoints.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) {
        setLassoPoints((prev) => (prev ? [...prev, p] : [p]));
      }
      return;
    }

    if (currentStroke) {
      e.stopPropagation();
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1.0;
      setCurrentStroke((prev) => (prev ? [...prev, { x: p.x, y: p.y, pressure }] : null));
    } else if (startPoint) {
      e.stopPropagation();
      setCurrentPoint(p);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isInteracting) return;
    e.stopPropagation();

    const isConstrained = isShiftDown || e.shiftKey;

    if (lasssoPoints && lasssoPoints.length >= 3) {
      // Commit freehand lasso selection
      const pts = [...lasssoPoints, lasssoPoints[0]];
      const minX = Math.min(...pts.map((pt) => pt.x));
      const maxX = Math.max(...pts.map((pt) => pt.x));
      const minY = Math.min(...pts.map((pt) => pt.y));
      const maxY = Math.max(...pts.map((pt) => pt.y));
      setActiveSelection({
        type: 'lasso',
        points: pts,
        box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      });
      setLassoPoints(null);
      return;
    }
    setLassoPoints(null);

    if (currentStroke && currentStroke.length > 0) {
      if (activeSubTool === 'pen') {
        addAnnotation({
          type: 'Pen',
          points: currentStroke,
          color: strokeColor,
          stroke_width: strokeWidth,
        });
      } else if (activeSubTool === 'highlighter') {
        addAnnotation({
          type: 'Highlighter',
          points: currentStroke,
          color: strokeColor,
          stroke_width: Math.max(strokeWidth * 3.5, 14),
        });
      }
      setCurrentStroke(null);
      return;
    }

    if (startPoint && currentPoint) {
      const p1 = startPoint;
      const p2 = currentPoint;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 3) {
        if (activeSubTool === 'select') {
          // Commit rectangular marquee selection
          const box = getConstrainedBox(p1, p2, isConstrained);
          const pts = [
            { x: box.x, y: box.y },
            { x: box.x + box.w, y: box.y },
            { x: box.x + box.w, y: box.y + box.h },
            { x: box.x, y: box.y + box.h },
          ];
          setActiveSelection({
            type: 'rect',
            points: pts,
            box: { x: box.x, y: box.y, width: box.w, height: box.h },
          });
        } else {
          switch (activeSubTool) {
            case 'line':
              addAnnotation({
                type: 'Line',
                start: p1,
                end: p2,
                color: strokeColor,
                stroke_width: strokeWidth,
              });
              break;
            case 'arrow':
              addAnnotation({
                type: 'Arrow',
                start: p1,
                end: p2,
                color: strokeColor,
                stroke_width: strokeWidth,
                double_headed: false,
              });
              break;
            case 'rect': {
              const box = getConstrainedBox(p1, p2, isConstrained);
              addAnnotation({
                type: 'Rectangle',
                x: box.x,
                y: box.y,
                width: box.w,
                height: box.h,
                color: strokeColor,
                stroke_width: strokeWidth,
                fill: fillColor,
                border_radius: 0,
              });
              break;
            }
            case 'ellipse': {
              const box = getConstrainedBox(p1, p2, isConstrained);
              addAnnotation({
                type: 'Ellipse',
                cx: box.x + box.w / 2,
                cy: box.y + box.h / 2,
                rx: box.w / 2,
                ry: box.h / 2,
                color: strokeColor,
                stroke_width: strokeWidth,
                fill: fillColor,
              });
              break;
            }
            case 'blur_rect': {
              const box = getConstrainedBox(p1, p2, isConstrained);
              addAnnotation({
                type: 'BlurRect',
                x: box.x,
                y: box.y,
                width: box.w,
                height: box.h,
                sigma: 12.0,
              });
              break;
            }
            case 'blur_heavy': {
              const box = getConstrainedBox(p1, p2, isConstrained);
              addAnnotation({
                type: 'BlurRect',
                x: box.x,
                y: box.y,
                width: box.w,
                height: box.h,
                sigma: 28.0,
              });
              break;
            }
            case 'mosaic_rect': {
              const box = getConstrainedBox(p1, p2, isConstrained);
              addAnnotation({
                type: 'MosaicRect',
                x: box.x,
                y: box.y,
                width: box.w,
                height: box.h,
                block_size: 14,
              });
              break;
            }
            default:
              break;
          }
        }
      }
      setStartPoint(null);
      setCurrentPoint(null);
    }
  };

  const handleDoubleClick = () => {
    if (activeSubTool === 'select_polygon' && polygonNodes.length >= 3) {
      const pts = [...polygonNodes, polygonNodes[0]];
      const minX = Math.min(...pts.map((pt) => pt.x));
      const maxX = Math.max(...pts.map((pt) => pt.x));
      const minY = Math.min(...pts.map((pt) => pt.y));
      const maxY = Math.max(...pts.map((pt) => pt.y));
      setActiveSelection({
        type: 'polygon',
        points: pts,
        box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      });
      setPolygonNodes([]);
      setPolyCursorPoint(null);
    }
  };

  const handleTextSubmit = () => {
    if (textInputPos && textInputValue.trim()) {
      const calculatedFontSize = Math.max(18, Math.min(64, Math.round(mediaWidth * 0.022)));
      addAnnotation({
        type: 'Text',
        x: textInputPos.x,
        y: textInputPos.y,
        content: textInputValue.trim(),
        color: strokeColor,
        font_size: calculatedFontSize || fontSize,
        bg_pill: true,
      });
    }
    setTextInputPos(null);
    setTextInputValue('');
  };

  const handleEraseItem = (idx: number, e: React.MouseEvent) => {
    if (activeSubTool !== 'eraser') return;
    e.stopPropagation();
    const updated = [...annotations];
    updated.splice(idx, 1);
    setAnnotations(updated);
  };

  const pointsToSvgPath = (points: StrokePoint[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      d += ` Q ${p1.x} ${p1.y}, ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  };

  const getArrowHeadPoints = (start: Point2D, end: Point2D, width: number) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return '';

    const headLength = Math.max(12, Math.min(width * 3.5, 40));
    const headWidth = headLength * 0.65;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const baseX = end.x - ux * headLength;
    const baseY = end.y - uy * headLength;

    const leftX = baseX + nx * headWidth;
    const leftY = baseY + ny * headWidth;
    const rightX = baseX - nx * headWidth;
    const rightY = baseY - ny * headWidth;

    return `${end.x},${end.y} ${leftX},${leftY} ${rightX},${rightY}`;
  };

  let cursorClass = '';
  if (isInteracting) {
    if (activeSubTool === 'eraser') cursorClass = styles.eraserCursor;
    else if (activeSubTool === 'eyedropper') cursorClass = styles.eyedropperCursor;
    else cursorClass = styles.interactive;
  }

  const liveConstrainedBox =
    startPoint && currentPoint
      ? getConstrainedBox(startPoint, currentPoint, isShiftDown)
      : null;

  return (
    <div className={`${styles.annotationLayer} ${cursorClass}`}>
      <svg
        ref={svgRef}
        className={styles.svgRoot}
        viewBox={`0 0 ${mediaWidth} ${mediaHeight}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          {/* Real hardware-accelerated Gaussian Blur filters */}
          <filter id="gaussianBlurFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="heavyBlurFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="24" />
          </filter>

          {/* Mosaic Check Pattern for redaction grid */}
          <pattern id="mosaicCheckPattern" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#475569" />
            <rect x="8" width="8" height="8" fill="#64748b" />
            <rect y="8" width="8" height="8" fill="#64748b" />
            <rect x="8" y="8" width="8" height="8" fill="#475569" />
          </pattern>
        </defs>

        {/* Existing Committed Annotations */}
        {annotations.map((item, idx) => {
          switch (item.type) {
            case 'Pen':
              return (
                <path
                  key={idx}
                  d={pointsToSvgPath(item.points)}
                  stroke={toColorString(item.color)}
                  strokeWidth={item.stroke_width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                />
              );
            case 'Highlighter':
              return (
                <path
                  key={idx}
                  d={pointsToSvgPath(item.points)}
                  stroke={toColorString(item.color, 0.4)}
                  strokeWidth={item.stroke_width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  style={{ mixBlendMode: 'multiply', cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                  onClick={(e) => handleEraseItem(idx, e)}
                />
              );
            case 'Line':
              return (
                <line
                  key={idx}
                  x1={item.start.x}
                  y1={item.start.y}
                  x2={item.end.x}
                  y2={item.end.y}
                  stroke={toColorString(item.color)}
                  strokeWidth={item.stroke_width}
                  strokeLinecap="round"
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                />
              );
            case 'Arrow':
              return (
                <g
                  key={idx}
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                >
                  <line
                    x1={item.start.x}
                    y1={item.start.y}
                    x2={item.end.x}
                    y2={item.end.y}
                    stroke={toColorString(item.color)}
                    strokeWidth={item.stroke_width}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={getArrowHeadPoints(item.start, item.end, item.stroke_width)}
                    fill={toColorString(item.color)}
                  />
                </g>
              );
            case 'Rectangle':
              return (
                <rect
                  key={idx}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                  stroke={toColorString(item.color)}
                  strokeWidth={item.stroke_width}
                  fill={item.fill ? toColorString(item.fill) : 'none'}
                  rx={item.border_radius || 0}
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                />
              );
            case 'Ellipse':
              return (
                <ellipse
                  key={idx}
                  cx={item.cx}
                  cy={item.cy}
                  rx={item.rx}
                  ry={item.ry}
                  stroke={toColorString(item.color)}
                  strokeWidth={item.stroke_width}
                  fill={item.fill ? toColorString(item.fill) : 'none'}
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                />
              );
            case 'Text': {
              const fontSz = item.font_size || Math.max(18, Math.round(mediaWidth * 0.022));
              const approxW = item.content.length * (fontSz * 0.6) + 16;
              const approxH = fontSz * 1.5;
              return (
                <g
                  key={idx}
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                >
                  {item.bg_pill && (
                    <rect
                      x={item.x - 8}
                      y={item.y - fontSz * 0.75}
                      width={approxW}
                      height={approxH}
                      fill="rgba(15, 23, 42, 0.9)"
                      rx={6}
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth={1}
                    />
                  )}
                  <text
                    x={item.x}
                    y={item.y}
                    fill={toColorString(item.color)}
                    fontSize={fontSz}
                    fontFamily="sans-serif"
                    fontWeight="600"
                    dominantBaseline="central"
                  >
                    {item.content}
                  </text>
                </g>
              );
            }
            case 'BlurRect': {
              const clipId = `blur-clip-${idx}`;
              const hasPoly = item.polygon_points && item.polygon_points.length >= 3;
              const polyStr = hasPoly
                ? item.polygon_points!.map((pt) => `${pt.x},${pt.y}`).join(' ')
                : '';
              const filterId = item.sigma > 16 ? 'heavyBlurFilter' : 'gaussianBlurFilter';

              return (
                <g
                  key={idx}
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                >
                  <clipPath id={clipId}>
                    {hasPoly ? (
                      <polygon points={polyStr} />
                    ) : (
                      <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={2} />
                    )}
                  </clipPath>
                  {displaySrc && (
                    <image
                      href={displaySrc}
                      x={0}
                      y={0}
                      width={mediaWidth}
                      height={mediaHeight}
                      filter={`url(#${filterId})`}
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="none"
                    />
                  )}
                  {hasPoly ? (
                    <polygon
                      points={polyStr}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.75)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  ) : (
                    <rect
                      x={item.x}
                      y={item.y}
                      width={item.width}
                      height={item.height}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.75)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      rx={2}
                    />
                  )}
                </g>
              );
            }
            case 'MosaicRect': {
              const clipId = `mosaic-clip-${idx}`;
              const hasPoly = item.polygon_points && item.polygon_points.length >= 3;
              const polyStr = hasPoly
                ? item.polygon_points!.map((pt) => `${pt.x},${pt.y}`).join(' ')
                : '';

              return (
                <g
                  key={idx}
                  onClick={(e) => handleEraseItem(idx, e)}
                  style={{ cursor: activeSubTool === 'eraser' ? 'pointer' : 'default' }}
                >
                  <clipPath id={clipId}>
                    {hasPoly ? (
                      <polygon points={polyStr} />
                    ) : (
                      <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={2} />
                    )}
                  </clipPath>
                  {displaySrc && (
                    <image
                      href={displaySrc}
                      x={0}
                      y={0}
                      width={mediaWidth}
                      height={mediaHeight}
                      filter="url(#heavyBlurFilter)"
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="none"
                    />
                  )}
                  {hasPoly ? (
                    <>
                      <polygon
                        points={polyStr}
                        fill="url(#mosaicCheckPattern)"
                        opacity={0.7}
                        clipPath={`url(#${clipId})`}
                      />
                      <polygon
                        points={polyStr}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.85)"
                        strokeWidth={1.5}
                        strokeDasharray="3 2"
                      />
                    </>
                  ) : (
                    <>
                      <rect
                        x={item.x}
                        y={item.y}
                        width={item.width}
                        height={item.height}
                        fill="url(#mosaicCheckPattern)"
                        opacity={0.7}
                        clipPath={`url(#${clipId})`}
                      />
                      <rect
                        x={item.x}
                        y={item.y}
                        width={item.width}
                        height={item.height}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.85)"
                        strokeWidth={1.5}
                        strokeDasharray="3 2"
                      />
                    </>
                  )}
                </g>
              );
            }
            default:
              return null;
          }
        })}

        {/* Live in-progress freehand stroke preview */}
        {currentStroke && (
          <path
            d={pointsToSvgPath(currentStroke)}
            stroke={toColorString(strokeColor, activeSubTool === 'highlighter' ? 0.4 : 1)}
            strokeWidth={activeSubTool === 'highlighter' ? Math.max(strokeWidth * 3.5, 14) : strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={activeSubTool === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined}
          />
        )}

        {/* Live in-progress freehand lasso preview */}
        {lasssoPoints && lasssoPoints.length > 0 && (
          <path
            d={
              `M ${lasssoPoints[0].x} ${lasssoPoints[0].y} ` +
              lasssoPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
            }
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}

        {/* Live in-progress magnetic polygon nodes and rubber-band line */}
        {polygonNodes.length > 0 && (
          <g>
            <polyline
              points={polygonNodes.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(59, 130, 246, 0.12)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            {polyCursorPoint && (
              <line
                x1={polygonNodes[polygonNodes.length - 1].x}
                y1={polygonNodes[polygonNodes.length - 1].y}
                x2={polyCursorPoint.x}
                y2={polyCursorPoint.y}
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
            {polygonNodes.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === 0 ? 5 : 3.5}
                className={styles.selectionNode}
                fill={i === 0 ? '#10b981' : '#3b82f6'}
              />
            ))}
          </g>
        )}

        {/* Live shape drag preview (Rect, Ellipse, Line, Arrow, Blur, Mosaic, Marquee Select) */}
        {startPoint && currentPoint && (
          <g>
            {activeSubTool === 'select' && liveConstrainedBox && (
              <g>
                <rect
                  x={liveConstrainedBox.x}
                  y={liveConstrainedBox.y}
                  width={liveConstrainedBox.w}
                  height={liveConstrainedBox.h}
                  className={styles.marchingAntsBase}
                />
                <rect
                  x={liveConstrainedBox.x}
                  y={liveConstrainedBox.y}
                  width={liveConstrainedBox.w}
                  height={liveConstrainedBox.h}
                  className={styles.marchingAntsDark}
                />
              </g>
            )}

            {activeSubTool === 'line' && (
              <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={currentPoint.x}
                y2={currentPoint.y}
                stroke={toColorString(strokeColor)}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )}

            {activeSubTool === 'arrow' && (
              <g>
                <line
                  x1={startPoint.x}
                  y1={startPoint.y}
                  x2={currentPoint.x}
                  y2={currentPoint.y}
                  stroke={toColorString(strokeColor)}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
                <polygon
                  points={getArrowHeadPoints(startPoint, currentPoint, strokeWidth)}
                  fill={toColorString(strokeColor)}
                />
              </g>
            )}

            {activeSubTool === 'rect' && liveConstrainedBox && (
              <rect
                x={liveConstrainedBox.x}
                y={liveConstrainedBox.y}
                width={liveConstrainedBox.w}
                height={liveConstrainedBox.h}
                stroke={toColorString(strokeColor)}
                strokeWidth={strokeWidth}
                fill={fillColor ? toColorString(fillColor) : 'none'}
              />
            )}

            {activeSubTool === 'ellipse' && liveConstrainedBox && (
              <ellipse
                cx={liveConstrainedBox.x + liveConstrainedBox.w / 2}
                cy={liveConstrainedBox.y + liveConstrainedBox.h / 2}
                rx={liveConstrainedBox.w / 2}
                ry={liveConstrainedBox.h / 2}
                stroke={toColorString(strokeColor)}
                strokeWidth={strokeWidth}
                fill={fillColor ? toColorString(fillColor) : 'none'}
              />
            )}

            {(activeSubTool === 'blur_rect' || activeSubTool === 'blur_heavy') && liveConstrainedBox && (
              <g>
                <clipPath id="preview-blur-clip">
                  <rect
                    x={liveConstrainedBox.x}
                    y={liveConstrainedBox.y}
                    width={liveConstrainedBox.w}
                    height={liveConstrainedBox.h}
                  />
                </clipPath>
                {displaySrc && (
                  <image
                    href={displaySrc}
                    x={0}
                    y={0}
                    width={mediaWidth}
                    height={mediaHeight}
                    filter={activeSubTool === 'blur_heavy' ? 'url(#heavyBlurFilter)' : 'url(#gaussianBlurFilter)'}
                    clipPath="url(#preview-blur-clip)"
                    preserveAspectRatio="none"
                  />
                )}
                <rect
                  x={liveConstrainedBox.x}
                  y={liveConstrainedBox.y}
                  width={liveConstrainedBox.w}
                  height={liveConstrainedBox.h}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              </g>
            )}

            {activeSubTool === 'mosaic_rect' && liveConstrainedBox && (
              <g>
                <clipPath id="preview-mosaic-clip">
                  <rect
                    x={liveConstrainedBox.x}
                    y={liveConstrainedBox.y}
                    width={liveConstrainedBox.w}
                    height={liveConstrainedBox.h}
                  />
                </clipPath>
                {displaySrc && (
                  <image
                    href={displaySrc}
                    x={0}
                    y={0}
                    width={mediaWidth}
                    height={mediaHeight}
                    filter="url(#heavyBlurFilter)"
                    clipPath="url(#preview-mosaic-clip)"
                    preserveAspectRatio="none"
                  />
                )}
                <rect
                  x={liveConstrainedBox.x}
                  y={liveConstrainedBox.y}
                  width={liveConstrainedBox.w}
                  height={liveConstrainedBox.h}
                  fill="url(#mosaicCheckPattern)"
                  opacity={0.7}
                  clipPath="url(#preview-mosaic-clip)"
                />
                <rect
                  x={liveConstrainedBox.x}
                  y={liveConstrainedBox.y}
                  width={liveConstrainedBox.w}
                  height={liveConstrainedBox.h}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />
              </g>
            )}
          </g>
        )}

        {/* Active Selection Marching Ants Overlay */}
        {activeSelection && (
          <g>
            {activeSelection.type === 'rect' ? (
              <g>
                <rect
                  x={activeSelection.box.x}
                  y={activeSelection.box.y}
                  width={activeSelection.box.width}
                  height={activeSelection.box.height}
                  className={styles.marchingAntsBase}
                />
                <rect
                  x={activeSelection.box.x}
                  y={activeSelection.box.y}
                  width={activeSelection.box.width}
                  height={activeSelection.box.height}
                  className={styles.marchingAntsDark}
                />
              </g>
            ) : (
              <g>
                <polygon
                  points={activeSelection.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  className={styles.marchingAntsBase}
                />
                <polygon
                  points={activeSelection.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  className={styles.marchingAntsDark}
                />
                {activeSelection.points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    className={styles.selectionNode}
                  />
                ))}
              </g>
            )}
          </g>
        )}
      </svg>

      {/* Floating Selection Quick Actions Pill */}
      {activeSelection && (
        <div
          className={styles.selectionPillOverlay}
          style={{
            left: `${((activeSelection.box.x + activeSelection.box.width / 2) / mediaWidth) * 100}%`,
            top: `${(Math.max(16, activeSelection.box.y) / mediaHeight) * 100}%`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className={`${styles.selectionPillBtn} ${styles.selectionPillBtnPrimary}`}
            onClick={() => applyBlurToSelection('blur_rect')}
            title="Apply Gaussian Blur to Selection"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
            Blur
          </button>
          <button
            className={styles.selectionPillBtn}
            onClick={() => applyBlurToSelection('mosaic_rect')}
            title="Apply Mosaic Pixelation to Selection"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            Mosaic
          </button>
          <button
            className={`${styles.selectionPillBtn} ${styles.selectionPillBtnClose}`}
            onClick={() => setActiveSelection(null)}
            title="Deselect (Escape)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Focused Text Callout Input */}
      {textInputPos && (
        <input
          ref={textInputRef}
          type="text"
          className={styles.textInputOverlay}
          style={{
            left: `${(textInputPos.x / mediaWidth) * 100}%`,
            top: `${(textInputPos.y / mediaHeight) * 100}%`,
            fontSize: `${Math.max(14, Math.min(36, Math.round(mediaWidth * 0.016)))}px`,
          }}
          value={textInputValue}
          placeholder="Type annotation text..."
          onChange={(e) => setTextInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit();
            if (e.key === 'Escape') {
              setTextInputPos(null);
              setTextInputValue('');
            }
          }}
          onBlur={handleTextSubmit}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus
        />
      )}
    </div>
  );
};
