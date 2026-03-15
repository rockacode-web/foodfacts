import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "scan-images");

function extensionFromFile(file) {
  const originalExtension = path.extname(file?.originalname || "");
  if (originalExtension) {
    return originalExtension.toLowerCase();
  }

  const mimeType = file?.mimetype || "";
  if (mimeType.includes("png")) {
    return ".png";
  }
  if (mimeType.includes("webp")) {
    return ".webp";
  }
  if (mimeType.includes("gif")) {
    return ".gif";
  }
  return ".jpg";
}

function safeBaseName(fileName) {
  return String(fileName || "scan")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "scan";
}

export async function saveScanImage(file) {
  if (!file?.buffer?.length) {
    throw new Error("Cannot store an empty uploaded image.");
  }

  await fs.mkdir(UPLOAD_ROOT, { recursive: true });

  const filename = `${Date.now()}-${safeBaseName(file.originalname)}-${randomUUID()}${extensionFromFile(file)}`;
  const absolutePath = path.join(UPLOAD_ROOT, filename);

  await fs.writeFile(absolutePath, file.buffer);

  return {
    absolutePath,
    relativePath: path.posix.join("uploads", "scan-images", filename)
  };
}

export async function deleteStoredImage(relativePath) {
  if (!relativePath) {
    return;
  }

  const absolutePath = path.resolve(process.cwd(), relativePath);
  await fs.unlink(absolutePath).catch(() => {});
}
