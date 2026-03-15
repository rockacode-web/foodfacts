import jwt from "jsonwebtoken";
import { getRequiredEnv } from "../config/env.js";

const TOKEN_TTL = "7d";

export function createAuthToken(userId) {
  return jwt.sign({ sub: String(userId) }, getRequiredEnv("JWT_SECRET"), {
    expiresIn: TOKEN_TTL
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getRequiredEnv("JWT_SECRET"));
}
