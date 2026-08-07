"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User } from "./types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role: "admin") => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY_USER = "stockshiftai_user";

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, _password: string, role: "admin") => {
      const localUser: User = {
        id: "local-admin-user",
        name: "Admin User",
        email,
        role,
      };
      setUser(localUser);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(localUser));
    },
    []
  );

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <LocalAuthProvider>{children}</LocalAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
