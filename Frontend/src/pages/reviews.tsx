import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { FadeIn, SectionHeading } from "@/components/ui";
import { SupportBand } from "@/components/site";
import { fetchHomepageReviews, type HomepageReview } from "@/lib/public-api";
import { Star } from "lucide-react";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<HomepageReview[]>([]);

  useEffect(() => {
    void fetchHomepageReviews()
      .then((result) => {
        const merged = [
          ...(result?.data?.topReviews || []),
          ...(result?.data?.bestReviews || []),
          ...(result?.data?.latestReviews || []),
        ];
        const seen = new Set<string>();
        setReviews(
          merged.filter((review) => {
            if (seen.has(review.id)) return false;
            seen.add(review.id);
            return true;
          })
        );
      })
      .catch(() => setReviews([]));
  }, []);

  return (
    <AppLayout>
      <SEO
        title="Reviews | Fab Clean"
        description="Read customer feedback for Fab Clean."
        canonical="https://myfabclean.com/reviews"
      />

      <div className="page-shell">
        <section className="container-tight section-padding">
          <SectionHeading title="What our customers are saying." subtitle="Customer reviews" />
          <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-muted-foreground">
            Real experiences from people who trust us with their premium garments.
          </p>
        </section>

        <section className="container-tight pb-20">
          <div className="flex flex-col gap-16">
            {reviews.length ? (
              reviews.map((item, index) => (
                <FadeIn key={item.id} delay={index * 0.05}>
                  <div className="flex flex-col items-center text-center space-y-6 pb-16 border-b border-line last:border-b-0">
                    <div className="flex gap-1 text-primary">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-current" />
                      ))}
                    </div>
                    <p className="font-display text-3xl md:text-4xl text-ink leading-tight max-w-3xl">
                      "{item.feedback || "Great service from Fab Clean."}"
                    </p>
                    <div className="flex items-center gap-4 text-muted-foreground uppercase tracking-widest text-xs font-semibold">
                      <span>{item.customer_name || "Fab Clean Customer"}</span>
                    </div>
                  </div>
                </FadeIn>
              ))
            ) : (
              <FadeIn>
                <div className="text-center py-20">
                  <p className="font-display text-3xl text-ink">Fresh reviews will appear here soon.</p>
                </div>
              </FadeIn>
            )}
          </div>
        </section>

        <section className="container-wide pb-24">
          <SupportBand title="Want to leave feedback on a recent order?" description="Track the order first, then open the feedback flow with the right identifier already in place." />
        </section>
      </div>
    </AppLayout>
  );
}
