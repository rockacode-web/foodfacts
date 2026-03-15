import { Router } from "express";
import { analyzeScan } from "../controllers/scanController.js";
import { deleteStoredScan, getScanHistory, getStoredScan } from "../controllers/scanRecordsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export function createScanRouter(upload) {
  const router = Router();

  router.post("/analyze", requireAuth, upload.single("file"), analyzeScan);
  router.post("/analyze-image", requireAuth, upload.single("file"), analyzeScan);
  router.post("/identify-product", requireAuth, upload.single("file"), analyzeScan);
  router.post("/generate-recipes", requireAuth, upload.single("file"), analyzeScan);
  router.get("/history", requireAuth, getScanHistory);
  router.get("/test", (_req, res) => {
    res.json({ status: "ok", scanMethod: "openai-vision" });
  });
  router.get("/:id", requireAuth, getStoredScan);
  router.delete("/:id", requireAuth, deleteStoredScan);

  return router;
}
