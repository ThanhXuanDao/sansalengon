import { AccessTradeApiError } from "./errors";
import type { AccessTradeBanner, AccessTradeCampaign, AccessTradeTrackingLink } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]{2,6};/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = stripHtml(value);
    return text.length > 0 ? text : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function deriveApproval(rawApproval: unknown, rawStatus: unknown): string {
  const explicit = toText(rawApproval);
  if (explicit) return explicit;

  const status = toNumber(rawStatus);
  if (status === 1) return "successful";
  if (status === 0) return "pending";
  if (status === -1) return "rejected";
  return "unknown";
}

function unwrapData(payload: unknown): unknown {
  if (isRecord(payload) && "data" in payload) return payload.data;
  return payload;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return null;
}

export function normalizeAccessTradeCampaign(input: unknown): AccessTradeCampaign {
  if (!isRecord(input)) throw new AccessTradeApiError("schema_drift", "Campaign payload is not an object");

  const id = firstText(input.id, input.campaign_id, input.campaignId);
  const name = firstText(input.name, input.campaign_name, input.title);
  const merchant = firstText(input.merchant, input.merchant_name, input.brand_name, name ?? input.id);
  const url = firstText(input.url, input.url_origin, input.landing_page_url, input.destination_url);

  if (!id || !name || !merchant || !url) {
    throw new AccessTradeApiError("schema_drift", "Campaign payload missing required fields");
  }

  // AT VN: description is an object with sub-fields
  const descObj = isRecord(input.description) ? input.description : null;
  const descText = firstText(
    descObj ? descObj.introduction : null,
    descObj ? descObj.action_point : null,
    input.introduction,
    !descObj ? input.description : null,
    input.short_description,
    input.content,
  );

  // AT VN: commission rate is in max_com (e.g. "10%", "4.9%", "84000")
  const rawCommission =
    input.max_com ?? input.commission ?? input.commission_rate ?? input.commissionRate ??
    input.commission_value ?? input.cps_commission ?? input.cpc_commission;
  let commissionText: string | null = null;
  if (typeof rawCommission === "object" && rawCommission !== null) {
    commissionText = JSON.stringify(rawCommission);
  } else {
    const raw = toText(rawCommission);
    if (raw) {
      // Nếu là số thuần (không có %, chữ cái) → format VND
      const pureNum = /^\d[\d,\.]*$/.test(raw);
      commissionText = pureNum
        ? `${Number(raw.replace(/,/g, "")).toLocaleString("vi-VN")} VND`
        : raw;
    }
  }

  return {
    id,
    name,
    merchant,
    url,
    approval: deriveApproval(input.approval ?? input.approval_status ?? input.status_text, input.status),
    scope: firstText(input.scope, input.campaign_scope),
    status: toNumber(input.status) ?? 0,
    cookieDuration: toNumber(input.cookieDuration ?? input.cookie_duration ?? input.cookie_days ?? input.cookie),
    logoUrl: firstText(input.logo, input.logo_url, input.logoUrl, input.merchant_logo, input.brand_logo),
    description: descText,
    category: firstText(input.category, input.category_name, input.categoryName, input.vertical),
    commission: commissionText,
  };
}

export function normalizeAccessTradeBanner(input: unknown): AccessTradeBanner | null {
  if (!isRecord(input)) return null;

  const id = firstText(input.id, input.banner_id, input.bannerId);
  const imageUrl = firstText(input.image_url, input.imageUrl, input.image, input.banner_url, input.bannerUrl);
  if (!id || !imageUrl) return null;

  return {
    id,
    imageUrl,
    width: toNumber(input.width ?? input.banner_width),
    height: toNumber(input.height ?? input.banner_height),
    type: firstText(input.type, input.banner_type, input.format),
    affiliateLink: firstText(input.aff_link, input.affiliateLink, input.affiliate_link, input.link),
  };
}

/**
 * Batch version — maps each origin URL to its affiliate link.
 * AT returns success_link[] in the same order as the input urls[].
 * Falls back to the origin URL for any entry that fails to parse.
 */
export function normalizeAccessTradeTrackingLinks(
  payload: unknown,
  campaignId: string,
  originUrls: string[],
): Map<string, string> {
  const result = new Map<string, string>()
  const unwrapped = unwrapData(payload)
  if (!isRecord(unwrapped)) return result

  const rawLinks = Array.isArray(unwrapped.success_link)
    ? unwrapped.success_link
    : Array.isArray(unwrapped.successLink)
      ? unwrapped.successLink
      : []

  rawLinks.forEach((link, i) => {
    const origin = firstText(isRecord(link) ? (link.url_origin ?? link.urlOrigin) : null) ?? originUrls[i]
    if (!origin) return
    const affUrl = isRecord(link) ? firstText(link.aff_link, link.affiliateLink, link.short_link, link.shortLink) : null
    result.set(origin, affUrl ?? origin)
  })

  // For any input URL with no response entry, map to itself (safe fallback)
  for (const url of originUrls) {
    if (!result.has(url)) result.set(url, url)
  }

  return result
}

export function normalizeAccessTradeTrackingLink(payload: unknown, campaignId: string, originUrl: string): AccessTradeTrackingLink {
  const unwrapped = unwrapData(payload);
  if (!isRecord(unwrapped)) throw new AccessTradeApiError("schema_drift", "Tracking link payload is not an object");

  const rawLinks = Array.isArray(unwrapped.success_link)
    ? unwrapped.success_link
    : Array.isArray(unwrapped.successLink)
      ? unwrapped.successLink
      : [];

  if (rawLinks.length === 0) {
    throw new AccessTradeApiError("no_results", "No AccessTrade tracking link returned");
  }

  const first = rawLinks[0];
  if (!isRecord(first)) throw new AccessTradeApiError("schema_drift", "Tracking link payload shape is invalid");

  const shortLink = firstText(first.short_link, first.shortLink);
  const affiliateLink = firstText(first.aff_link, first.affiliateLink);
  const resolvedOrigin = firstText(first.url_origin, first.urlOrigin) ?? originUrl;

  if (!affiliateLink && !shortLink) {
    throw new AccessTradeApiError("schema_drift", "Tracking link payload is missing url fields");
  }

  return {
    campaignId,
    originUrl: resolvedOrigin,
    affiliateLink: affiliateLink ?? shortLink ?? originUrl,
    shortLink: shortLink ?? null,
    generatedAt: new Date().toISOString(),
  };
}
