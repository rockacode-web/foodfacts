import { Router } from "express";
import { login, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export function createAuthRouter() {
  const router = Router();

  router.post("/register", register);
  router.post("/login", login);
  router.get("/me", requireAuth, me);

  return router;
}
