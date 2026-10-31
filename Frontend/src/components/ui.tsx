import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98]";

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      primary: "bg-primary text-panel shadow-[0_16px_36px_rgba(47,122,116,0.28)] hover:bg-primary/90",
      secondary: "bg-primary-soft text-ink hover:bg-primary-soft/75",
      outline: "border border-line bg-panel/80 text-ink hover:border-primary/40 hover:text-primary hover:bg-panel",
      ghost: "bg-transparent text-ink hover:bg-primary/10 hover:text-primary",
      destructive: "bg-red-700 text-white hover:bg-red-800",
    };

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-10 px-4 text-[13px]",
      md: "h-11 px-6 text-[14px]",
      lg: "h-[52px] px-8 text-[15px]",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[2rem] border border-line bg-panel shadow-[0_18px_36px_rgba(23,20,18,0.06)]", className)} {...props}>
      {children}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-[1.1rem] border border-line bg-background/80 px-4 text-sm text-ink placeholder:text-muted-foreground/80 outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[150px] w-full rounded-[1.35rem] border border-line bg-background/80 px-4 py-3 text-sm text-ink placeholder:text-muted-foreground/80 outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "outline" | "accent" }) {
  const variants = {
    default: "border-primary/15 bg-primary/10 text-primary",
    outline: "border-line bg-panel/75 text-ink",
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  subtitle,
  align = "center",
  className,
}: {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" ? "mx-auto max-w-3xl items-center text-center" : "items-start text-left", className)}>
      {subtitle ? <span className="eyebrow">{subtitle}</span> : null}
      <h2 className="font-display text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">{title}</h2>
    </div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
