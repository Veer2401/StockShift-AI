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
import { createClient } from "./supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role?: "admin") => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  updateProfile: (data: { companyName: string; state: string; city: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapSupabaseUser(sbUser: SupabaseUser): User {
  return {
    id: sbUser.id,
    email: sbUser.email || "",
    name:
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      sbUser.email?.split("@")[0] ||
      "User",
    role: "admin",
    avatar: sbUser.user_metadata?.avatar_url,
    onboardingCompleted: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Sync user profile with 'profiles' table in Supabase Database
  const syncUserProfile = async (sbUser: SupabaseUser) => {
    try {
      const baseUser = mapSupabaseUser(sbUser);

      // Check existing profile in database
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, state, city, onboarding_completed, full_name, avatar_url")
        .eq("id", sbUser.id)
        .maybeSingle();

      if (profile) {
        setUser({
          ...baseUser,
          name: profile.full_name || baseUser.name,
          avatar: profile.avatar_url || baseUser.avatar,
          companyName: profile.company_name || undefined,
          state: profile.state || undefined,
          city: profile.city || undefined,
          onboardingCompleted: !!profile.onboarding_completed,
        });
      } else {
        // Upsert new profile record
        await supabase.from("profiles").upsert(
          {
            id: sbUser.id,
            email: sbUser.email,
            full_name: baseUser.name,
            avatar_url: baseUser.avatar || null,
            onboarding_completed: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        setUser(baseUser);
      }
    } catch (e) {
      console.warn("Profile sync error:", e);
      setUser(mapSupabaseUser(sbUser));
    }
  };

  useEffect(() => {
    // 1. Get initial session
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          await syncUserProfile(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Supabase auth session error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // 2. Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await syncUserProfile(session.user);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, _role?: "admin") => {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setIsLoading(false);
        throw new Error(error.message);
      }
    },
    [supabase]
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      setIsLoading(true);
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || email.split("@")[0],
          },
        },
      });
      if (error) {
        setIsLoading(false);
        throw new Error(error.message);
      }
      if (data.user && !data.session) {
        setIsLoading(false);
        throw new Error("Verification link sent! Please check your email to confirm your account.");
      }
    },
    [supabase]
  );

  const loginWithGoogle = useCallback(async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  }, [supabase]);

  const updateProfile = useCallback(
    async (data: { companyName: string; state: string; city: string }) => {
      if (!user) return;

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        company_name: data.companyName,
        state: data.state,
        city: data.city,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(error.message);
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              companyName: data.companyName,
              state: data.state,
              city: data.city,
              onboardingCompleted: true,
            }
          : null
      );
    },
    [supabase, user]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsLoading(false);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        loginWithGoogle,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
