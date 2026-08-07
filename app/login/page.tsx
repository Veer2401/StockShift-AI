"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/_lib/auth-context";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import Link from "next/link";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError = searchParams.get("error");

  const { login, signup, loginWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setIsLoading(true);
      setError(null);
      setMessage(null);

      if (isSignUp) {
        await signup(email, password, name);
        setMessage("Account created! Please check your email to verify your account before logging in.");
      } else {
        await login(email, password);
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setError(null);
      setMessage(null);
      await loginWithGoogle();
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">
          {isSignUp ? "Create an Account" : "Sign in to StockShiftAI"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignUp
            ? "Enter your details below to get started"
            : "Enter your credentials or use Google to sign in"}
        </p>
      </div>

      {/* Social Sign In Button */}
      <div className="mb-6 space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-3 py-5 font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>

        <div className="relative flex items-center justify-center py-2">
          <div className="w-full border-t border-muted" />
          <span className="absolute bg-card px-3 text-xs uppercase text-muted-foreground tracking-wider">
            Or with email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={isSignUp}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full py-5" disabled={isLoading || isGoogleLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading
            ? isSignUp
              ? "Creating Account..."
              : "Signing in..."
            : isSignUp
            ? "Sign Up"
            : "Sign In"}
        </Button>
      </form>

      {/* Status Messages */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-500">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Toggle Sign In / Sign Up */}
      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
            setMessage(null);
          }}
          className="font-semibold text-primary hover:underline"
        >
          {isSignUp ? "Sign In" : "Sign Up"}
        </button>
      </div>

      {/* Back to Home Link */}
      <div className="pt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6"
      style={{ fontSize: "1.05rem", paddingTop: "8vh", paddingBottom: "8vh" }}
    >
      {/* Top spotlight gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0">
        <div className="h-52 w-full rounded-b-[999px] bg-gradient-to-b from-[#B8FFD0] to-[#FFF6C9] blur-2xl opacity-100 spotlight-animate" />
      </div>
      {/* Bottom spotlight gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
        <div className="h-28 w-full rounded-t-[999px] bg-gradient-to-t from-[#B8FFD0] to-[#FFF6C9] blur-2xl opacity-100 spotlight-animate" />
      </div>

      {/* Card container */}
      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col justify-center rounded-2xl border border-white/20 bg-card/70 text-card-foreground shadow-xl backdrop-blur-xl">
        <Suspense fallback={
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
