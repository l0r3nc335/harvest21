import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ISO_TO_COUNTRY, COUNTRIES_BY_REGION } from "./iso_to_country.ts";

function getRegionForCountry(countryName) {
  if (!countryName) return "other";
  for (const [region, countries] of Object.entries(COUNTRIES_BY_REGION)){
    if (countries.some((c)=>c.toLowerCase() === countryName.toLowerCase())) {
      return region;
    }
  }
  return "other";
}

serve(async (req)=>{
  try {
    // Get Authorization header if present
    const authHeader = req.headers.get('Authorization');
    
    // Create Supabase client with auth header only if it exists
    const supabaseOptions: { global?: { headers: { Authorization: string } } } = {};
    if (authHeader) {
      supabaseOptions.global = {
        headers: { Authorization: authHeader },
      };
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"), 
      Deno.env.get("SUPABASE_ANON_KEY"),
      supabaseOptions
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const url = new URL(req.url);
    const limitPerRegion = parseInt(url.searchParams.get("limit_per_region") || "10");

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    let currentUserMissionaryId = null;
    if (userId) {
      const { data: missionaryData } = await supabaseAdmin
        .from("missionaries")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      
      currentUserMissionaryId = missionaryData?.id || null;
    }

    // First get all published missionary pages
    const { data: pages, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("id, name, organization_id, page_url, profile_photo_url, is_published, donation_percentage")
      .eq("organization_type", "missionary")
      .eq("is_published", true);

    if (pageError) {
      console.error("❌ Page fetch error:", pageError);
      throw pageError;
    }

    if (!pages || pages.length === 0) {
      console.log("⚠️ No published missionary pages found");
      return new Response(JSON.stringify({}), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300"
        }
      });
    }

    const missionaryIds = pages.map(p => p.organization_id);
    const pageMap = new Map(pages.map(p => [p.organization_id, p]));

    // Get ALL missionaries (no limit to ensure we get all regions represented)
    const { data: rawMissionaries, error: fetchError } = await supabaseAdmin
      .from("missionaries")
      .select(`
        id,
        first_name,
        last_name,
        destination_country,
        country_of_residence,
        sending_church_id,
        mission_field_church_id,
        agency_id,
        college_id,
        mission_status,
        open_to_visits,
        created_at
      `)
      .in("id", missionaryIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (fetchError) {
      console.error("❌ Fetch error:", fetchError);
      throw fetchError;
    }

    console.log("📊 Total missionaries fetched:", rawMissionaries?.length || 0);

    // Look up mission field churches for missionaries that have mission_field_church_id set
    const missionFieldChurchIds = Array.from(
      new Set(
        (rawMissionaries || [])
          .map((m: { mission_field_church_id?: number | null }) => m.mission_field_church_id)
          .filter((id: number | null | undefined): id is number => id != null)
      )
    );

    const missionFieldChurchNameMap = new Map<number, string>();
    if (missionFieldChurchIds.length > 0) {
      const { data: missionFieldChurches, error: missionFieldError } = await supabaseAdmin
        .from("churches")
        .select("id, name")
        .in("id", missionFieldChurchIds);

      if (missionFieldError) {
        console.error("❌ Error fetching mission field churches:", missionFieldError);
      } else {
        (missionFieldChurches || []).forEach((c: { id: number; name: string | null }) => {
          if (c && typeof c.id === "number" && c.name) {
            missionFieldChurchNameMap.set(c.id, c.name);
          }
        });
      }
    }

    let followerStatusMap = new Map();
    if (userId) {
      const { data: follows } = await supabase
        .from("missionary_followers")
        .select("missionary_id, status")
        .eq("user_id", userId);
      
      follows?.forEach(f => followerStatusMap.set(f.missionary_id, f.status));
    }

    // Group by region first, then limit per region
    const allByRegion = new Map();
    let skippedNoPage = 0;
    let skippedNoMapping = 0;
    let skippedOther = 0;

    for (const m of rawMissionaries || []) {
      const pageData = pageMap.get(m.id);
      if (!pageData) {
        skippedNoPage++;
        continue;
      }

      // Normalize ISO code
      const rawCode = m.destination_country || "";
      const destinationCode = rawCode.toString().trim().toLowerCase().replace(/[^a-z]/g, '');
      const destinationCountry = ISO_TO_COUNTRY[destinationCode];
      
      if (!destinationCountry) {
        skippedNoMapping++;
        console.log(`⚠️ No mapping for: "${rawCode}" → "${destinationCode}"`);
        continue;
      }

      const region = getRegionForCountry(destinationCountry);
      
      if (!region || region === "other") {
        skippedOther++;
        console.log(`⚠️ No region or "other" for: ${destinationCountry}`);
        continue;
      }

      if (!allByRegion.has(region)) {
        allByRegion.set(region, []);
      }

      const followerStatus = followerStatusMap.get(m.id) || "none";
      const isOwner = currentUserMissionaryId === m.id;

      allByRegion.get(region).push({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        country: destinationCountry,
        region: region,
        destination_country: m.destination_country,
        country_of_residence: m.country_of_residence,
        church_id: m.sending_church_id,
        mission_field_id: m.mission_field_church_id,
        agency_id: m.agency_id,
        college_id: m.college_id,
        page_url: pageData.page_url,
        profile_photo_url: pageData.profile_photo_url,
        page_name: pageData.name,
        // Prefer mission field church name for display on cards/carousels
        mission_field_church_name: m.mission_field_church_id
          ? missionFieldChurchNameMap.get(m.mission_field_church_id) ?? null
          : null,
        follower_status: followerStatus,
        is_owner: isOwner,
        mission_status: m.mission_status ?? null,
        donation_percentage: pageData.donation_percentage ?? null,
        open_to_visits: m.open_to_visits ?? false,
        created_at: m.created_at
      });
    }

    console.log(`\n📊 GROUPING SUMMARY:`);
    console.log(`   Total fetched: ${rawMissionaries?.length || 0}`);
    console.log(`   Skipped (no page): ${skippedNoPage}`);
    console.log(`   Skipped (no ISO mapping): ${skippedNoMapping}`);
    console.log(`   Skipped (no region/other): ${skippedOther}`);
    console.log(`   Regions found: ${allByRegion.size}`);
    for (const [region, missionaries] of allByRegion.entries()) {
      console.log(`      ${region}: ${missionaries.length} total`);
    }

    // Sort each region by created_at DESC, then limit to limitPerRegion
    const grouped = {};
    for (const [region, missionaries] of allByRegion.entries()) {
      const sorted = missionaries.sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return b.id - a.id;
      });
      grouped[region] = sorted.slice(0, limitPerRegion);
    }

    console.log(`\n✅ FINAL RESULT (limited to ${limitPerRegion} per region):`);
    for (const region of Object.keys(grouped)) {
      console.log(`   ${region}: ${grouped[region].length}`);
    }

    return new Response(JSON.stringify(grouped, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({
      error: err.message || "An unexpected error occurred"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
