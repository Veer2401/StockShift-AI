"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  FileText,
  Menu,
  X,
  LogOut,
  Settings,
  ChevronUp,
  DollarSign,
  Target,
  Warehouse,
  MapPin,
  Building2,
  Users,
  BarChart3,
  FileCode,
  ScanBarcode,
} from "lucide-react";
import { useAuth } from "@/_lib/auth-context";
import { BrandMark } from "@/_components/brand-mark";
import { cn } from "@/_lib/utils";
import { Button } from "@/_components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/_components/ui/avatar";
import { Separator } from "@/_components/ui/separator";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import { AiAgentWidget } from "./components/AiAgentWidget";

const sidebarSections = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Inventory", href: "/admin/inventory", icon: Package },
      { label: "Vendors", href: "/admin/vendors", icon: Users },
      { label: "Purchase Orders", href: "/admin/purchase-orders", icon: FileText },
      { label: "Documents RAG", href: "/admin/documents", icon: FileCode },
      { label: "POS Terminal", href: "/admin/pos-terminal", icon: ScanBarcode },
      { label: "Finance", href: "/admin/finance", icon: TrendingUp },
      { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    title: "AI Tools",
    items: [
      { label: "Cost Optimization", href: "/admin/cost-optimization", icon: DollarSign },
      { label: "Scenario Planning", href: "/admin/scenario-planning", icon: Target },
      { label: "Warehouse Optimization", href: "/admin/warehouse-optimization", icon: Warehouse },
    ],
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function BottomSection({
  pathname,
}: {
  pathname: string;
}) {
  const isSettingsActive = pathname.startsWith("/admin/settings");

  return (
    <div className="mt-auto border-t border-black/5 px-3 py-3">
      <Link
        href="/admin/settings"
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 select-none",
          isSettingsActive
            ? "bg-black/5 dark:bg-white/10 text-foreground font-semibold shadow-2xs"
            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
        )}
      >
        <Settings className="h-[18px] w-[18px] shrink-0" />
        <span>Settings</span>
      </Link>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /* Lenis smooth scroll on the admin main panel */
  useEffect(() => {
    const wrapper = mainRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
      autoRaf: true,
    });
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || user?.role !== "admin") {
        router.replace("/login");
      } else if (!user.onboardingCompleted && !user.companyName && pathname !== "/admin/onboarding") {
        // Redirect to onboarding only if profile/company setup is completely missing
        router.replace("/admin/onboarding");
      }
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  if (isLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  // If on onboarding screen, render fullscreen onboarding content without sidebar
  if (pathname === "/admin/onboarding") {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const SidebarContent = () => (
    <>
      {/* Sidebar header */}
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <BrandMark className="h-5 w-5" strokeClassName="text-foreground" />
          <span className="text-lg font-bold uppercase tracking-wide text-foreground">
            StockShiftAI
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-5 px-3 pt-4 overflow-y-auto">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 active:scale-[0.97] select-none",
                      isActive
                        ? "bg-black/5 dark:bg-white/10 text-foreground font-semibold shadow-2xs backdrop-blur-sm"
                        : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-150", isActive ? "text-foreground scale-105" : "text-muted-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section: Settings */}
      <BottomSection pathname={pathname} />
    </>
  );

  return (
    <div
      className="flex h-screen overflow-hidden text-foreground p-3 gap-3"
      style={{
        background: "linear-gradient(135deg, #B8FFD0 0%, #FFF6C9 100%)",
        fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — Desktop */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col rounded-3xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl shadow-sm border border-white/60 dark:border-white/10">
        <SidebarContent />
      </aside>

      {/* Sidebar — Mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl shadow-2xl transition-transform duration-300 ease-out md:hidden m-3 rounded-3xl border border-white/60",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl shadow-sm border border-white/60 dark:border-white/10">
        {/* Welcome header */}
        <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 border-b border-black/5 dark:border-white/10 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden active:scale-95"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-sm font-medium text-foreground tracking-tight">
              Welcome back, <span className="font-semibold text-foreground">{user?.name?.split(" ")[0] ?? "User"}</span>
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto min-h-0">
          <div ref={contentRef} className="p-4 pt-4 sm:p-6 sm:pt-6">
            {children}
          </div>
        </main>
      </div>

      {/* Global Autonomous ShiftAI Action Agent */}
      <AiAgentWidget />
    </div>
  );
}
