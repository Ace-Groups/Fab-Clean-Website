import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input, Textarea } from "@/components/ui";
import {
  type StructuredAddress,
  isStructuredAddressComplete,
  lookupIndiaPincode,
} from "@/lib/address";
import { cn } from "@/lib/utils";

type Props = {
  value: StructuredAddress;
  onChange: (next: StructuredAddress) => void;
  onCoords?: (lat: number, lng: number) => void;
  className?: string;
  showErrors?: boolean;
};

export function StructuredAddressFields({
  value,
  onChange,
  onCoords,
  className,
  showErrors = false,
}: Props) {
  const [lookingUp, setLookingUp] = useState(false);
  const [pinHint, setPinHint] = useState<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCoordsRef = useRef(onCoords);
  onCoordsRef.current = onCoords;

  useEffect(() => {
    const pin = value.pincode.replace(/\D/g, "");
    if (pin.length !== 6) {
      setPinHint(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLookingUp(true);
      try {
        const result = await lookupIndiaPincode(pin);
        if (cancelled) return;
        if (!result) {
          setPinHint("Pincode not found. Enter city and state manually.");
          return;
        }
        setPinHint(
          [result.postOffice, result.district, result.state].filter(Boolean).join(" · "),
        );
        const current = valueRef.current;
        onChangeRef.current({
          ...current,
          pincode: result.pincode,
          city: current.city.trim() || result.city,
          state: current.state.trim() || result.state,
          district: result.district || current.district,
        });

        // Soft geocode for nearest-store routing (optional).
        if (onCoordsRef.current) {
          const query = [current.line1, result.city, result.state, result.pincode, "India"]
            .filter(Boolean)
            .join(", ");
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`,
            );
            if (response.ok) {
              const data = (await response.json()) as Array<{ lat: string; lon: string }>;
              if (data[0]?.lat && data[0]?.lon) {
                onCoordsRef.current?.(parseFloat(data[0].lat), parseFloat(data[0].lon));
              }
            }
          } catch {
            /* optional */
          }
        }
      } catch {
        if (!cancelled) setPinHint("Could not look up pincode right now.");
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value.pincode]);

  const incomplete = showErrors && !isStructuredAddressComplete(value);

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <label className="mb-2 block text-sm font-medium text-ink" htmlFor="addr-line1">
          House / street
        </label>
        <Textarea
          id="addr-line1"
          rows={2}
          placeholder="House no., street, area"
          value={value.line1}
          onChange={(event) => onChange({ ...value, line1: event.target.value })}
        />
        {incomplete && value.line1.trim().length < 5 ? (
          <p className="mt-2 text-sm text-red-700">Enter house / street (at least 5 characters).</p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink" htmlFor="addr-landmark">
          Landmark <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="addr-landmark"
          placeholder="Near temple, school, apartment gate…"
          value={value.landmark || ""}
          onChange={(event) => onChange({ ...value, landmark: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="addr-pincode">
            Pincode
          </label>
          <div className="relative">
            <Input
              id="addr-pincode"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit PIN"
              value={value.pincode}
              onChange={(event) =>
                onChange({ ...value, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })
              }
            />
            {lookingUp ? (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
            ) : null}
          </div>
          {pinHint ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{pinHint}</span>
            </p>
          ) : null}
          {incomplete && value.pincode.replace(/\D/g, "").length !== 6 ? (
            <p className="mt-2 text-sm text-red-700">Enter a valid 6-digit pincode.</p>
          ) : null}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="addr-city">
            City / town
          </label>
          <Input
            id="addr-city"
            placeholder="Auto-filled from PIN"
            value={value.city}
            onChange={(event) => onChange({ ...value, city: event.target.value })}
          />
          {incomplete && value.city.trim().length < 2 ? (
            <p className="mt-2 text-sm text-red-700">Enter city.</p>
          ) : null}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="addr-state">
            State
          </label>
          <Input
            id="addr-state"
            placeholder="Auto-filled from PIN"
            value={value.state}
            onChange={(event) => onChange({ ...value, state: event.target.value })}
          />
          {incomplete && value.state.trim().length < 2 ? (
            <p className="mt-2 text-sm text-red-700">Enter state.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
