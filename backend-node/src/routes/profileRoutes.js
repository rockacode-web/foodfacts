import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";

export function createProfileRouter() {
  const router = Router();

  router.get("/", requireAuth, getProfile);
  router.put("/", requireAuth, updateProfile);

  return router;
}
