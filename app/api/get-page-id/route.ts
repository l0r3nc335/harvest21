import { getPageIdForCurrentUser } from "@/app/settings/actions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pageId = await getPageIdForCurrentUser();
    
    if (!pageId) {
      return NextResponse.json(
        { error: "Page not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ pageId });
  } catch (error) {
    console.error("Error fetching page ID:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

