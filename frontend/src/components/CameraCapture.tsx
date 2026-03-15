import { useCallback, useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  onCapture: (file: File | null) => void;
  onError?: (message: string) => void;
}

const CameraCapture = ({ onCapture, onError }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null
  );
  const [capturedFileName, setCapturedFileName] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [startingCamera, setStartingCamera] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const setError = useCallback(
    (message: string) => {
      setCameraError(message);
      onError?.(message);
    },
    [onError]
  );

  const getFriendlyError = (error: unknown) => {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        return "Camera permission denied. Please allow camera access and try again.";
      }
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        return "No camera available on this device.";
      }
      if (error.name === "NotReadableError" || error.name === "AbortError") {
        return "Camera failed to start. Close other apps using the camera and retry.";
      }
    }

    return "Unable to start camera.";
  };

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("No camera available in this browser.");
      return;
    }

    setStartingCamera(true);
    setCameraError("");
    onError?.("");

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (stream.getVideoTracks().length === 0) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setError("No camera available on this device.");
        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setError("Camera preview unavailable.");
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (error) {
      setError(getFriendlyError(error));
    } finally {
      setStartingCamera(false);
    }
  }, [onError, setError, stopCamera]);

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Unable to capture image.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;

    // Focus OCR on the center where the nutrition label is expected to be.
    const cropWidth = Math.floor(sourceWidth * 0.84);
    const cropHeight = Math.floor(sourceHeight * 0.72);
    const cropX = Math.floor((sourceWidth - cropWidth) / 2);
    const cropY = Math.floor((sourceHeight - cropHeight) / 2);

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to capture image.");
      return;
    }

    context.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob) {
      setError("Capture failed. Please retry.");
      return;
    }

    const filename = `camera-capture-${Date.now()}.jpg`;
    const file = new File([blob], filename, { type: "image/jpeg" });

    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }

    setCapturedPreviewUrl(URL.createObjectURL(blob));
    setCapturedFileName(filename);
    setShowGuide(false);
    onCapture(file);
    stopCamera();
  };

  const handleRetake = async () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedPreviewUrl(null);
    setCapturedFileName(null);
    setShowGuide(true);
    onCapture(null);
    await startCamera();
  };

  useEffect(() => {
    void startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  return (
    <div style={styles.wrapper}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!capturedPreviewUrl && (
        <div style={styles.videoShell}>
          <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
          {showGuide && <div style={styles.guideBox} aria-hidden="true" />}
        </div>
      )}

      {capturedPreviewUrl && (
        <img
          src={capturedPreviewUrl}
          alt="Captured nutrition label"
          style={styles.preview}
        />
      )}

      {capturedFileName && <p style={styles.fileName}>Captured: {capturedFileName}</p>}
      {!capturedPreviewUrl && (
        <p style={styles.tip}>
          Tip: move close so the nutrition label fills the guide box.
        </p>
      )}

      <div style={styles.controls}>
        {!capturedPreviewUrl ? (
          <>
            <button
              type="button"
              onClick={captureFrame}
              style={styles.button}
              disabled={startingCamera}
            >
              Capture Label
            </button>
            <button
              type="button"
              onClick={startCamera}
              style={styles.secondaryButton}
              disabled={startingCamera}
            >
              {startingCamera ? "Starting..." : "Restart Camera"}
            </button>
          </>
        ) : (
          <button type="button" onClick={handleRetake} style={styles.secondaryButton}>
            Retake
          </button>
        )}
      </div>

      {cameraError && <p style={styles.error}>{cameraError}</p>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginTop: "14px",
  },
  video: {
    width: "100%",
    borderRadius: "10px",
    background: "#111827",
    minHeight: "220px",
    objectFit: "cover",
  },
  videoShell: {
    position: "relative",
  },
  guideBox: {
    position: "absolute",
    left: "8%",
    top: "14%",
    width: "84%",
    height: "72%",
    border: "2px solid rgba(255,255,255,0.95)",
    borderRadius: "10px",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.24)",
    pointerEvents: "none",
  },
  preview: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
  },
  controls: {
    display: "flex",
    gap: "8px",
    marginTop: "10px",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 14px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
  },
  fileName: {
    marginTop: "8px",
    fontSize: "13px",
  },
  tip: {
    marginTop: "8px",
    marginBottom: "0",
    fontSize: "13px",
    color: "#374151",
  },
  error: {
    marginTop: "10px",
    color: "#b91c1c",
    fontSize: "14px",
  },
};

export default CameraCapture;
