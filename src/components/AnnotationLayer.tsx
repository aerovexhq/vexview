import React, { useState, useRef, useCallback } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import { AnnotationItem, StrokePoint, Point2D } from '../lib/ipc';
import styles from './AnnotationLayer.module.css';

interface AnnotationLayerProps {
  mediaWidth: number;
  mediaHeight: number;
  imageElement?: HTMLImageElement | null;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  mediaWidth,
  mediaHeight,
  imageElement,
}) => {
  const {
    activeSubTool,
    strokeColor,
    fillColor,
    strokeWidth,
    fontSize,
    badgeNumber,
    annotations,
    addAnnotation,
    incrementBadgeNumber,
    setStrokeColor,
    setAnnotations,
  } = useViewerStore();

  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);
  const [startPoint, setStartPoint] = useState<Point2D | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point2D | null>(null);
  const [textInputPos, setTextInputPos] = useState<Point2D | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const isInteracting = activeSubTool !== 'select' && activeSubTool !== 'crop';

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
    if (!imageElement) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(
        imageElement,
        Math.floor(p.x),
        Math.floor(p.y),
        1,
        1,
        0,
        0,
        1,
        1
      );
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      setStrokeColor([pixel[0], pixel[1], pixel[2], pixel[3]]);
    } catch {
      // Ignore cross-origin sampling issues if any
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isInteracting || e.button !== 0) return;
    e.stopPropagation();
    const p = getMediaCoordinates(e);

    if (activeSubTool === 'eyedropper') {
      samplePixelColor(p);
      return;
    }

    if (activeSubTool === 'badge') {
      const newBadge: AnnotationItem = {
        type: 'StepBadge',
        cx: p.x,
        cy: p.y,
        radius: 18,
        number: badgeNumber,
        bg_color: strokeColor,
        text_color: [255, 255, 255, 255],
      };
      addAnnotation(newBadge);
      incrementBadgeNumber();
      return;
    }

    if (activeSubTool === 'text') {
      setTextInputPos(p);
      setTextInputValue('');
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
          stroke_width: Math.max(12, strokeWidth * 2.5),
        });
      }
      setCurrentStroke(null);
    } else if (startPoint && currentPoint) {
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const w = Math.abs(currentPoint.x - startPoint.x);
      const h = Math.abs(currentPoint.y - startPoint.y);

      if (w > 2 || h > 2) {
        switch (activeSubTool) {
          case 'line':
            addAnnotation({
              type: 'Line',
              start: startPoint,
              end: currentPoint,
              color: strokeColor,
              stroke_width: strokeWidth,
            });
            break;
          case 'arrow':
            addAnnotation({
              type: 'Arrow',
              start: startPoint,
              end: currentPoint,
              color: strokeColor,
              stroke_width: strokeWidth,
              double_headed: false,
            });
            break;
          case 'rect':
            addAnnotation({
              type: 'Rectangle',
              x,
              y,
              width: w,
              height: h,
              color: strokeColor,
              stroke_width: strokeWidth,
              fill: fillColor,
              border_radius: 0,
            });
            break;
          case 'ellipse':
            addAnnotation({
              type: 'Ellipse',
              cx: x + w / 2,
              cy: y + h / 2,
              rx: w / 2,
              ry: h / 2,
              color: strokeColor,
              stroke_width: strokeWidth,
              fill: fillColor,
            });
            break;
          case 'blur_rect':
            addAnnotation({
              type: 'BlurRect',
              x,
              y,
              width: w,
              height: h,
              sigma: 8.0,
            });
            break;
          case 'mosaic_rect':
            addAnnotation({
              type: 'MosaicRect',
              x,
              y,
              width: w,
              height: h,
              block_size: 12,
            });
            break;
          default:
            break;
        }
      }
      setStartPoint(null);
      setCurrentPoint(null);
    }
  };

  const handleTextSubmit = () => {
    if (textInputPos && textInputValue.trim()) {
      addAnnotation({
        type: 'Text',
        x: textInputPos.x,
        y: textInputPos.y,
        content: textInputValue.trim(),
        color: strokeColor,
        font_size: fontSize,
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
    const len = Math.sqrt(dx * dx + dy * dy);
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
      >
        <defs>
          <filter id="previewBlurFilter">
            <feGaussianBlur stdDeviation="6" />
          </filter>
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
                  style={{ mixBlendMode: 'multiply' }}
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
                />
              );
            case 'Arrow':
              return (
                <g key={idx} onClick={(e) => handleEraseItem(idx, e)}>
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
                />
              );
            case 'StepBadge':
              return (
                <g
                  key={idx}
                  className={styles.badgeGroup}
                  onClick={(e) => handleEraseItem(idx, e)}
                >
                  <circle
                    cx={item.cx}
                    cy={item.cy}
                    r={item.radius + 2}
                    fill="#ffffff"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                  />
                  <circle cx={item.cx} cy={item.cy} r={item.radius} fill={toColorString(item.bg_color)} />
                  <text
                    x={item.cx}
                    y={item.cy + 5}
                    textAnchor="middle"
                    fill={toColorString(item.text_color)}
                    fontSize={item.radius * 1.1}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {item.number}
                  </text>
                </g>
              );
            case 'Text':
              return (
                <g key={idx} onClick={(e) => handleEraseItem(idx, e)}>
                  {item.bg_pill && (
                    <rect
                      x={item.x - 6}
                      y={item.y - item.font_size}
                      width={item.content.length * (item.font_size * 0.6) + 12}
                      height={item.font_size * 1.4}
                      fill="rgba(15, 23, 42, 0.85)"
                      rx={4}
                    />
                  )}
                  <text
                    x={item.x}
                    y={item.y}
                    fill={toColorString(item.color)}
                    fontSize={item.font_size}
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {item.content}
                  </text>
                </g>
              );
            case 'BlurRect':
              return (
                <rect
                  key={idx}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                  className={styles.redactionBlur}
                  onClick={(e) => handleEraseItem(idx, e)}
                />
              );
            case 'MosaicRect':
              return (
                <rect
                  key={idx}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                  fill="url(#mosaicCheckPattern)"
                  stroke="rgba(255,255,255,0.6)"
                  strokeDasharray="4 2"
                  onClick={(e) => handleEraseItem(idx, e)}
                />
              );
            default:
              return null;
          }
        })}

        {/* Live in-progress stroke / shape preview */}
        {currentStroke && activeSubTool === 'pen' && (
          <path
            d={pointsToSvgPath(currentStroke)}
            stroke={toColorString(strokeColor)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {currentStroke && activeSubTool === 'highlighter' && (
          <path
            d={pointsToSvgPath(currentStroke)}
            stroke={toColorString(strokeColor, 0.4)}
            strokeWidth={Math.max(12, strokeWidth * 2.5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{ mixBlendMode: 'multiply' }}
          />
        )}
        {startPoint && currentPoint && (
          <>
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
            {activeSubTool === 'rect' && (
              <rect
                x={Math.min(startPoint.x, currentPoint.x)}
                y={Math.min(startPoint.y, currentPoint.y)}
                width={Math.abs(currentPoint.x - startPoint.x)}
                height={Math.abs(currentPoint.y - startPoint.y)}
                stroke={toColorString(strokeColor)}
                strokeWidth={strokeWidth}
                fill={fillColor ? toColorString(fillColor) : 'none'}
              />
            )}
            {activeSubTool === 'ellipse' && (
              <ellipse
                cx={(startPoint.x + currentPoint.x) / 2}
                cy={(startPoint.y + currentPoint.y) / 2}
                rx={Math.abs(currentPoint.x - startPoint.x) / 2}
                ry={Math.abs(currentPoint.y - startPoint.y) / 2}
                stroke={toColorString(strokeColor)}
                strokeWidth={strokeWidth}
                fill={fillColor ? toColorString(fillColor) : 'none'}
              />
            )}
            {activeSubTool === 'blur_rect' && (
              <rect
                x={Math.min(startPoint.x, currentPoint.x)}
                y={Math.min(startPoint.y, currentPoint.y)}
                width={Math.abs(currentPoint.x - startPoint.x)}
                height={Math.abs(currentPoint.y - startPoint.y)}
                className={styles.redactionBlur}
              />
            )}
            {activeSubTool === 'mosaic_rect' && (
              <rect
                x={Math.min(startPoint.x, currentPoint.x)}
                y={Math.min(startPoint.y, currentPoint.y)}
                width={Math.abs(currentPoint.x - startPoint.x)}
                height={Math.abs(currentPoint.y - startPoint.y)}
                fill="url(#mosaicCheckPattern)"
                stroke="rgba(255,255,255,0.6)"
                strokeDasharray="4 2"
              />
            )}
          </>
        )}
      </svg>

      {/* Floating inline input for text annotations */}
      {textInputPos && (
        <input
          autoFocus
          className={styles.textInputOverlay}
          style={{
            left: `${(textInputPos.x / mediaWidth) * 100}%`,
            top: `${(textInputPos.y / mediaHeight) * 100}%`,
          }}
          value={textInputValue}
          placeholder="Type annotation and press Enter..."
          onChange={(e) => setTextInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit();
            if (e.key === 'Escape') setTextInputPos(null);
          }}
          onBlur={handleTextSubmit}
        />
      )}
    </div>
  );
};
