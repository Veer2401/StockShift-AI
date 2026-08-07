"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/_lib/auth-context";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Label } from "@/_components/ui/label";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setIsLoading(true);
      setError(null);
      await login(email, password, "admin");
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6" style={{ fontSize: '1.05rem', paddingTop: '10vh', paddingBottom: '10vh' }}>
      {/* Top spotlight gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0">
        <div className="h-52 w-full rounded-b-[999px] bg-gradient-to-b from-[#B8FFD0] to-[#FFF6C9] blur-2xl opacity-100 spotlight-animate" />
      </div>
      {/* Bottom spotlight gradient — shorter */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
        <div className="h-28 w-full rounded-t-[999px] bg-gradient-to-t from-[#B8FFD0] to-[#FFF6C9] blur-2xl opacity-100 spotlight-animate" />
      </div>

      {/* ───── Full-height card with sign-in form ───── */}
      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col justify-center rounded-2xl border border-white/20 bg-card/60 text-card-foreground shadow-lg backdrop-blur-xl">
        <div className="px-6 py-10 sm:px-8 sm:py-14">
          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-xl font-medium text-foreground sm:text-2xl">
              Sign in to StockShiftAI
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your credentials to access the dashboard
            </p>
          </div>

          {/* Sign-in form */}
          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}

            {/* Back to home */}
            <div className="pt-2 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
