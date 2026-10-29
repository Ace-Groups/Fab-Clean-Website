import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowRight, FileText, Search, Truck } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Badge, Button, Card, FadeIn, Input, SectionHeading } from "@/components/ui";
import { ActionList, StatusTimeline, SupportBand } from "@/components/site";
import { trackOrderById, type PublicTrackedOrder } from "@/lib/public-api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const stageLabels = ["Order received", "In cleaning", "Ready for pickup", "Out for delivery", "Delivered"];

export default function TrackOrder() {
  const [, setLocation] = useLocation();
  const [matchesIdentifierRoute, routeParams] = useRoute("/track-order/:identifier");
  const [identifier, setIdentifier] = useState("");
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastRequestedIdentifier = useRef<string | null>(null);
  const { toast } = useToast();

  const routeIdentifier = matchesIdentifierRoute ? decodeURIComponent(routeParams.identifier || "") : "";
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
    const legacyIdentifier = new URLSearchParams(window.location.search).get("orderId") || "";
    const initialIdentifier = routeIdentifier || legacyIdentifier;
    if (!initialIdentifier.trim()) return;
    setIdentifier(initialIdentifier);
    if (lastRequestedIdentifier.current === initialIdentifier.toUpperCase()) return;
    void lookupOrder(initialIdentifier, { syncUrl: true, showErrors: true });
  }, [routeIdentifier]);

  return (
    <AppLayout>
      <SEO
        title="Track Order | Fab Clean"
        description="Track your Fab Clean order with a clearer status hierarchy and order summary."
        canonical={`https://myfabclean.com${routeIdentifier ? `/track-order/${encodeURIComponent(routeIdentifier)}` : "/track-order"}`}
      />

      <div className="page-shell">
        <section className="container-tight section-padding flex flex-col items-center justify-center min-h-[50vh]">
          <FadeIn className="w-full max-w-xl">
            <div className="visual-card p-8 lg:p-10">
              <div className="text-center mb-10">
                <p className="eyebrow">Track order</p>
                <h1 className="mt-4 font-display text-3xl text-ink">Find your service</h1>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!identifier.trim()) {
                    toast({ title: "Enter an order ID", description: "Use your receipt order number or ERP order ID.", variant: "destructive" });
                    return;
                  }
                  void lookupOrder(identifier, { syncUrl: true, showErrors: true });
                }}
                className="flex flex-col gap-5"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="pl-11 text-center" placeholder="Enter order ID or order number" />
                </div>
                <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
                  Track order
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </FadeIn>
        </section>

        {order ? (
          <section className="container-wide pb-24">
            <div className="grid gap-6">
              <Card className="lux-card p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="eyebrow">Tracked order</p>
                    <h2 className="mt-5 font-display text-4xl text-ink">{order.reference}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">ERP order ID: {order.orderId}</p>
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
              </Card>

              <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
                <Card className="lux-card p-7">
                  <p className="eyebrow">Order summary</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {[
                      { label: "Customer", value: order.customerName || "Fab Clean Customer" },
                      { label: "Total", value: formatCurrency(order.totalAmount || 0) },
                      { label: "Payment", value: order.paymentStatus || "pending" },
                      { label: "Pickup date", value: order.scheduledDate ? (isNaN(new Date(order.scheduledDate).getTime()) ? order.scheduledDate : new Date(order.scheduledDate).toLocaleDateString("en-IN")) : "Awaiting schedule" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[1.4rem] border border-line bg-background/70 px-5 py-5">
                        <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                        <p className="mt-3 font-medium text-ink">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="lux-card p-7">
                  <p className="eyebrow">Services and actions</p>
                  <div className="mt-6 space-y-3">
                    {(order.services.length ? order.services : ["Laundry service"]).map((service, index) => (
                      <div key={`${service}-${index}`} className="rounded-[1.3rem] border border-line bg-background/70 px-4 py-4 text-sm text-ink">
                        {service}
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 grid gap-3">
                    {order.invoiceUrl ? (
                      <a href={order.invoiceUrl} target="_blank" rel="noreferrer">
                        <Button className="w-full">Open invoice</Button>
                      </a>
                    ) : null}
                    <Link href={`/feedback/${encodeURIComponent(order.reference || order.orderId)}`}>
                      <Button variant="outline" className="w-full">Leave feedback</Button>
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </section>
        ) : null}

        <section className="container-wide pb-24">
          <SupportBand title="Need help with a missing status?" description="If the order cannot be found or the state looks wrong, contact the branch with your receipt number." />
        </section>
      </div>
    </AppLayout>
  );
}
