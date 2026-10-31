/** Structured Indian pickup / profile address helpers. */

export type StructuredAddress = {
  line1: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  district?: string;
};

export const EMPTY_STRUCTURED_ADDRESS: StructuredAddress = {
  line1: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  district: "",
};

export function formatStructuredAddress(parts: StructuredAddress): string {
  const line1 = parts.line1.trim();
  const landmark = parts.landmark?.trim();
  const city = parts.city.trim();
  const state = parts.state.trim();
  const pincode = parts.pincode.trim();
  const district = parts.district?.trim();

  const locality = [city || district, state].filter(Boolean).join(", ");
  const tail = [locality, pincode].filter(Boolean).join(" - ");
  return [line1, landmark, tail].filter(Boolean).join(", ");
}

/** Best-effort parse of legacy free-text addresses into structured fields. */
export function parseAddressString(raw: string): StructuredAddress {
  const text = raw.trim();
  if (!text) return { ...EMPTY_STRUCTURED_ADDRESS };

  const pincodeMatch = text.match(/\b(\d{6})\b/);
  const pincode = pincodeMatch?.[1] ?? "";

  const withoutPin = pincode ? text.replace(pincode, "").replace(/[,\-\s]+$/, "").trim() : text;
  const chunks = withoutPin
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return { ...EMPTY_STRUCTURED_ADDRESS, line1: text, pincode };
  }

  const line1 = chunks[0] || "";
  let landmark = "";
  let city = "";
  let state = "";

  if (chunks.length === 2) {
    city = chunks[1];
  } else if (chunks.length === 3) {
    landmark = chunks[1];
    city = chunks[2];
  } else if (chunks.length >= 4) {
    landmark = chunks[1];
    city = chunks[chunks.length - 2] || "";
    state = chunks[chunks.length - 1] || "";
  }

  return {
    line1,
    landmark,
    city,
    state,
    pincode,
    district: "",
  };
}

export type PincodeLookupResult = {
  pincode: string;
  city: string;
  state: string;
  district: string;
  postOffice?: string;
};

type PostalApiResponse = Array<{
  Status?: string;
  Message?: string;
  PostOffice?: Array<{
    Name?: string;
    District?: string;
    State?: string;
    Block?: string;
    Division?: string;
    Region?: string;
  }> | null;
}>;

/** Free India Post pincode API — no key required. */
export async function lookupIndiaPincode(pincode: string): Promise<PincodeLookupResult | null> {
  const pin = pincode.replace(/\D/g, "").slice(0, 6);
  if (pin.length !== 6) return null;

  const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const body = (await response.json()) as PostalApiResponse;
  const entry = body?.[0];
  if (!entry || entry.Status !== "Success" || !entry.PostOffice?.length) return null;

  const office = entry.PostOffice[0];
  const district = (office.District || "").trim();
  const state = (office.State || "").trim();
  const city = (office.Block || office.Division || office.Name || district).trim();

  return {
    pincode: pin,
    city,
    state,
    district,
    postOffice: office.Name?.trim(),
  };
}

export function isStructuredAddressComplete(parts: StructuredAddress): boolean {
  return (
    parts.line1.trim().length >= 5 &&
    parts.pincode.replace(/\D/g, "").length === 6 &&
    parts.city.trim().length >= 2 &&
    parts.state.trim().length >= 2
  );
}
