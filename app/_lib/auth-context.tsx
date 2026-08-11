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
  updateProfile: (data: { name?: string; companyName?: string; state?: string; city?: string }) => Promise<void>;
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
        const isComplete = Boolean(
          profile.onboarding_completed ||
            (profile.company_name && profile.state && profile.city)
        );
        setUser({
          ...baseUser,
          name: profile.full_name || baseUser.name,
          avatar: profile.avatar_url || baseUser.avatar,
          companyName: profile.company_name || undefined,
          state: profile.state || undefined,
          city: profile.city || undefined,
          onboardingCompleted: isComplete,
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
    } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
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
    async (data: { name?: string; companyName?: string; state?: string; city?: string }) => {
      if (!user) return;

      const updates: any = {
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) updates.full_name = data.name;
      if (data.companyName !== undefined) updates.company_name = data.companyName;
      if (data.state !== undefined) updates.state = data.state;
      if (data.city !== undefined) updates.city = data.city;

      // Mark onboarding as completed when company, state, city are present
      const isNowComplete = Boolean(
        data.companyName || user.companyName
      ) && Boolean(data.state || user.state) && Boolean(data.city || user.city);

      if (isNowComplete) {
        updates.onboarding_completed = true;
      }

      const { error } = await supabase.from("profiles").upsert(updates);

      if (error) {
        throw new Error(error.message);
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: data.name !== undefined ? data.name : prev.name,
              companyName: data.companyName !== undefined ? data.companyName : prev.companyName,
              state: data.state !== undefined ? data.state : prev.state,
              city: data.city !== undefined ? data.city : prev.city,
              onboardingCompleted: isNowComplete || prev.onboardingCompleted,
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
