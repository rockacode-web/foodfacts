import { prisma } from "../utils/prisma.js";

const ALLOWED_GENDERS = new Set([
  "female",
  "male",
  "non_binary",
  "prefer_not_to_say",
  "other"
]);

function createUnauthorizedError(message) {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function normalizeOptionalNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return parsed;
}

function normalizeOptionalInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return Number.NaN;
  }

  return parsed;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeGender(value) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  if (!ALLOWED_GENDERS.has(normalized)) {
    return null;
  }

  return normalized;
}

function sanitizeProfile(profile, userId) {
  return {
    userId,
    age: profile?.age ?? null,
    weightKg: profile?.weightKg ?? null,
    heightCm: profile?.heightCm ?? null,
    gender: profile?.gender ?? null,
    diabetes: Boolean(profile?.diabetes),
    hypertension: Boolean(profile?.hypertension),
    highCholesterol: Boolean(profile?.highCholesterol),
    kidneyDisease: Boolean(profile?.kidneyDisease),
    lowSodiumGoal: Boolean(profile?.lowSodiumGoal),
    lowSugarGoal: Boolean(profile?.lowSugarGoal),
    heartHealthyGoal: Boolean(profile?.heartHealthyGoal),
    createdAt: profile?.createdAt ?? null,
    updatedAt: profile?.updatedAt ?? null
  };
}

export function validateProfileInput(payload) {
  const age = normalizeOptionalInteger(payload?.age);
  if (Number.isNaN(age) || (age != null && (age < 1 || age > 120))) {
    return "Age must be a whole number between 1 and 120.";
  }

  const weightKg = normalizeOptionalNumber(payload?.weightKg);
  if (Number.isNaN(weightKg) || (weightKg != null && (weightKg < 20 || weightKg > 400))) {
    return "Weight must be a number between 20 and 400 kilograms.";
  }

  const heightCm = normalizeOptionalNumber(payload?.heightCm);
  if (Number.isNaN(heightCm) || (heightCm != null && (heightCm < 80 || heightCm > 260))) {
    return "Height must be a number between 80 and 260 centimeters.";
  }

  if (payload?.gender != null && payload.gender !== "" && normalizeGender(payload.gender) == null) {
    return "Gender must be one of: female, male, non_binary, prefer_not_to_say, other.";
  }

  return null;
}

function mapProfileInput(payload) {
  return {
    age: normalizeOptionalInteger(payload?.age),
    weightKg: normalizeOptionalNumber(payload?.weightKg),
    heightCm: normalizeOptionalNumber(payload?.heightCm),
    gender: normalizeGender(payload?.gender),
    diabetes: normalizeBoolean(payload?.diabetes),
    hypertension: normalizeBoolean(payload?.hypertension),
    highCholesterol: normalizeBoolean(payload?.highCholesterol),
    kidneyDisease: normalizeBoolean(payload?.kidneyDisease),
    lowSodiumGoal: normalizeBoolean(payload?.lowSodiumGoal),
    lowSugarGoal: normalizeBoolean(payload?.lowSugarGoal),
    heartHealthyGoal: normalizeBoolean(payload?.heartHealthyGoal)
  };
}

async function ensureUserExists(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!user) {
    throw createUnauthorizedError("User not found.");
  }
}

export async function getProfileForUser(userId) {
  await ensureUserExists(userId);

  const profile = await prisma.userProfile.findUnique({
    where: { userId }
  });

  return sanitizeProfile(profile, userId);
}

export async function upsertProfileForUser(userId, payload) {
  await ensureUserExists(userId);

  const data = mapProfileInput(payload);
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...data
    },
    update: data
  });

  return sanitizeProfile(profile, userId);
}

export async function getProfileContextForUser(userId) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    return null;
  }

  return {
    conditions: {
      diabetes: Boolean(profile.diabetes),
      hypertension: Boolean(profile.hypertension),
      highCholesterol: Boolean(profile.highCholesterol),
      kidneyDisease: Boolean(profile.kidneyDisease)
    },
    goals: {
      lowSodiumGoal: Boolean(profile.lowSodiumGoal),
      lowSugarGoal: Boolean(profile.lowSugarGoal),
      heartHealthyGoal: Boolean(profile.heartHealthyGoal)
    },
    demographics: {
      age: profile.age ?? null,
      gender: profile.gender ?? null
    }
  };
}
