import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListServices } from "@workspace/api-client-react";
import { Footprints, Gem, Layout, Loader2, Shirt, Sparkles, WashingMachine, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Badge, Button, Card, FadeIn, SectionHeading } from "@/components/ui";
import { StoryCard, SupportBand } from "@/components/site";

const iconMap = {
  shirt: Shirt,
  "washing-machine": WashingMachine,
  scale: WashingMachine,
  footprints: Footprints,
  layout: Layout,
  gem: Gem,
  zap: Zap,
  sparkles: Sparkles,
} as const;

import { DEFAULT_SERVICES } from "@/lib/site-catalog";

export default function Services() {
  const { data, isLoading } = useListServices();
  const [filter, setFilter] = useState("All");

  const groups = useMemo(() => {
    const rawItems = (Array.isArray(data) ? (data as any) : data?.data) ?? [];
    const items = rawItems.length > 0 ? rawItems : DEFAULT_SERVICES;
    return {
      All: items,
      Laundry: items.filter((service: any) => !service.name.toLowerCase().includes("dry")),
      "Dry Cleaning": items.filter((service: any) => service.name.toLowerCase().includes("dry")),
      Specialty: items.filter((service: any) => {
        const value = service.name.toLowerCase();
        return value.includes("shoe") || value.includes("bag") || value.includes("special");
      }),
    };
  }, [data]);

  const active = groups[filter as keyof typeof groups] ?? groups.All;

  return (
    <AppLayout>
      <SEO
        title="Services | Fab Clean"
        description="Explore Fab Clean services across premium laundry, dry cleaning, specialty shoe care, and bag care."
        canonical="https://myfabclean.com/services"
      />

      <div className="page-shell">
        <section className="container-wide section-padding">
          <SectionHeading title="Premium care for every fabric." subtitle="Services" />
          <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-muted-foreground">
            Explore our curated selection of services. From daily wear to delicate fabrics, we ensure the highest standard of care.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {Object.keys(groups).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full border px-5 py-2 text-sm transition-colors ${filter === item ? "border-primary/20 bg-primary/10 text-primary" : "border-line bg-panel/70 text-ink"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="container-wide pb-20">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {active.map((service: { id: string; icon?: string; name: string; startingPrice: number; description?: string; shortDescription?: string }, index: number) => {
                const Icon = iconMap[(service.icon?.toLowerCase() as keyof typeof iconMap) || "shirt"] || Shirt;

                return (
                  <FadeIn key={service.id} delay={index * 0.04}>
                    <Card className="lux-card h-full p-6">
                      <Badge variant="outline">From ₹{service.startingPrice}</Badge>
                      <div className="mt-6">
                        <StoryCard
                          icon={Icon}
                          title={service.name}
                          description={service.shortDescription || service.description || ""}
                          className="border-none bg-transparent p-0 shadow-none"
                        />
                      </div>
                      <div className="mt-6">
                        <Link href="/schedule-pickup">
                          <Button variant="outline">Book this service</Button>
                        </Link>
                      </div>
                    </Card>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </section>

        <section className="container-wide pb-24">
          <SupportBand title="Need help choosing the right service?" description="If the garment is delicate, premium, or unusual, message the team and let them guide the booking." />
        </section>
      </div>
    </AppLayout>
  );
}
