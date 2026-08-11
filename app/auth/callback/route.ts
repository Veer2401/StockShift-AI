import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin/dashboard";

  if (code) {
    const cookieStore = cookies();

    // Handle proxy hosts (e.g., Netlify/Vercel/Custom domains)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const redirectBase = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : origin;

    const targetUrl = `${redirectBase}${next.startsWith("/") ? next : `/${next}`}`;
    const response = NextResponse.redirect(targetUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // Ignore errors when calling from read-only contexts
              }
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }

    console.error("Supabase OAuth exchange error:", error);
    return NextResponse.redirect(
      `${redirectBase}/login?error=${encodeURIComponent(error.message || "Authentication failed")}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=Could%20not%20authenticate%20user`);
}

