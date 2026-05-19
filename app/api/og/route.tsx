import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "Prayer Request";
  const body = searchParams.get("body") || "";
  const name = searchParams.get("name") || "Harvest21";
  const type = searchParams.get("type") || "prayer";
  const logoUrl = process.env.HARVEST_21_LOGO || "";

  const truncatedBody = body.length > 280 ? body.slice(0, 277) + "..." : body;

  const labelMap: Record<string, string> = {
    prayer: "Prayer Request",
    update_letter: "Update Letter",
    photo: "Photo",
    video: "Video",
  };

  const label = labelMap[type] || "Harvest21";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              background: "#E1B94D",
              color: "#000",
              padding: "6px 18px",
              borderRadius: "20px",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            {label}
          </div>
          <div style={{ color: "#a0a0a0", fontSize: "22px" }}>{name}</div>
        </div>

        <div
          style={{
            fontSize: title.length > 60 ? "36px" : "48px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.3,
            marginBottom: "20px",
            display: "flex",
          }}
        >
          {title}
        </div>

        {truncatedBody && (
          <div
            style={{
              fontSize: "26px",
              color: "#c0c0c0",
              lineHeight: 1.5,
              display: "flex",
            }}
          >
            {truncatedBody}
          </div>
        )}

        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Harvest21"
            style={{ position: "absolute", bottom: "36px", right: "60px", height: "40px" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              right: "60px",
              fontSize: "20px",
              color: "#E1B94D",
              fontWeight: 600,
              display: "flex",
            }}
          >
            Harvest21
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
