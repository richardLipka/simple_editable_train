import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, RotateCcw, Check, Loader2, AlertTriangle, SwitchCamera } from 'lucide-react';
import { motion } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
  title?: string;
}

// Live webcam capture modal. Uses getUserMedia so it works with a real
// computer webcam (desktop) as well as mobile cameras. The captured frame is
// returned as a PNG data URL via onCapture — callers typically route it into
// the same crop editor used for uploaded images.
export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel, title }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async (mode: 'user' | 'environment') => {
    stopStream();
    setStatus('starting');
    setErrorMsg(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMsg(t('camera_capture.error_unsupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus('ready');

      // Detect whether a front/back toggle is worth showing.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter(d => d.kind === 'videoinput').length > 1);
      } catch {
        setHasMultipleCameras(false);
      }
    } catch (err) {
      setStatus('error');
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setErrorMsg(t('camera_capture.error_denied'));
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setErrorMsg(t('camera_capture.error_no_device'));
      } else {
        setErrorMsg(t('camera_capture.error_generic'));
      }
    }
  }, [stopStream, t]);

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startStream(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Crop to a centered square so the result matches the square asset slots.
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror the front camera so the snapshot matches the preview the user saw.
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    setSnapshot(canvas.toDataURL('image/png'));
    stopStream();
  };

  const handleRetake = () => {
    setSnapshot(null);
    startStream(facingMode);
  };

  const handleUse = () => {
    if (snapshot) onCapture(snapshot);
  };

  const handleCancel = () => {
    stopStream();
    onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[150] bg-blue-950/40 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="sketch-card bg-white w-full max-w-lg flex flex-col gap-6 overflow-hidden max-h-[95vh]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{title || t('camera_capture.title')}</h2>
            <p className="text-xs font-mono text-blue-900/40 uppercase tracking-widest">{t('camera_capture.subtitle')}</p>
          </div>
          <button onClick={handleCancel} className="p-2 hover:bg-blue-50 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="relative aspect-square w-full max-w-[420px] mx-auto bg-blue-950/5 border-2 border-blue-950/10 rounded-lg overflow-hidden flex items-center justify-center">
          {snapshot ? (
            <img src={snapshot} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
              {status === 'starting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-blue-900/50">
                  <Loader2 size={36} className="animate-spin" />
                  <p className="text-xs font-mono uppercase tracking-widest">{t('camera_capture.starting')}</p>
                </div>
              )}
              {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 p-6 text-center">
                  <AlertTriangle size={36} />
                  <p className="text-sm font-bold leading-relaxed">{errorMsg}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={handleCancel} className="sketch-button bg-white text-blue-950 font-bold px-6">
            {t('camera_capture.cancel')}
          </button>

          <div className="flex items-center gap-3">
            {snapshot ? (
              <>
                <button
                  onClick={handleRetake}
                  className="sketch-button bg-white text-blue-950 font-bold px-6 flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  {t('camera_capture.retake')}
                </button>
                <button
                  onClick={handleUse}
                  className="sketch-button bg-blue-950 text-white font-bold px-8 flex items-center gap-2"
                >
                  <Check size={18} />
                  {t('camera_capture.use_photo')}
                </button>
              </>
            ) : (
              <>
                {hasMultipleCameras && status === 'ready' && (
                  <button
                    onClick={handleSwitchCamera}
                    title={t('camera_capture.switch_camera')}
                    className="sketch-button bg-white text-blue-950 font-bold px-4 flex items-center gap-2"
                  >
                    <SwitchCamera size={18} />
                  </button>
                )}
                {status === 'error' ? (
                  <button
                    onClick={() => startStream(facingMode)}
                    className="sketch-button bg-blue-950 text-white font-bold px-8 flex items-center gap-2"
                  >
                    <RotateCcw size={18} />
                    {t('camera_capture.retry')}
                  </button>
                ) : (
                  <button
                    onClick={handleCapture}
                    disabled={status !== 'ready'}
                    className="sketch-button bg-blue-950 text-white font-bold px-8 flex items-center gap-2 disabled:opacity-40"
                  >
                    <Camera size={18} />
                    {t('camera_capture.capture')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
