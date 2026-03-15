import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearStoredSession, getStoredToken, getStoredUser, storeSession } from "./storage";
import { getCurrentUser, loginUser, registerUser } from "../services/api";
import type { AuthUser } from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const existingToken = getStoredToken();
      if (!existingToken) {
        setIsInitializing(false);
        return;
      }

      try {
        const restoredUser = await getCurrentUser();
        storeSession(existingToken, restoredUser);
        setToken(existingToken);
        setUser(restoredUser);
      } catch {
        clearStoredSession();
        setToken(null);
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    };

    void restoreSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isInitializing,
      async login(input) {
        const response = await loginUser(input);
        storeSession(response.token, response.user);
        setToken(response.token);
        setUser(response.user);
      },
      async register(input) {
        const response = await registerUser(input);
        storeSession(response.token, response.user);
        setToken(response.token);
        setUser(response.user);
      },
      logout() {
        clearStoredSession();
        setToken(null);
        setUser(null);
      }
    }),
    [isInitializing, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
