export type CustomerProfileLite = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  addresses?: string[] | null;
};

export type ProfileGapId = "name" | "email" | "address" | "photo";

const SKIP_STORAGE_KEY = "fabclean_profile_skips_v1";
const SKIP_TTL_MS = 14 * 24 * 60 * 60 * 1000; // soft skip for 2 weeks

type SkipMap = Partial<Record<ProfileGapId, number>>;

function readSkips(): SkipMap {
  try {
    const raw = localStorage.getItem(SKIP_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SkipMap;
  } catch {
    return {};
  }
}

function writeSkips(map: SkipMap) {
  localStorage.setItem(SKIP_STORAGE_KEY, JSON.stringify(map));
}

export function markProfileGapSkipped(id: ProfileGapId) {
  const map = readSkips();
  map[id] = Date.now();
  writeSkips(map);
}

export function clearProfileGapSkip(id: ProfileGapId) {
  const map = readSkips();
  delete map[id];
  writeSkips(map);
}

function isSkipped(id: ProfileGapId): boolean {
  const at = readSkips()[id];
  if (!at) return false;
  return Date.now() - at < SKIP_TTL_MS;
}

export function missingProfileGaps(profile: CustomerProfileLite | null | undefined): ProfileGapId[] {
  if (!profile) return ["name", "email", "address", "photo"];

  const gaps: ProfileGapId[] = [];
  if (!String(profile.name || "").trim()) gaps.push("name");
  if (!String(profile.email || "").trim()) gaps.push("email");
  if (!Array.isArray(profile.addresses) || profile.addresses.filter(Boolean).length === 0) {
    gaps.push("address");
  }
  if (!String(profile.avatarUrl || "").trim()) gaps.push("photo");
  return gaps;
}

/** Gaps still worth asking about after soft skips. */
export function pendingProfileGaps(profile: CustomerProfileLite | null | undefined): ProfileGapId[] {
  return missingProfileGaps(profile).filter((id) => !isSkipped(id));
}

export const PROFILE_GAP_COPY: Record<
  ProfileGapId,
  { title: string; subtitle: string; cta: string; optional?: boolean }
> = {
  name: {
    title: "What should we call you?",
    subtitle: "Just your first name is enough — we use it on pickups and updates.",
    cta: "Save name",
  },
  email: {
    title: "Got an email for updates?",
    subtitle: "Receipts and gentle reminders. Easy to change later in Profile.",
    cta: "Save email",
    optional: true,
  },
  address: {
    title: "Where should we pick up?",
    subtitle: "One home address keeps booking to a couple of taps next time.",
    cta: "Save address",
    optional: true,
  },
  photo: {
    title: "Add a profile photo?",
    subtitle: "Optional — helps our team recognise you at the door. Skip anytime.",
    cta: "Save photo",
    optional: true,
  },
};
