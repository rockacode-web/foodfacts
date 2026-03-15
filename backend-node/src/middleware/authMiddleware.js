import { verifyAuthToken } from "../utils/jwt.js";
import { getUserProfile } from "../services/authService.js";

function unauthorized(res, message = "Authentication required.") {
  return res.status(401).json({
    status: "error",
    message
  });
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return unauthorized(res, "Missing or invalid Authorization header.");
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch (_error) {
    return unauthorized(res, "Invalid or expired authentication token.");
  }

  const userId = Number(payload?.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return unauthorized(res, "Invalid authentication token.");
  }

  try {
    const user = await getUserProfile(userId);
    req.auth = {
      userId,
      user
    };
    return next();
  } catch (error) {
    if (error?.statusCode === 401) {
      return unauthorized(res, "Invalid or expired authentication token.");
    }
    return next(error);
  }
}
