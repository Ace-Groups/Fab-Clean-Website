import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Menu, X, User, LogOut, ChevronDown, Loader2 } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { fetchStores, type Store } from "@/lib/public-api";
import { useGetProfile } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";

function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const { logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetProfile({
    query: {
      enabled: isAuthenticated,
      retry: false
    } as any
  });

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="sm" 
        className="gap-2 rounded-full border border-line bg-panel/50 pr-2"
        onClick={() => setOpen(!open)}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <User className="h-4 w-4 text-primary" />
        )}
        <span className="max-w-[100px] truncate text-sm font-medium">
          {profile?.data?.name || "Account"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </Button>
      
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-48 overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
            >
              <div className="flex flex-col p-1">
                <div className="px-3 py-2 border-b border-line mb-1">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="truncate text-sm font-medium">{profile?.data?.phone || "Customer"}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start rounded-xl px-3 font-normal"
                  onClick={() => {
                    setOpen(false);
                    setLocation("/dashboard");
                  }}
                >
                  <User className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start rounded-xl px-3 font-normal"
                  onClick={() => {
                    setOpen(false);
                    setLocation("/dashboard/orders");
                  }}
                >
                  Order History
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start rounded-xl px-3 font-normal"
                  onClick={() => {
                    setOpen(false);
                    setLocation("/dashboard/bookings");
                  }}
                >
                  Booking History
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start rounded-xl px-3 font-normal text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const NAV_LINKS = [
  { name: "Home", path: "/" },
  { name: "Services", path: "/services" },
  { name: "Pricing", path: "/pricing" },
  { name: "Reviews", path: "/reviews" },
  { name: "Track Order", path: "/track-order" },
  { name: "Contact", path: "/contact" },
];

function isActivePath(location: string, path: string) {
  return location === path || (path !== "/" && location.startsWith(path));
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div
        className={cn(
          "mx-auto max-w-[1320px] border px-4 py-3 transition-all sm:px-6",
          open
            ? "rounded-[2rem] border-line bg-panel shadow-2xl"
            : isScrolled
              ? "rounded-full border-line bg-panel/88 shadow-[0_18px_45px_rgba(23,20,18,0.08)] backdrop-blur-xl"
              : "rounded-full border-transparent bg-transparent",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" data-cursor-label="Home">
            <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Fab Clean" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Premium care</p>
              <p className="font-medium text-ink">{BRAND.name}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => {
              const active = isActivePath(location, item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/book_now" data-cursor-label="Diwali Offer">
              <Button size="sm" className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white border-none shadow-sm gap-1.5 font-medium">
                <span>🪔</span>
                <span>Diwali 50% Off</span>
              </Button>
            </Link>
            {isAuthenticated ? (
              <ProfileDropdown />
            ) : (
              <Link href="/login" data-cursor-label="Login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
            )}
            <Link href="/schedule-pickup" data-cursor-label="Book">
              <Button size="sm" variant="outline">Book Pickup</Button>
            </Link>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-ink lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4 rounded-[1.75rem] border border-line bg-panel p-4 lg:hidden"
            >
              <div className="grid gap-2">
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "rounded-[1.2rem] px-4 py-3 text-sm",
                      isActivePath(location, item.path) ? "bg-primary/10 text-primary" : "text-ink",
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {isAuthenticated ? (
                  <div className="flex w-full flex-col gap-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left" 
                      onClick={() => setLocation("/dashboard")}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-left text-red-500 hover:text-red-600 hover:bg-red-50" 
                      onClick={() => logout()}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <Link href="/login">
                    <Button variant="ghost" className="w-full">Login</Button>
                  </Link>
                )}
                <Link href="/book_now">
                  <Button className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white gap-2 font-bold mb-2">
                    <span>🪔</span>
                    <span>Diwali Special (50% Off)</span>
                  </Button>
                </Link>
                <Link href="/schedule-pickup">
                  <Button variant="outline" className="w-full">Regular Pickup</Button>
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

export function Footer() {
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    void fetchStores()
      .then((res) => {
        if (res.success) setStores(res.data);
      })
      .catch(() => setStores([]));
  }, []);

  return (
    <footer className="mt-24 border-t border-line bg-deep text-white">
      <div className="container-wide py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Fab Clean" className="h-10 w-auto" />
            <p className="mt-5 max-w-lg text-base leading-8 text-white/68">{BRAND.shortBlurb}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={BRAND.phoneHref}><Button size="sm">{BRAND.phoneMain}</Button></a>
              <a href={BRAND.whatsappHref} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="border-white/16 bg-white/8 text-white hover:bg-white/14">
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/45">Explore</p>
            <div className="mt-5 grid gap-3 text-sm text-white/72">
              {NAV_LINKS.map((item) => (
                <Link key={item.path} href={item.path} className="hover:text-white">{item.name}</Link>
              ))}
              <Link href="/schedule-pickup" className="hover:text-white">Schedule Pickup</Link>
              <Link href="/dashboard/orders" className="hover:text-white">Customer Portal</Link>
            </div>
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/45">Branches</p>
            <div className="mt-5 space-y-5">
              {stores.map((branch) => (
                <div key={branch.slug}>
                  <div className="flex items-center gap-2 text-white">
                    <MapPin className="h-4 w-4 text-primary-light" />
                    <p className="font-medium">{branch.name}</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/60">{branch.address}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/refund" className="hover:text-white">Refund</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);

  const showFAB = !location.startsWith("/schedule-pickup") && !location.startsWith("/dashboard");

  return (
    <div className="site-frame min-h-screen relative pb-6">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <Footer />

      <AnimatePresence>
        {showFAB && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="fixed bottom-6 right-6 z-40 md:hidden"
          >
            <Link href="/schedule-pickup">
              <Button className="h-14 rounded-full px-6 shadow-[0_12px_24px_rgba(181,138,68,0.3)] text-[15px] tracking-wide font-medium">
                Book Pickup
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
