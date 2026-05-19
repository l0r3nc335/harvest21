const GRAPH = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH}`;

export type MetaPageAccount = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string } | null;
};

export async function exchangeCodeForShortUserToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string }> {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) {
    throw new Error("META_APP_ID or META_APP_SECRET missing");
  }
  const params = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${BASE}/oauth/access_token?${params}`);
  const data = (await res.json()) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || "Token exchange failed");
  }
  return { access_token: data.access_token };
}

export async function exchangeForLongLivedUserToken(shortToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) {
    throw new Error("META_APP_ID or META_APP_SECRET missing");
  }
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${BASE}/oauth/access_token?${params}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || "Long-lived token exchange failed");
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

export async function fetchUserPages(userAccessToken: string): Promise<MetaPageAccount[]> {
  const fields = "id,name,access_token,instagram_business_account{id,username}";
  const res = await fetch(
    `${BASE}/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}`
  );
  const data = (await res.json()) as {
    data?: MetaPageAccount[];
    error?: { message?: string };
  };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || "Failed to list pages");
  }
  return data.data || [];
}

export async function verifyPageAccess(pageId: string, pageAccessToken: string): Promise<boolean> {
  const res = await fetch(
    `${BASE}/${pageId}?fields=id&access_token=${encodeURIComponent(pageAccessToken)}`
  );
  return res.ok;
}

export async function postFacebookFeedText(
  pageId: string,
  pageAccessToken: string,
  message: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    message,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${BASE}/${pageId}/feed`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Facebook feed post failed");
  }
  return { id: data.id };
}

export async function postFacebookPhoto(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ id: string; post_id?: string }> {
  const body = new URLSearchParams({
    url: imageUrl,
    caption,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${BASE}/${pageId}/photos`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Facebook photo post failed");
  }
  return { id: data.id, post_id: data.post_id };
}

export async function postFacebookVideo(
  pageId: string,
  pageAccessToken: string,
  fileUrl: string,
  description: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    file_url: fileUrl,
    description,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${BASE}/${pageId}/videos`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Facebook video post failed");
  }
  return { id: data.id };
}

export async function createInstagramMediaImage(
  igUserId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${BASE}/${igUserId}/media`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram media create failed");
  }
  return { id: data.id };
}

export async function createInstagramMediaVideo(
  igUserId: string,
  pageAccessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    media_type: "VIDEO",
    video_url: videoUrl,
    caption,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${BASE}/${igUserId}/media`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram video container failed");
  }
  return { id: data.id };
}

export async function publishInstagramMedia(
  igUserId: string,
  pageAccessToken: string,
  creationId: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    creation_id: creationId,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${BASE}/${igUserId}/media_publish`, {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram publish failed");
  }
  return { id: data.id };
}

export async function waitForInstagramMediaReady(
  igUserId: string,
  pageAccessToken: string,
  creationId: string,
  maxAttempts = 30,
  delayMs = 2000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${BASE}/${creationId}?fields=status_code&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const data = (await res.json()) as { status_code?: string; error?: { message?: string } };
    if (data.status_code === "FINISHED") {
      return;
    }
    if (data.status_code === "ERROR") {
      throw new Error(data.error?.message || "Instagram media processing failed");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Instagram media processing timeout");
}
