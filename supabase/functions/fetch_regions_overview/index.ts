import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ISO_TO_COUNTRY, COUNTRIES_BY_REGION } from "./iso_to_country.ts";
// ✅ Compact ISO to Country (common codes only; extend if needed)
// ✅ Complete ISO-3166-1 alpha-2 → country name mapping
// 🧩 Helper: Determine region by country
function getRegionForCountry(countryName) {
  if (!countryName) return "other";
  for (const [region, countries] of Object.entries(COUNTRIES_BY_REGION)){
    if (countries.some((c)=>c.toLowerCase() === countryName.toLowerCase())) {
      return region;
    }
  }
  return "other";
}
serve(async ()=>{
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Step 1️⃣: Fetch all published missionary pages
    const { data: pages, error: pageError } = await supabaseAdmin.from("pages").select("*").eq("organization_type", "missionary").eq("is_published", true);
    if (pageError) throw pageError;
    if (!pages?.length) {
      return new Response(JSON.stringify([]), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Step 2️⃣: Fetch missionaries linked to pages
    const missionaryIds = pages.map((p)=>p.organization_id);
    const { data: missionariesRaw, error: mError } = await supabaseAdmin.from("missionaries").select("id, user_id, destination_country, first_name, last_name").in("id", missionaryIds);
    if (mError) throw mError;
    const userIds = [...new Set((missionariesRaw || []).map((m)=>m.user_id).filter(Boolean))];
    let activeUserIds = new Set<string>();
    if (userIds.length > 0) {
      const { data: activeUsers } = await supabaseAdmin.from("users").select("user_id").eq("status", "Active").in("user_id", userIds);
      activeUserIds = new Set((activeUsers || []).map((u)=>u.user_id));
    }
    const missionaries = (missionariesRaw || []).filter((m)=>m.user_id && activeUserIds.has(m.user_id));
    // Step 3️⃣: Merge data
    // Step 3️⃣: Merge & enrich data
    const joined = pages.map((p)=>{
      const m = missionaries.find((mm)=>mm.id === p.organization_id);
      if (!m) return null;
      const code = m.destination_country?.toLowerCase();
      const country = ISO_TO_COUNTRY[code] || m.destination_country || "Unknown";
      const region = getRegionForCountry(country);
      return {
        first_name: m.first_name,
        last_name: m.last_name,
        country,
        region
      };
    }).filter(Boolean);
    // Step 4️⃣: Group by region
    const grouped = {};
    for (const missionary of joined){
      const { region } = missionary;
      if (!grouped[region]) grouped[region] = [];
      grouped[region].push(missionary);
    }
    // ✅ Step 6️⃣: Return response
    return new Response(JSON.stringify(grouped), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
