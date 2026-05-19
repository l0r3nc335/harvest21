import { after } from "next/server";
import { executeSocialCrossPost, type SocialCrossPostInput } from "@/lib/social-cross-post";

export function scheduleSocialCrossPost(input: SocialCrossPostInput): void {
  after(async () => {
    try {
      await executeSocialCrossPost(input);
    } catch (e) {
      console.error("scheduleSocialCrossPost:", e);
    }
  });
}
