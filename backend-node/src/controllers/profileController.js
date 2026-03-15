import { getProfileForUser, upsertProfileForUser, validateProfileInput } from "../services/profileService.js";

export async function getProfile(req, res, next) {
  try {
    const profile = await getProfileForUser(req.auth.userId);
    return res.json({
      status: "success",
      profile
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

export async function updateProfile(req, res, next) {
  try {
    const validationError = validateProfileInput(req.body || {});
    if (validationError) {
      return res.status(400).json({
        status: "error",
        message: validationError
      });
    }

    const profile = await upsertProfileForUser(req.auth.userId, req.body || {});
    return res.json({
      status: "success",
      profile
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
