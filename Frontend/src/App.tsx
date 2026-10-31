import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { lazy, Suspense, useEffect } from "react";
import { PointerFeedbackProvider } from "@/components/site";
import { trackPageView } from "@/lib/analytics";

// Pages
const Home = lazy(() => import("@/pages/home"));
const Services = lazy(() => import("@/pages/services"));
const Pricing = lazy(() => import("@/pages/pricing"));
const About = lazy(() => import("@/pages/about"));
const Contact = lazy(() => import("@/pages/contact"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const SchedulePickup = lazy(() => import("@/pages/schedule-pickup"));
const BookNow = lazy(() => import("@/pages/book-now"));
const Dashboard = lazy(() => import("@/pages/dashboard/index"));
const TrackOrder = lazy(() => import("@/pages/track-order"));
const Feedback = lazy(() => import("@/pages/feedback"));
const Reviews = lazy(() => import("@/pages/reviews"));
const Sitemap = lazy(() => import("@/pages/sitemap"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const Cookies = lazy(() => import("@/pages/cookies"));
const Refund = lazy(() => import("@/pages/refund"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AnalyticsListener() {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AnalyticsListener />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/services" component={Services} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/schedule-pickup" component={SchedulePickup} />
        <Route path="/book_now" component={BookNow} />
        <Route path="/book-now" component={BookNow} />
        <Route path="/diwali" component={BookNow} />
        <Route path="/diwali-offer" component={BookNow} />
        <Route path="/track-order" component={TrackOrder} />
        <Route path="/track-order/:identifier" component={TrackOrder} />
        <Route path="/feedback" component={Feedback} />
        <Route path="/feedback/:identifier" component={Feedback} />
        <Route path="/reviews" component={Reviews} />
        
        {/* Dashboard routes use nested routing inside the component, but we declare the base prefix here */}
        <Route path="/dashboard/*?" component={Dashboard} />
        
        <Route path="/sitemap" component={Sitemap} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/cookies" component={Cookies} />
        <Route path="/refund" component={Refund} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

import { ThemeProvider } from "next-themes";

import { ErrorBoundary } from "@/components/error-boundary";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
          <TooltipProvider>
            <PointerFeedbackProvider />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
