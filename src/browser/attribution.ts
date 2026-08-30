import { type AnalyticsAttribution, safeCampaignLabel } from "../contracts/analytics-event.js";

const PAID_CLICK_PARAMETERS = [
  ["gclid", "google"],
  ["dclid", "google"],
  ["gbraid", "google"],
  ["wbraid", "google"],
  ["msclkid", "microsoft"],
  ["fbclid", "meta"],
  ["ttclid", "tiktok"],
  ["yclid", "yandex"],
] as const;

export function attributionFromUrl(url: URL): AnalyticsAttribution | undefined {
  const attribution: AnalyticsAttribution = {};
  const labels = {
    campaign: "utm_campaign",
    content: "utm_content",
    medium: "utm_medium",
    source: "utm_source",
    term: "utm_term",
  } as const;

  for (const [field, parameter] of Object.entries(labels)) {
    const label = safeCampaignLabel(url.searchParams.get(parameter));
    if (label) attribution[field as keyof typeof labels] = label;
  }

  const paidClick = PAID_CLICK_PARAMETERS.find(([parameter]) => url.searchParams.has(parameter));
  if (paidClick) {
    attribution.paid_click_present = true;
    attribution.paid_click_provider = paidClick[1];
  }

  return Object.keys(attribution).length > 0 ? attribution : undefined;
}
