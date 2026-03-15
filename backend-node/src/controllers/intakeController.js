import {
  createDailyIntakeEntryForUser,
  deleteDailyIntakeEntryForUser,
  getTodayIntakeForUser
} from "../services/intakeService.js";

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parsePositiveServings(value) {
  if (value == null || value === "") {
    return 1;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

export async function createIntakeEntry(req, res, next) {
  try {
    const scanId = parsePositiveInteger(req.body?.scanId);
    const servings = parsePositiveServings(req.body?.servings);

    if (!scanId) {
      return res.status(400).json({
        status: "error",
        message: "A valid scanId is required."
      });
    }

    if (!servings) {
      return res.status(400).json({
        status: "error",
        message: "Servings must be a positive number."
      });
    }

    const entry = await createDailyIntakeEntryForUser({
      userId: req.auth.userId,
      scanId,
      servings
    });

    return res.status(201).json({
      status: "success",
      entry
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message
      });
    }
    return next(error);
  }
}

export async function getTodayIntake(req, res, next) {
  try {
    const intake = await getTodayIntakeForUser(req.auth.userId);
    return res.json({
      status: "success",
      ...intake
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteIntakeEntry(req, res, next) {
  try {
    const entryId = parsePositiveInteger(req.params.id);
    if (!entryId) {
      return res.status(404).json({
        status: "error",
        message: "Intake entry not found."
      });
    }

    const result = await deleteDailyIntakeEntryForUser(entryId, req.auth.userId);
    return res.json({
      status: "success",
      ...result
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message
      });
    }
    return next(error);
  }
}
