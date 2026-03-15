import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { createIntakeEntry, deleteIntakeEntry, getTodayIntake } from "../controllers/intakeController.js";

export function createIntakeRouter() {
  const router = Router();

  router.post("/", requireAuth, createIntakeEntry);
  router.get("/today", requireAuth, getTodayIntake);
  router.delete("/:id", requireAuth, deleteIntakeEntry);

  return router;
}
