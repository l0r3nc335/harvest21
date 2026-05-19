const CTA_LINES = "\n\nSee more updates at\n";

export function buildSocialCaption(missionaryText: string, pageSlug: string): string {
  const base = process.env.NEXT_PUBLIC_SOCIAL_CTA_BASE_URL?.replace(/\/$/, "")
    || process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
    || "https://Harvest21.com";
  const host = base.replace(/^https?:\/\//i, "");
  const slug = pageSlug.replace(/^\//, "").trim();
  const body = missionaryText.trim() || "New update";
  return `${body}${CTA_LINES}${host}/${slug}`;
}
