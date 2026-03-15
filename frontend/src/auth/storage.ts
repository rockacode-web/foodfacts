import type { AuthUser } from "../types";

const TOKEN_STORAGE_KEY = "foodfacts.auth.token";
const USER_STORAGE_KEY = "foodfacts.auth.user";

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  const rawValue = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
