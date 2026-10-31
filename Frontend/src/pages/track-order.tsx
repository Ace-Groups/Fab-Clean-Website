import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowRight, Search } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Badge, Button, FadeIn, Input } from "@/components/ui";
import { StatusTimeline, SupportBand } from "@/components/site";
import { trackOrderById, type PublicTrackedOrder } from "@/lib/public-api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const stageLabels = ["Order received", "In cleaning", "Ready for pickup", "Out for delivery", "Delivered"];

export default function TrackOrder() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [matchesIdentifierRoute, routeParams] = useRoute("/track-order/:identifier");
  const [identifier, setIdentifier] = useState("");
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastRequestedIdentifier = useRef<string | null>(null);
  const { toast } = useToast();

  const routeIdentifier = matchesIdentifierRoute ? decodeURIComponent(routeParams.identifier || "") : "";
  const loginRedirect = `/login?redirect=${encodeURIComponent(
    routeIdentifier ? `/track-order/${encodeURIComponent(routeIdentifier)}` : "/track-order",
  )}`;

  const activeIndex = useMemo(
    () =>
      order
        ? Math.max(order.stages.findIndex((stage) => stage.completed === false) - 1, 0) >= 0
          ? Math.max(order.stages.findIndex((stage) => stage.completed === false) - 1, 0)
          : order.stages.length - 1
        : 0,
    [order],
  );

  async function lookupOrder(rawIdentifier: string, options?: { syncUrl?: boolean; showErrors?: boolean }) {
    const cleanIdentifier = rawIdentifier.trim();
    if (!cleanIdentifier) return;

    lastRequestedIdentifier.current = cleanIdentifier.toUpperCase();
    setIsLoading(true);
    try {
      const result = await trackOrderById(cleanIdentifier);
      setOrder(result.data);
      const canonicalIdentifier = result.data.reference || cleanIdentifier;
      setIdentifier(canonicalIdentifier);

      if (options?.syncUrl !== false) {
        const nextPath = `/track-order/${encodeURIComponent(canonicalIdentifier)}`;
        if (window.location.pathname !== nextPath) setLocation(nextPath);
      }
    } catch (error) {
      if (options?.showErrors !== false) {
        toast({
          title: "Order not found",
          description: error instanceof Error ? error.message : "Unable to locate that order.",
          variant: "destructive",
        });
      }
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation(loginRedirect);
    }
  }, [isAuthenticated, loginRedirect, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const legacyIdentifier = new URLSearchParams(window.location.search).get("orderId") || "";
    const initialIdentifier = routeIdentifier || legacyIdentifier;
    if (!initialIdentifier.trim()) return;
    setIdentifier(initialIdentifier);
    if (lastRequestedIdentifier.current === initialIdentifier.toUpperCase()) return;
    void lookupOrder(initialIdentifier, { syncUrl: true, showErrors: true });
  }, [routeIdentifier, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="page-shell">
          <section className="container-tight section-padding">
            <div className="plane-step p-10 text-center text-sm text-muted-foreground">
              Redirecting to sign in…
            </div>
          </section>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SEO
        title="Track Order | Fab Clean"
        description="Track your Fab Clean order after signing in with your phone."
        canonical={`https://myfabclean.com${routeIdentifier ? `/track-order/${encodeURIComponent(routeIdentifier)}` : "/track-order"}`}
      />

      <div className="page-shell">
        <section className="container-tight section-padding">
          <FadeIn className="mx-auto w-full max-w-xl">
            <div className="plane-step p-8 lg:p-10">
              <div className="mb-8 text-center">
                <h1 className="font-display text-3xl text-ink sm:text-4xl">Track your order</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Enter the order ID from your receipt. Status stays simple: received, cleaning, ready, out for delivery, delivered.
                </p>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!identifier.trim()) {
                    toast({
                      title: "Enter an order ID",
                      description: "Use your receipt order number.",
                      variant: "destructive",
                    });
                    return;
                  }
                  void lookupOrder(identifier, { syncUrl: true, showErrors: true });
                }}
                className="flex flex-col gap-5"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="pl-11"
                    placeholder="Order ID or number"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
                  Track order
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Prefer the full list?{" "}
                <Link href="/dashboard/orders" className="font-medium text-primary underline-offset-4 hover:underline">
                  Open your orders
                </Link>
              </p>
            </div>
          </FadeIn>
        </section>

        {order ? (
          <section className="container-wide pb-20">
            <div className="cloth-panel p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="font-display text-3xl text-ink sm:text-4xl">{order.reference}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Order ID: {order.orderId}</p>
                </div>
                <Badge variant="outline">{order.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="mt-8">
                <StatusTimeline
                  activeIndex={activeIndex}
                  steps={
                    order.stages && order.stages.length > 0
                      ? order.stages.map((stage, index) => ({
                          label: stage.label,
                          meta: `Stage ${index + 1}`,
                        }))
                      : stageLabels.map((label, index) => ({
                          label,
                          meta: `Stage ${index + 1}`,
                        }))
                  }
                />
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Total", value: formatCurrency(order.totalAmount || 0) },
                  { label: "Payment", value: order.paymentStatus || "pending" },
                  {
                    label: "Pickup date",
                    value: order.scheduledDate
                      ? isNaN(new Date(order.scheduledDate).getTime())
                        ? order.scheduledDate
                        : new Date(order.scheduledDate).toLocaleDateString("en-IN")
                      : "Awaiting schedule",
                  },
                  { label: "Customer", value: order.customerName || "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-line bg-background/70 px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                    <p className="mt-2 font-medium text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {order.invoiceUrl ? (
                  <a href={order.invoiceUrl} target="_blank" rel="noreferrer">
                    <Button>Open invoice</Button>
                  </a>
                ) : null}
                <Link href={`/feedback/${encodeURIComponent(order.reference || order.orderId)}`}>
                  <Button variant="outline">Leave feedback</Button>
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="container-wide pb-20">
          <SupportBand
            title="Need help with a missing status?"
            description="If the order cannot be found, contact the branch with your receipt number."
          />
        </section>
      </div>
    </AppLayout>
  );
}
