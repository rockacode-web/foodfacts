import {
  getUserProfile,
  loginUser,
  registerUser,
  validateLoginInput,
  validateRegistrationInput
} from "../services/authService.js";

export async function register(req, res, next) {
  try {
    const validationError = validateRegistrationInput(req.body || {});
    if (validationError) {
      return res.status(400).json({
        status: "error",
        message: validationError
      });
    }

    const result = await registerUser(req.body);
    return res.status(201).json({
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

export async function login(req, res, next) {
  try {
    const validationError = validateLoginInput(req.body || {});
    if (validationError) {
      return res.status(400).json({
        status: "error",
        message: validationError
      });
    }

    const result = await loginUser(req.body);
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

export async function me(req, res, next) {
  try {
    const user = await getUserProfile(req.auth.userId);
    return res.json({
      status: "success",
      user
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
