import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imgClassName?: string;
  animate?: boolean;
  alt?: string;
};

/**
 * Signature cloth-gather motion: soft scale + shadow breathe on the logo mark.
 * Presence, not noise — respects prefers-reduced-motion.
 */
export function BrandLogo({
  className,
  imgClassName,
  animate = true,
  alt = "Fab Clean",
}: BrandLogoProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animate && !reduceMotion;

  return (
    <motion.span
      className={cn("relative inline-flex items-center justify-center", className)}
      initial={shouldAnimate ? { opacity: 0.92, scale: 0.985 } : false}
      animate={
        shouldAnimate
          ? {
              opacity: [0.92, 1, 0.96, 1],
              scale: [0.985, 1.02, 0.995, 1],
              filter: [
                "drop-shadow(0 4px 10px rgba(20,32,40,0.08))",
                "drop-shadow(0 10px 22px rgba(47,122,116,0.18))",
                "drop-shadow(0 6px 14px rgba(20,32,40,0.1))",
                "drop-shadow(0 8px 18px rgba(47,122,116,0.14))",
              ],
            }
          : undefined
      }
      transition={
        shouldAnimate
          ? { duration: 5.6, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }
          : undefined
      }
    >
      <img
        src={`${import.meta.env.BASE_URL}logo.webp`}
        alt={alt}
        className={cn("h-9 w-auto select-none", imgClassName)}
        draggable={false}
      />
    </motion.span>
  );
}
