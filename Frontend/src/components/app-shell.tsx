import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { CalendarDays, Home, Package, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/hooks/use-auth";
import { marketingUrl } from "@/lib/site-hosts";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home, match: (p: string) => p === "/dashboard" || p === "/dashboard/" },
  { href: "/schedule-pickup", label: "Book", icon: CalendarDays, match: (p: string) => p.startsWith("/schedule-pickup") },
  { href: "/dashboard/orders", label: "Orders", icon: Package, match: (p: string) => p.startsWith("/dashboard/orders") || p.startsWith("/dashboard/track") },
  { href: "/dashboard/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/dashboard/profile") || p.startsWith("/dashboard/bookings") || p.startsWith("/dashboard/wallet") },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const hideTabs =
    location.startsWith("/login") ||
    location.startsWith("/welcome") ||
    location.startsWith("/register");

  return (
    <div className="site-frame min-h-screen bg-[radial-gradient(circle_at_top,_#eef5f2,_#e6ece9_45%,_#dde6e2)]">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-panel/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href={isAuthenticated ? "/dashboard" : "/login"} className="flex items-center gap-2">
            <BrandLogo imgClassName="h-8 w-auto" />
          </Link>
          <a
            href={marketingUrl("/")}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
          >
            Marketing site
          </a>
        </div>
      </header>

      <main className={cn("mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-lg px-4 pb-24 pt-4")}>{children}</main>

      {!hideTabs ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-panel/95 backdrop-blur-md">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.match(location);
              const href = !isAuthenticated && tab.href.startsWith("/dashboard") ? "/login" : tab.href;
              return (
                <Link
                  key={tab.href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                    active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
