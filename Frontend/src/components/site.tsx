import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CheckCircle2, Clock3, MessageCircle, Phone } from "lucide-react";
import { Link } from "wouter";
import { BRAND, LEGAL_NAV } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, FadeIn, SectionHeading } from "@/components/ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export function PointerFeedbackProvider() {
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("");
  const [hovered, setHovered] = useState(false);
  const x = useMotionValue(-120);
  const y = useMotionValue(-120);
  const springX = useSpring(x, { stiffness: 420, damping: 38, mass: 0.25 });
  const springY = useSpring(y, { stiffness: 420, damping: 38, mass: 0.25 });
  const offsetX = useTransform(springX, (value) => value - 20);
  const offsetY = useTransform(springY, (value) => value - 20);
  const labelX = useTransform(springX, (value) => value + 18);
  const labelY = useTransform(springY, (value) => value - 26);
  const labelRef = useRef<string>("");
  const hoverRef = useRef(false);

  useEffect(() => {
    if (reduceMotion) return;
    const media = window.matchMedia("(pointer: fine)");
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [reduceMotion]);

  useEffect(() => {
    if (!enabled) return;

    const resolveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      return target.closest("a, button, input, textarea, select, [data-cursor-label]");
    };

    const onMove = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setActive(true);

      const target = resolveTarget(event.target);
      const nextHovered = Boolean(target);
      const nextLabel = target?.getAttribute("data-cursor-label") || "";

      if (hoverRef.current !== nextHovered) {
        hoverRef.current = nextHovered;
        setHovered(nextHovered);
      }

      if (labelRef.current !== nextLabel) {
        labelRef.current = nextLabel;
        setLabel(nextLabel);
      }
    };

    const onLeave = () => setActive(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed left-0 top-0 z-[80] hidden rounded-full border border-primary/45 bg-primary/10 backdrop-blur-sm lg:block",
          hovered ? "h-14 w-14" : "h-10 w-10",
        )}
        style={{
          x: offsetX,
          y: offsetY,
          opacity: active ? (hovered ? 1 : 0.72) : 0,
          scale: hovered ? 1 : 0.88,
        }}
      />
      {label ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[81] hidden rounded-full border border-primary/20 bg-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink shadow-[0_18px_36px_rgba(23,20,18,0.12)] lg:block"
          style={{
            x: labelX,
            y: labelY,
            opacity: active && hovered ? 1 : 0,
          }}
        >
          {label}
        </motion.div>
      ) : null}
    </>
  );
}

export function StatStrip({
  stats,
  className,
}: {
  stats: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-4", className)}>
      {stats.map((item, index) => (
        <FadeIn key={item.label} delay={index * 0.04}>
          <Card className="lux-card p-5">
            <p className="text-3xl font-semibold text-ink sm:text-4xl">{item.value}</p>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
          </Card>
        </FadeIn>
      ))}
    </div>
  );
}

export function StoryCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="h-full">
      <Card className={cn("lux-card p-6 h-full flex flex-col", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-6 font-display text-2xl text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </Card>
    </motion.div>
  );
}

export function ProcessRail({
  steps,
}: {
  steps: Array<{ step: string; title: string; description: string; icon: LucideIcon }>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {steps.map((item, index) => (
        <FadeIn key={item.step} delay={index * 0.06} className="h-full">
          <motion.div whileHover={{ y: -5, scale: 1.01 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="h-full">
            <Card className="lux-card relative overflow-hidden p-6 h-full flex flex-col">
            <div className="absolute right-5 top-5 text-5xl font-semibold text-primary/12">{item.step}</div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-8 font-display text-2xl text-ink">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </Card>
          </motion.div>
        </FadeIn>
      ))}
    </div>
  );
}

export function QuoteCard({
  quote,
  name,
  meta,
}: {
  quote: string;
  name: string;
  meta?: string;
}) {
  return (
    <Card className="lux-card h-full p-6">
      <p className="font-display text-2xl leading-9 text-ink">“{quote}”</p>
      <div className="mt-6 border-t border-line pt-4">
        <p className="font-semibold text-ink">{name}</p>
        {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      </div>
    </Card>
  );
}

export function PricingTable({
  sections,
}: {
  sections: Array<{
    title: string;
    items: Array<{ name: string; meta?: string | null; price: string }>;
  }>;
}) {
  return (
    <div className="grid gap-6 items-start md:grid-cols-2 xl:grid-cols-3">
      {sections.map((section, index) => (
        <FadeIn key={section.title} delay={index * 0.04}>
          <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <Card className="lux-card p-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl text-ink">{section.title}</h3>
              <Badge variant="outline">{section.items.length} items</Badge>
            </div>
            <div className="mt-6 space-y-4">
              {section.items.map((item) => (
                <div key={`${section.title}-${item.name}`} className="rounded-[1.25rem] border border-line bg-background/70 px-5 py-4 transition-colors hover:bg-background/90">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{item.name}</p>
                      {item.meta ? <p className="mt-1 text-sm text-muted-foreground">{item.meta}</p> : null}
                    </div>
                    <p className="font-semibold text-primary">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
            </Card>
          </motion.div>
        </FadeIn>
      ))}
    </div>
  );
}

export function FormPanel({
  eyebrow,
  title,
  description,
  children,
  sideNote,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  sideNote?: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.84fr_1.16fr]">
      <FadeIn>
        <Card className="lux-card h-full p-7">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-6 font-display text-4xl leading-tight text-ink">{title}</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">{description}</p>
          {sideNote ? <div className="mt-8">{sideNote}</div> : null}
        </Card>
      </FadeIn>
      <FadeIn delay={0.06}>
        <Card className="lux-card p-7">{children}</Card>
      </FadeIn>
    </div>
  );
}

export function StatusTimeline({
  steps,
  activeIndex,
}: {
  steps: Array<{ label: string; meta: string }>;
  activeIndex: number;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {steps.map((step, index) => {
        const complete = index <= activeIndex;
        return (
          <div
            key={step.label}
            className={cn(
              "rounded-[1.75rem] border px-4 py-5 transition-colors",
              complete ? "border-primary/20 bg-primary/10" : "border-line bg-panel/70",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                complete ? "bg-primary text-background" : "bg-background text-muted-foreground",
              )}
            >
              {index + 1}
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.16em] text-muted-foreground">{step.meta}</p>
            <p className="mt-2 font-medium text-ink">{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function SupportBand({
  title = "Need help before you book?",
  description = "Use WhatsApp for quick questions or call the team for a direct answer.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <FadeIn>
      <div className="lux-dark-card overflow-hidden px-7 py-8 sm:px-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="ticket-mark text-primary-light">Support</p>
            <h2 className="mt-4 font-display text-4xl text-white">{title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">{description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href={BRAND.phoneHref} data-cursor-label="Call">
              <Button variant="secondary" size="lg" className="w-full">
                <Phone className="h-4 w-4" />
                {BRAND.phoneMain}
              </Button>
            </a>
            <a href={BRAND.whatsappHref} target="_blank" rel="noreferrer" data-cursor-label="WhatsApp">
              <Button variant="outline" size="lg" className="w-full border-white/18 bg-white/8 text-white hover:bg-white/14">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

export function LegalPage({
  title,
  description,
  effectiveDate,
  updatedDate,
  sections,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  updatedDate: string;
  sections: Array<{ title: string; body: string }>;
}) {
  return (
    <div className="page-shell">
      <section className="container-tight pt-20">
        <SectionHeading title={title} subtitle="Legal" />
        <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-muted-foreground">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">Effective {effectiveDate}</Badge>
          <Badge variant="outline">Updated {updatedDate}</Badge>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {LEGAL_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button variant="ghost" size="sm">
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-tight section-padding pt-14">
        <div className="space-y-5">
          {sections.map((section, index) => (
            <FadeIn key={section.title} delay={index * 0.04}>
              <Card className="lux-card p-6">
                <h2 className="font-display text-2xl text-ink">{section.title}</h2>
                <div className="legal-prose mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                  {section.body.split("\n").map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ActionList({
  items,
}: {
  items: Array<{ icon: LucideIcon; title: string; body: string }>;
}) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <div key={item.title} className="rounded-[1.5rem] border border-line bg-background/70 px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-ink">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HighlightBadgeRow() {
  const items = useMemo(
    () => [
      { icon: CheckCircle2, text: "Clear pricing" },
      { icon: Clock3, text: "Reliable status updates" },
      { icon: ArrowUpRight, text: "Fast pickup flow" },
    ],
    [],
  );

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.text} className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/75 px-4 py-2 text-sm text-ink">
          <item.icon className="h-4 w-4 text-primary" />
          {item.text}
        </div>
      ))}
    </div>
  );
}
