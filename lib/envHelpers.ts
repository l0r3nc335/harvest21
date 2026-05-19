export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const raw = process.env.NEXT_PUBLIC_APP_URL;
    // Ensure we always return a fully qualified URL with scheme
    if (!/^https?:\/\//i.test(raw)) {
      return `https://${raw}`;
    }
    return raw;
  }

  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl.includes("staging.harvest21.com")) {
      return "https://staging.harvest21.com";
    }
    if (vercelUrl.includes("harvest21.com") && !vercelUrl.includes("staging")) {
      return "https://harvest21.com";
    }
    return `https://${vercelUrl}`;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "https://harvest21.com";
  }

  if (process.env.VERCEL_ENV === "preview" || process.env.NEXT_PUBLIC_ENV === "staging") {
    return "https://staging.harvest21.com";
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "staging.harvest21.com") {
      return "https://staging.harvest21.com";
    }
    if (hostname === "harvest21.com") {
      return "https://harvest21.com";
    }
  }

  return "http://localhost:3000";
}

export function getApiUrl(path: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

