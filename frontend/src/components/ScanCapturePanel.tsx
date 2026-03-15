import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import CameraCapture from "./CameraCapture";
import { ApiError, analyzeScan } from "../services/api";
import type { ScanResponse } from "../types";

type InputMode = "upload" | "camera";

type ScanCapturePanelProps = {
  heading?: string;
  subtitle?: string;
  buttonLabel?: string;
  layout?: "standalone" | "dashboard";
  onAnalysisComplete?: (result: ScanResponse & { scanPreview: string }) => void;
  onUnauthorized?: () => void;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read image preview."));
    };
    reader.onerror = () => reject(new Error("Could not read image preview."));
    reader.readAsDataURL(file);
  });

const ScanCapturePanel = ({
  heading = "Scan a food label. Get instant healthy guidance.",
  subtitle = "Upload or capture a package label to receive nutrition interpretation, warnings, alternatives, and healthier swap ideas.",
  buttonLabel = "Analyze Label",
  layout = "standalone",
  onAnalysisComplete,
  onUnauthorized
}: ScanCapturePanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing label...");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setSelectedFile(null);
    setError("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError("");
  };

  const handleCapture = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setError("");
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError(
        inputMode === "upload"
          ? "Select a label photo to continue."
          : "Capture a photo before analyzing."
      );
      return;
    }

    setLoading(true);
    setError("");
    setLoadingMessage("Analyzing label...");
    const phaseTimer = window.setTimeout(
      () => setLoadingMessage("Generating health insights..."),
      1200
    );

    try {
      const [response, scanPreview] = await Promise.all([
        analyzeScan(selectedFile),
        fileToDataUrl(selectedFile).catch(() => "")
      ]);

      if (response.status === "success" && !response.nutrition) {
        setError("Scan completed but no analysis data was returned.");
        return;
      }

      if (response.status !== "success" || !response.nutrition) {
        throw new Error(response.message || "Scan failed.");
      }

      onAnalysisComplete?.({ ...response, scanPreview });
    } catch (scanError) {
      if (scanError instanceof ApiError && scanError.status === 401) {
        onUnauthorized?.();
        return;
      }

      const message =
        scanError instanceof Error ? scanError.message : "Failed to analyze image.";
      setError(message);
    } finally {
      window.clearTimeout(phaseTimer);
      setLoading(false);
    }
  };

  return (
    <div className={`scan-capture-panel ${layout}`}>
      <div className={layout === "dashboard" ? "dashboard-panel-copy" : undefined}>
        <div className="eyebrow">FoodFacts AI</div>
        <h1 className={layout === "dashboard" ? "panel-title" : "hero-title"}>{heading}</h1>
        <p className={layout === "dashboard" ? "panel-subtitle" : "hero-subtitle"}>{subtitle}</p>
      </div>

      <div className="mode-switch">
        <button
          type="button"
          className={`mode-pill ${inputMode === "upload" ? "active" : ""}`}
          onClick={() => handleModeChange("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          className={`mode-pill ${inputMode === "camera" ? "active" : ""}`}
          onClick={() => handleModeChange("camera")}
        >
          Camera
        </button>
      </div>

      {inputMode === "upload" && (
        <div className="upload-block">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button type="button" className="ghost-action" onClick={() => fileInputRef.current?.click()}>
            Choose Label Image
          </button>
        </div>
      )}

      {inputMode === "camera" && (
        <div className="camera-block">
          <CameraCapture onCapture={handleCapture} onError={setError} />
        </div>
      )}

      {previewUrl && (
        <div className="preview-card">
          <div className="preview-header">Scan Preview</div>
          <img src={previewUrl} alt="Selected label preview" className="preview-image" />
        </div>
      )}

      {selectedFile && <p className="selected-file">Selected file: {selectedFile.name}</p>}

      <button
        type="button"
        className={`primary-action ${layout === "dashboard" ? "dashboard-scan-action" : ""}`}
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? loadingMessage : buttonLabel}
      </button>

      {error && <div className="error-banner">{error}</div>}

      {!selectedFile && !loading && (
        <div className="empty-hint">
          Start with a clear image of the nutrition facts panel or full package front.
        </div>
      )}
    </div>
  );
};

export default ScanCapturePanel;
