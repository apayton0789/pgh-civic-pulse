import { useHashLocation } from "wouter/use-hash-location";
import {
  Zap,
  RefreshCw,
  MessageSquare,
  Target,
  PenTool,
  Eye,
  FileSearch,
  CalendarPlus,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { GetUpdatesButton } from "@/components/get-updates-button";
import { useEffect, useState } from "react";

const navItems = [
  { path: "/", label: "Today", icon: Zap },
  { path: "/changed", label: "What Changed", icon: RefreshCw },
  { path: "/feedback", label: "Take Action", icon: MessageSquare },
  { path: "/draft", label: "Draft Response", icon: PenTool },
  { path: "/monitoring", label: "Monitoring", icon: Eye },
  { path: "/sources", label: "Source Trail", icon: FileSearch },
  { path: "/calendar", label: "Calendar", icon: CalendarPlus },
];

export function SidebarNav() {
  const [location, setLocation] = useHashLocation();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [dark]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo / Title */}
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">
            PGH <span className="text-[hsl(var(--sidebar-primary))]">Civic Pulse</span>
          </h1>
          <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">
            Pittsburgh Governance Dashboard
          </p>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          data-testid="button-close-sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location === "/" || location === ""
              : location.startsWith(item.path);

          return (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={() => setLocation(item.path)}
              className={cn(
                "flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-[hsl(var(--sidebar-primary))]"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Get Updates (triggers the GitHub Actions data refresh) */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <GetUpdatesButton />
      </div>

      {/* Dark mode toggle */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <button
          data-testid="dark-mode-toggle"
          onClick={() => setDark(!dark)}
          className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Attribution */}
      <div className="border-t border-sidebar-border">
        <PerplexityAttribution />
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile Top Bar ─────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-[1000] flex items-center gap-3 px-3 py-2.5 bg-sidebar text-sidebar-foreground border-b border-sidebar-border"
        data-testid="mobile-topbar"
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent/50"
          data-testid="button-open-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-bold tracking-tight">
          PGH <span className="text-[hsl(var(--sidebar-primary))]">Civic Pulse</span>
        </h1>
        <button
          data-testid="mobile-dark-toggle"
          onClick={() => setDark(!dark)}
          className="ml-auto p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Mobile Drawer Overlay ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[9999]"
          data-testid="mobile-drawer-overlay"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl"
            data-testid="mobile-drawer"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Desktop Sidebar (hidden on mobile) ─────────────────── */}
      <aside
        data-testid="sidebar-nav"
        className="hidden md:flex flex-col h-screen w-56 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
