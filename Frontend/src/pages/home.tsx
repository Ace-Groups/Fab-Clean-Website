import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useAuth } from "@/hooks/use-auth";
import { Button, FadeIn } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import {
  BRAND,
  OPERATING_PILLARS,
  PROCESS_STEPS,
  SERVICE_HIGHLIGHTS,
} from "@/lib/brand";
import { fetchHomepageReviews, type HomepageReview } from "@/lib/public-api";
import { useNearestStore } from "@/hooks/use-nearest-store";
import { storeRegionKeywords } from "@/lib/geo";
import { DEFAULT_REVIEWS } from "@/lib/site-catalog";

function filterReviewsForStore(reviews: HomepageReview[], storeSlug: string | undefined) {
  if (!storeSlug) return reviews;
  const keywords = storeRegionKeywords(storeSlug);
  const filtered = reviews.filter((review) => {
    const haystack = `${review.feedback ?? ""} ${review.ai_category ?? ""}`.toLowerCase();
    return keywords.some((kw) => haystack.includes(kw));
  });
  return filtered.length > 0 ? filtered : reviews;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const reduceMotion = useReducedMotion();
  const { storesNearestFirst, nearestStore } = useNearestStore({ requestOnMount: true });
  const [reviews, setReviews] = useState(DEFAULT_REVIEWS);

  useEffect(() => {
    void fetchHomepageReviews()
      .then((res) => {
        if (res.success && res.data) setReviews(res.data);
      })
      .catch(() => undefined);
  }, []);

  const localHeroLead = nearestStore
    ? `${BRAND.heroLead} Your nearest branch is ${nearestStore.name.replace(/^Fab Clean - /, "")}.`
    : BRAND.heroLead;

  const displayReviews = filterReviewsForStore(
    [...reviews.topReviews, ...reviews.bestReviews].slice(0, 3),
    nearestStore?.slug,
  );

  return (
    <AppLayout>
      <SEO
        title="Fab Clean | Doorstep garment care"
        description="Schedule a free Fab Clean pickup. Our agent collects garment details at your door — confirm before service, then track with phone OTP."
        canonical="https://myfabclean.com/"
      />

      <section className="hero-fullbleed">
        <div className="hero-fullbleed__media" aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL}images/atmosphere/linen-fold.jpg`}
            alt=""
            fetchPriority="high"
          />
        </div>
        <div className="hero-fullbleed__veil" aria-hidden="true" />
        <div className="hero-fullbleed__mist" aria-hidden="true" />

        <div className="container-wide relative z-10 pb-16 pt-28 sm:pb-20 sm:pt-32">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <div className="mb-6">
              <BrandLogo imgClassName="h-14 w-auto sm:h-16 drop-shadow-[0_8px_24px_rgba(15,26,32,0.35)]" />
              <p className="mt-5 font-display text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
                {BRAND.name}
              </p>
            </div>
            <h1 className="max-w-xl font-display text-2xl leading-snug text-white sm:text-3xl md:text-[2.5rem]">
              {BRAND.heroTitle}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">{localHeroLead}</p>
            {nearestStore ? (
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/70">
                Serving {nearestStore.name.replace(/^Fab Clean - /, "")} —{" "}
                {nearestStore.phone}
                {nearestStore.mapHref ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={nearestStore.mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-white"
                    >
                      Directions
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/schedule-pickup">
                <Button size="lg" className="w-full sm:w-auto" data-cursor-label="Book">
                  Schedule pickup
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link
                href={isAuthenticated ? "/track-order" : "/login?redirect=%2Ftrack-order"}
                className="text-center text-sm font-medium text-white/85 underline-offset-4 hover:underline sm:text-left"
              >
                {isAuthenticated ? "Track order" : "Sign in to track"}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-quiet section-padding">
        <div className="container-wide">
          <FadeIn>
            <h2 className="max-w-2xl font-display text-3xl text-ink sm:text-4xl">
              Three calm steps. No package maze.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Book the window. We handle garments together at pickup. You confirm before cleaning starts.
            </p>
          </FadeIn>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {PROCESS_STEPS.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.06}>
                <h3 className="font-display text-2xl text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="section-quiet section-padding overflow-hidden">
        <div className="container-wide grid items-center gap-10 lg:grid-cols-2">
          <FadeIn>
            <div className="relative overflow-hidden rounded-[1.75rem]">
              <img
                src={`${import.meta.env.BASE_URL}images/atmosphere/hanging-shirts.jpg`}
                alt="Fresh garments hanging after careful cleaning"
                className="aspect-[4/5] w-full object-cover sm:aspect-[5/4]"
                loading="lazy"
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Care that fits real wardrobes</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Laundry, dry cleaning, shoes, and bags — chosen with our agent when they arrive, not forced through a long online catalog.
            </p>
            <ul className="mt-8 space-y-6">
              {SERVICE_HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/services" className="mt-8 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">
              Browse services
            </Link>
          </FadeIn>
        </div>
      </section>

      <section className="section-quiet section-padding">
        <div className="container-wide">
          <FadeIn>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Why people stay</h2>
          </FadeIn>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {OPERATING_PILLARS.map((pillar, index) => (
              <FadeIn key={pillar.title} delay={index * 0.05}>
                <pillar.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-2xl text-ink">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{pillar.description}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="section-quiet section-padding">
        <div className="container-wide">
          <FadeIn>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Nearby when you need us</h2>
            <p className="mt-3 text-muted-foreground">
              {BRAND.hours}
              {nearestStore ? (
                <>
                  {" "}
                  · Closest to you:{" "}
                  <span className="font-medium text-ink">{nearestStore.name}</span>
                </>
              ) : null}
            </p>
          </FadeIn>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {storesNearestFirst.map((branch) => (
              <FadeIn key={branch.slug}>
                <div
                  className={cn(
                    "cloth-panel p-6",
                    branch.slug === nearestStore?.slug && "ring-1 ring-primary/25",
                  )}
                >
                  <div className="flex items-center gap-2 text-ink">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="font-medium">{branch.name}</p>
                    {branch.slug === nearestStore?.slug ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Nearest
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{branch.address}</p>
                  {branch.phone ? (
                    <a href={`tel:${branch.phone}`} className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
                      <Phone className="h-4 w-4" />
                      {branch.phone}
                    </a>
                  ) : null}
                  {branch.mapHref ? (
                    <a
                      href={branch.mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      Open in Maps
                    </a>
                  ) : null}
                </div>
              </FadeIn>
            ))}
          </div>
          {displayReviews.length > 0 ? (
            <div className="mt-14">
              <h3 className="font-display text-2xl text-ink">What neighbors say nearby</h3>
              <ul className="mt-6 grid gap-4 md:grid-cols-3">
                {displayReviews.map((review) => (
                  <li key={review.id} className="rounded-2xl border border-line bg-background/60 p-5 text-sm leading-7 text-muted-foreground">
                    <p className="text-ink">{review.feedback}</p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                      {review.customer_name ?? "Fab Clean customer"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.75rem] bg-deep px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <p className="font-display text-2xl sm:text-3xl">Ready when you are</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/70">
                One tap to schedule. Agent details at the door. Confirm before we clean.
              </p>
            </div>
            <Link href="/schedule-pickup">
              <Button size="lg" className="bg-panel text-ink hover:bg-white">
                Schedule pickup
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
