
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Eraser, Square, Circle, Minus, PaintBucket, Trash2, Save, X, Undo2, Palette, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SketchPadProps {
  onSave: (base64: string) => void;
  onCancel: () => void;
  initialImage?: string;
  title?: string;
}

type Tool = 'PENCIL' | 'ERASER' | 'RECT' | 'CIRCLE' | 'LINE' | 'FILL';
type BrushSize = 2 | 4 | 8 | 12;

export const SketchPad: React.FC<SketchPadProps> = ({ onSave, onCancel, initialImage, title }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('PENCIL');
  const [brushSize, setBrushSize] = useState<BrushSize>(4);
  const [color, setColor] = useState('#172554');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [paperTexture, setPaperTexture] = useState<'NONE' | 'GRAIN' | 'LINEN'>('NONE');
  const [fillTexture, setFillTexture] = useState<'NONE' | 'HATCH' | 'DOTS'>('NONE');
  const [pendingTexture, setPendingTexture] = useState<'NONE' | 'GRAIN' | 'LINEN' | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const COLORS = [
    '#172554', '#000000', '#ef4444', '#22c55e', '#eab308', '#f97316', '#a855f7', '#78350f', '#ffffff'
  ];

  const CANVAS_SIZE = 512;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    applyBackground(ctx);

    if (initialImage) {
      const img = new Image();
      img.src = initialImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        saveToHistory();
      };
    } else {
      saveToHistory();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Only re-apply if it's not the initial mount or if user explicitly changes it
    // To avoid clearing on mount, we can check if history has more than 1 item
    if (history.length > 1) {
      applyBackground(ctx);
      saveToHistory();
    }
  }, [paperTexture]);

  const confirmTextureChange = (t: 'NONE' | 'GRAIN' | 'LINEN') => {
    if (t === paperTexture) return;
    if (history.length > 1) {
      setPendingTexture(t);
    } else {
      setPaperTexture(t);
    }
  };

  const applyBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (paperTexture === 'GRAIN') {
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * CANVAS_SIZE;
        const y = Math.random() * CANVAS_SIZE;
        const opacity = Math.random() * 0.05;
        ctx.fillStyle = `rgba(0,0,0,${opacity})`;
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (paperTexture === 'LINEN') {
      ctx.strokeStyle = 'rgba(0,0,0,0.03)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < CANVAS_SIZE; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_SIZE, i);
        ctx.stroke();
      }
    }
  };

  const getFillPattern = (ctx: CanvasRenderingContext2D, type: 'NONE' | 'HATCH' | 'DOTS', color: string) => {
    if (type === 'NONE') return color;

    const patternCanvas = document.createElement('canvas');
    const pctx = patternCanvas.getContext('2d')!;
    patternCanvas.width = 10;
    patternCanvas.height = 10;

    pctx.fillStyle = color;
    pctx.fillRect(0, 0, 10, 10);

    pctx.strokeStyle = 'rgba(0,0,0,0.2)';
    pctx.lineWidth = 1;

    if (type === 'HATCH') {
      pctx.beginPath();
      pctx.moveTo(0, 10);
      pctx.lineTo(10, 0);
      pctx.stroke();
    } else if (type === 'DOTS') {
      pctx.fillStyle = 'rgba(0,0,0,0.2)';
      pctx.beginPath();
      pctx.arc(5, 5, 1.5, 0, Math.PI * 2);
      pctx.fill();
    }

    return ctx.createPattern(patternCanvas, 'repeat') || color;
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory(prev => [...prev.slice(-19), canvas.toDataURL()]);
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const lastState = newHistory[newHistory.length - 1];
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = lastState;
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistory(newHistory);
    };
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawSketchyLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    // Add some "jitter" to the line
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(2, Math.floor(dist / 5));
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const jitterX = (Math.random() - 0.5) * (size * 0.5);
      const jitterY = (Math.random() - 0.5) * (size * 0.5);
      ctx.lineTo(x1 + dx * t + jitterX, y1 + dy * t + jitterY);
    }
    
    ctx.stroke();

    // Draw a second, slightly different line to simulate pencil texture
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const jitterX = (Math.random() - 0.5) * (size * 0.8);
      const jitterY = (Math.random() - 0.5) * (size * 0.8);
      ctx.lineTo(x1 + dx * t + jitterX, y1 + dy * t + jitterY);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  };

  const floodFill = (ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) => {
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const data = imageData.data;
    const targetPos = (Math.floor(y) * CANVAS_SIZE + Math.floor(x)) * 4;
    
    const targetR = data[targetPos];
    const targetG = data[targetPos + 1];
    const targetB = data[targetPos + 2];
    const targetA = data[targetPos + 3];

    // Convert hex to RGB
    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);

    if (targetR === r && targetG === g && targetB === b && targetA === 255) return;

    const stack: [number, number][] = [[Math.floor(x), Math.floor(y)]];
    
    while (stack.length > 0) {
      const [curX, curY] = stack.pop()!;
      const pos = (curY * CANVAS_SIZE + curX) * 4;

      if (curX < 0 || curX >= CANVAS_SIZE || curY < 0 || curY >= CANVAS_SIZE) continue;
      if (data[pos] !== targetR || data[pos+1] !== targetG || data[pos+2] !== targetB || data[pos+3] !== targetA) continue;

      data[pos] = r;
      data[pos+1] = g;
      data[pos+2] = b;
      data[pos+3] = 255;

      stack.push([curX + 1, curY], [curX - 1, curY], [curX, curY + 1], [curX, curY - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    setStartPos(pos);
    setIsDrawing(true);

    if (tool === 'FILL') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      floodFill(ctx, pos.x, pos.y, color);
      saveToHistory();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPos = getPos(e);

    if (tool === 'PENCIL' || tool === 'ERASER') {
      ctx.strokeStyle = tool === 'ERASER' ? '#ffffff' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (tool === 'PENCIL') {
        drawSketchyLine(ctx, startPos.x, startPos.y, currentPos.x, currentPos.y, brushSize);
      } else {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
      }
      setStartPos(currentPos);
    } else {
      // For shapes, we need to clear and redraw from the last history state
      const img = new Image();
      img.src = history[history.length - 1];
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        ctx.strokeStyle = color;
        ctx.fillStyle = getFillPattern(ctx, fillTexture, fillColor);
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';

        if (tool === 'RECT') {
          const w = currentPos.x - startPos.x;
          const h = currentPos.y - startPos.y;
          
          // Draw fill first
          if (fillColor !== 'transparent') {
            ctx.fillRect(startPos.x, startPos.y, w, h);
          }

          // Draw sketchy rectangle
          drawSketchyLine(ctx, startPos.x, startPos.y, startPos.x + w, startPos.y, brushSize);
          drawSketchyLine(ctx, startPos.x + w, startPos.y, startPos.x + w, startPos.y + h, brushSize);
          drawSketchyLine(ctx, startPos.x + w, startPos.y + h, startPos.x, startPos.y + h, brushSize);
          drawSketchyLine(ctx, startPos.x, startPos.y + h, startPos.x, startPos.y, brushSize);
        } else if (tool === 'CIRCLE') {
          const r = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
          
          // Draw fill
          if (fillColor !== 'transparent') {
            ctx.beginPath();
            ctx.arc(startPos.x, startPos.y, r, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.beginPath();
          // Sketchy circle is harder, let's just do a jittery arc
          for (let i = 0; i < 360; i += 5) {
            const angle = (i * Math.PI) / 180;
            const jitter = (Math.random() - 0.5) * (brushSize * 0.5);
            const x = startPos.x + (r + jitter) * Math.cos(angle);
            const y = startPos.y + (r + jitter) * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        } else if (tool === 'LINE') {
          drawSketchyLine(ctx, startPos.x, startPos.y, currentPos.x, currentPos.y, brushSize);
        }
      };
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPos(null);
    saveToHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    if (history.length > 1) {
      setShowClearConfirm(true);
    } else {
      performClear();
    }
  };

  const performClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    applyBackground(ctx);
    saveToHistory();
    setShowClearConfirm(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[150] bg-blue-950/40 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="sketch-card bg-white w-full max-w-4xl flex flex-col md:flex-row gap-8 overflow-hidden max-h-[95vh]">
        {/* Toolbar */}
        <div className="flex md:flex-col gap-2 p-2 bg-blue-50 rounded-xl border border-blue-100 overflow-x-auto md:overflow-x-visible">
          <ToolButton active={tool === 'PENCIL'} onClick={() => setTool('PENCIL')} icon={<Pencil size={20} />} label={t('sketchpad.pencil')} />
          <ToolButton active={tool === 'ERASER'} onClick={() => setTool('ERASER')} icon={<Eraser size={20} />} label={t('sketchpad.eraser')} />
          <ToolButton active={tool === 'RECT'} onClick={() => setTool('RECT')} icon={<Square size={20} />} label={t('sketchpad.rectangle')} />
          <ToolButton active={tool === 'CIRCLE'} onClick={() => setTool('CIRCLE')} icon={<Circle size={20} />} label={t('sketchpad.circle')} />
          <ToolButton active={tool === 'LINE'} onClick={() => setTool('LINE')} icon={<Minus size={20} />} label={t('sketchpad.line')} />
          <ToolButton active={tool === 'FILL'} onClick={() => setTool('FILL')} icon={<PaintBucket size={20} />} label={t('sketchpad.fill')} />
          <div className="h-px bg-blue-200 my-2 hidden md:block" />
          <ToolButton active={false} onClick={undo} icon={<Undo2 size={20} />} label={t('sketchpad.undo')} disabled={history.length <= 1} />
          <ToolButton active={false} onClick={clear} icon={<Trash2 size={20} />} label={t('sketchpad.clear')} />
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">{title || t('sketchpad.title')}</h2>
              <p className="text-xs font-mono text-blue-900/40 uppercase tracking-widest">{t('sketchpad.subtitle')}</p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-blue-50 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="relative aspect-square w-full max-w-[512px] mx-auto bg-white shadow-inner border-2 border-blue-950/10 rounded-lg overflow-hidden cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-full touch-none"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-blue-900/40 uppercase block">{t('sketchpad.stroke_color')}</span>
                  <div className="flex items-center gap-1.5">
                    <div 
                      className="w-8 h-8 rounded-lg border-2 border-blue-950 shadow-sm mr-2 flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <div className="w-1 h-1 bg-white rounded-full opacity-50" />
                    </div>
                    <button
                      onClick={() => setColor('#94a3b8')}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${color === '#94a3b8' ? 'border-blue-950 scale-125 z-10' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: '#94a3b8' }}
                    />
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-blue-950 scale-125 z-10' : 'border-transparent hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-6 h-6 rounded-full border-2 border-blue-950/20 overflow-hidden hover:border-blue-950 transition-colors">
                      <Palette size={14} className="absolute inset-0 m-auto text-blue-900/40 pointer-events-none" />
                      <input 
                        type="color" 
                        value={color} 
                        onChange={e => setColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer scale-150"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-blue-900/40 uppercase block">{t('sketchpad.fill_color')}</span>
                  <div className="flex items-center gap-1.5">
                    <div 
                      className="w-8 h-8 rounded-lg border-2 border-blue-950 shadow-sm mr-2 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: fillColor === 'transparent' ? 'transparent' : fillColor }}
                    >
                      {fillColor === 'transparent' ? (
                        <div className="w-full h-full bg-white relative">
                          <div className="absolute inset-0 border-t-2 border-red-500 rotate-45 origin-center" />
                        </div>
                      ) : (
                        <div className="w-2 h-2 bg-white/20 rounded-sm" />
                      )}
                    </div>
                    <button
                      onClick={() => setFillColor('transparent')}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${fillColor === 'transparent' ? 'border-blue-950 scale-125 z-10' : 'border-blue-950/20 hover:scale-110'}`}
                    >
                      <X size={12} className="text-red-500" />
                    </button>
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setFillColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${fillColor === c ? 'border-blue-950 scale-125 z-10' : 'border-transparent hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-6 h-6 rounded-full border-2 border-blue-950/20 overflow-hidden hover:border-blue-950 transition-colors">
                      <Palette size={14} className="absolute inset-0 m-auto text-blue-900/40 pointer-events-none" />
                      <input 
                        type="color" 
                        value={fillColor === 'transparent' ? '#ffffff' : fillColor} 
                        onChange={e => setFillColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer scale-150"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-blue-900/40 uppercase block">{t('sketchpad.brush_size')}</span>
                  <div className="flex gap-2">
                    {[2, 4, 8, 12].map(size => (
                      <button
                        key={size}
                        onClick={() => setBrushSize(size as BrushSize)}
                        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${brushSize === size ? 'border-blue-950 bg-blue-950 text-white' : 'border-blue-950/20 hover:border-blue-950'}`}
                      >
                        <div className="bg-current rounded-full" style={{ width: size, height: size }} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-blue-900/40 uppercase block">{t('sketchpad.paper_texture')}</span>
                  <div className="flex gap-2">
                    {(['NONE', 'GRAIN', 'LINEN'] as const).map(tex => (
                      <button
                        key={tex}
                        onClick={() => confirmTextureChange(tex)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border-2 transition-all ${paperTexture === tex ? 'border-blue-950 bg-blue-950 text-white' : 'border-blue-950/20 text-blue-900/40 hover:border-blue-950'}`}
                      >
                        {tex === 'NONE' ? t('sketchpad.texture_none') : tex === 'GRAIN' ? t('sketchpad.texture_grain') : t('sketchpad.texture_linen')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-blue-900/40 uppercase block">{t('sketchpad.fill_texture')}</span>
                  <div className="flex gap-2">
                    {(['NONE', 'HATCH', 'DOTS'] as const).map(tex => (
                      <button
                        key={tex}
                        onClick={() => setFillTexture(tex)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border-2 transition-all ${fillTexture === tex ? 'border-blue-950 bg-blue-950 text-white' : 'border-blue-950/20 text-blue-900/40 hover:border-blue-950'}`}
                      >
                        {tex === 'NONE' ? t('sketchpad.fill_none') : tex === 'HATCH' ? t('sketchpad.fill_hatch') : t('sketchpad.fill_dots')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={onCancel} className="sketch-button bg-white text-blue-950 font-bold px-6">
                {t('sketchpad.cancel')}
              </button>
              <button onClick={handleSave} className="sketch-button bg-blue-950 text-white font-bold px-8 flex items-center gap-2">
                <Save size={18} />
                {t('sketchpad.save_drawing')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(pendingTexture || showClearConfirm) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-blue-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="sketch-card bg-white p-8 max-w-md w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight">{t('sketchpad.confirm_clear_title')}</h3>
                <p className="text-sm text-blue-900/60 leading-relaxed">
                  {pendingTexture 
                    ? t('sketchpad.confirm_clear_texture')
                    : t('sketchpad.confirm_clear_generic')}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setPendingTexture(null);
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-3 sketch-button bg-white text-blue-950 font-bold"
                >
                  {t('sketchpad.confirm_cancel')}
                </button>
                <button 
                  onClick={() => {
                    if (pendingTexture) {
                      setPaperTexture(pendingTexture);
                      setPendingTexture(null);
                    } else {
                      performClear();
                    }
                  }}
                  className="flex-1 py-3 sketch-button bg-red-500 text-white font-bold"
                >
                  {pendingTexture ? t('sketchpad.confirm_clear_change_btn') : t('sketchpad.confirm_clear_btn')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ToolButton = ({ active, onClick, icon, label, disabled = false }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={`p-3 rounded-xl transition-all flex items-center justify-center ${active ? 'bg-blue-950 text-white shadow-lg' : 'text-blue-900/40 hover:text-blue-950 hover:bg-white disabled:opacity-20'}`}
  >
    {icon}
  </button>
);
