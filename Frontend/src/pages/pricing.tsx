import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListPricing } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button, FadeIn, SectionHeading } from "@/components/ui";
import { PricingTable, SupportBand } from "@/components/site";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRICING } from "@/lib/site-catalog";

type PricingCategory = {
  category: string;
  items: Array<{ item: string; price: number; unit?: string | null }>;
};

export default function Pricing() {
  const { data, isLoading } = useListPricing();
  const [filter, setFilter] = useState("Laundry");
  const apiCategories = ((Array.isArray(data) ? (data as any) : data?.data) ?? []) as PricingCategory[];
  const categories = apiCategories.length > 0 ? apiCategories : (DEFAULT_PRICING as PricingCategory[]);

  const grouped = useMemo(() => {
    const buckets: Record<string, PricingCategory[]> = {
      Laundry: [],
      "Dry Cleaning": [],
      Specialty: [],
    };
    for (const category of categories) {
      const name = category.category.toLowerCase();
      if (name.includes("shoe") || name.includes("bag") || name.includes("special")) buckets.Specialty.push(category);
      else if (name.includes("dry")) buckets["Dry Cleaning"].push(category);
      else buckets.Laundry.push(category);
    }
    return buckets;
  }, [categories]);

  const visible = grouped[filter] ?? grouped.Laundry;
  const sections = visible.map((category) => ({
    title: category.category,
    items: category.items.map((item) => ({
      name: item.item,
      meta: item.unit ? `Per ${item.unit}` : null,
      price: formatCurrency(item.price),
    })),
  }));

  return (
    <AppLayout>
      <SEO
        title="Pricing | Fab Clean"
        description="Clear Fab Clean pricing across laundry, dry cleaning, and specialty garment care."
        canonical="https://myfabclean.com/pricing"
      />

      <div className="page-shell">
        <section className="container-wide section-padding">
          <SectionHeading title="Clear pricing, no surprises." subtitle="Pricing" />
          <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-muted-foreground">
            Our pricing is transparent and easy to understand. Final billing depends on garment condition and actual item count at pickup.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {Object.keys(grouped).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-full border px-5 py-2 text-sm transition-colors ${filter === tab ? "border-primary/20 bg-primary/10 text-primary" : "border-line bg-panel/70 text-ink"}`}
              >
                {tab}
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
            <FadeIn>
              <PricingTable sections={sections} />
            </FadeIn>
          )}
          <div className="mt-8 flex justify-center">
            <Link href="/schedule-pickup">
              <Button>Book pickup</Button>
            </Link>
          </div>
        </section>

        <section className="container-wide pb-24">
          <SupportBand title="Want help pricing a mixed order?" description="Call or WhatsApp the team if the order spans daily wear, dry clean pieces, and specialty items." />
        </section>
      </div>
    </AppLayout>
  );
}
