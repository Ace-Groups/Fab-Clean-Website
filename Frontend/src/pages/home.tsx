import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useAuth } from "@/hooks/use-auth";
import { Button, FadeIn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import {
  BRAND,
  OPERATING_PILLARS,
  PROCESS_STEPS,
  SERVICE_HIGHLIGHTS,
} from "@/lib/brand";
import { fetchStores, type Store } from "@/lib/public-api";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    void fetchStores()
      .then((res) => {
        if (res.success) setStores(res.data);
      })
      .catch(() => setStores([]));
  }, []);

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
            <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">
              {BRAND.heroLead}
            </p>
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
            <p className="mt-3 text-muted-foreground">{BRAND.hours}</p>
          </FadeIn>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(stores.length ? stores : []).map((branch) => (
              <FadeIn key={branch.slug}>
                <div className="cloth-panel p-6">
                  <div className="flex items-center gap-2 text-ink">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="font-medium">{branch.name}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{branch.address}</p>
                  {branch.phone ? (
                    <a href={`tel:${branch.phone}`} className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
                      <Phone className="h-4 w-4" />
                      {branch.phone}
                    </a>
                  ) : null}
                </div>
              </FadeIn>
            ))}
          </div>
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
