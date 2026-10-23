import type { LibraryData, Usage } from "./types";

const FREE_LIMIT = 5_000_000_000;
const BASIC_LIMIT = 25_000_000_000;
const NEAR_LIMIT_PERCENT = 90;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function tierLabel(tier: string): string {
  switch (tier) {
    case "free":
      return "Free";
    case "basic":
      return "Basic Premium";
    case "premium":
    case "unlimited":
      return "Premium Unlimited";
    default:
      return tier ? tier.replace(/_/g, " ") : "iBroadcast account";
  }
}

export function parseUsage(status: unknown): Usage | null {
  const root = asRecord(status);
  if (!root) {
    return null;
  }
  const user = asRecord(root.user);
  const usage = asRecord(user?.usage) ?? asRecord(root.usage);
  if (!usage) {
    return null;
  }

  const tier = (
    asText(usage.tier) ??
    asText(user?.tier) ??
    (asBoolean(user?.premium) ? "premium" : "free")
  )
    .trim()
    .toLowerCase();

  const storageUsed = Math.max(0, asNumber(usage.storage_used) ?? 0);
  const rawLimit = asNumber(usage.storage_limit);
  let storageLimit: number | null =
    rawLimit !== null && rawLimit > 0 ? rawLimit : null;
  let fallbackLimit = false;
  let limitKnown = true;

  if (storageLimit === null) {
    if (tier === "free") {
      storageLimit = FREE_LIMIT;
      fallbackLimit = true;
    } else if (tier === "basic") {
      storageLimit = BASIC_LIMIT;
      fallbackLimit = true;
    } else if (tier !== "premium" && tier !== "unlimited") {
      limitKnown = false;
    }
  }

  const unlimited = limitKnown && storageLimit === null;
  const usedPercent =
    storageLimit !== null && storageLimit > 0
      ? (storageUsed / storageLimit) * 100
      : null;
  const remaining =
    storageLimit !== null ? Math.max(0, storageLimit - storageUsed) : null;
  const overBy =
    storageLimit !== null && storageUsed > storageLimit
      ? storageUsed - storageLimit
      : 0;

  return {
    tier,
    tierLabel: tierLabel(tier),
    storageUsed,
    storageLimit,
    limitKnown,
    usedPercent,
    remaining,
    overBy,
    nearLimit: usedPercent !== null && usedPercent >= NEAR_LIMIT_PERCENT,
    overLimit: usedPercent !== null && usedPercent >= 100,
    unlimited,
    hiddenFiles: Math.max(0, asNumber(usage.hidden_files) ?? 0),
    enforced: asBoolean(usage.enforced),
    enforcedFrom: asText(usage.enforced_from),
    fallbackLimit,
    estimated: false,
  };
}

export function estimatedUsage(library: LibraryData): Usage {
  return {
    tier: "unknown",
    tierLabel: "iBroadcast account",
    storageUsed: library.totalStoredSize,
    storageLimit: null,
    limitKnown: false,
    usedPercent: null,
    remaining: null,
    overBy: 0,
    nearLimit: false,
    overLimit: false,
    unlimited: false,
    hiddenFiles: 0,
    enforced: false,
    enforcedFrom: null,
    fallbackLimit: false,
    estimated: true,
  };
}
