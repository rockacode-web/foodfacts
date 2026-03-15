import { prisma } from "../utils/prisma.js";
import { comparePassword, hashPassword } from "../utils/passwords.js";
import { createAuthToken } from "../utils/jwt.js";

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validateRegistrationInput({ name, email, password }) {
  if (!String(name || "").trim()) {
    return "Name is required.";
  }
  if (!normalizeEmail(email)) {
    return "Email is required.";
  }
  if (!String(password || "").trim() || String(password).length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function validateLoginInput({ email, password }) {
  if (!normalizeEmail(email)) {
    return "Email is required.";
  }
  if (!String(password || "").trim()) {
    return "Password is required.";
  }
  return null;
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    const error = new Error("An account with that email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash
    }
  });

  return {
    token: createAuthToken(user.id),
    user: sanitizeUser(user)
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  return {
    token: createAuthToken(user.id),
    user: sanitizeUser(user)
  };
}

export async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 401;
    throw error;
  }

  return sanitizeUser(user);
}
