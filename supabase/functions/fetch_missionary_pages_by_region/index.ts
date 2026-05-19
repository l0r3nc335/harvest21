
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ISO_TO_COUNTRY, COUNTRIES_BY_REGION } from "./iso_to_country.ts";

function findRegionByCountry(country: string): string | null {
  for (const region in COUNTRIES_BY_REGION) {
    if (COUNTRIES_BY_REGION[region].includes(country)) return region;
  }
  return null;
}

serve(async (req) => {
  const url = new URL(req.url);

  const regionParam = url.searchParams.get("region");
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 20);
  
  const cursorCreatedAt = url.searchParams.get("cursor_created_at");
  const cursorId = url.searchParams.get("cursor_id");
  const useCursor = cursorCreatedAt && cursorId;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const allowedRegions = [
    "europe",
    "asia",
    "australia",
    "south_america",
    "north_america",
    "africa"
  ];

  if (!regionParam || !allowedRegions.includes(regionParam)) {
    return new Response(
      JSON.stringify({
        error: "Invalid region. Must be one of: " + allowedRegions.join(", ")
      }),
      { status: 400 }
    );
  }

  // First get published missionary pages
  const { data: pages, error: pageError } = await supabase
    .from("pages")
    .select("organization_id, page_url, name, profile_photo_url, donation_percentage")
    .eq("organization_type", "missionary")
    .eq("is_published", true);

  if (pageError) {
    console.error("❌ Page error:", pageError);
    return new Response(JSON.stringify({ error: pageError.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!pages || pages.length === 0) {
    console.log("⚠️ No published missionary pages");
    return new Response(JSON.stringify({
      page, limit, total: 0, total_pages: 0, region: regionParam, data: []
    }), { headers: { "Content-Type": "application/json" } });
  }

  const missionaryIds = pages.map(p => p.organization_id);
  const pageMap = new Map(pages.map(p => [p.organization_id, p]));

  // Then get missionaries
  let query = supabase
    .from("missionaries")
    .select(`
      id,
      user_id,
      first_name,
      last_name,
      destination_country,
      country_of_residence,
      sending_church_id,
      mission_field_church_id,
      agency_id,
      college_id,
      is_managed_by_harvest21,
      created_at,
      mission_status,
      open_to_visits
    `)
    .in("id", missionaryIds);

  if (useCursor) {
    query = query
      .or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`)
      .limit(limit * 5);
  } else {
    // Increased to 2000 to ensure we get all missionaries
    query = query.limit(2000);
  }

  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  const { data: missionaries, error: fetchError } = await query;
  
  if (fetchError) {
    console.error("❌ Database error:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  console.log(`📊 Region: ${regionParam}, Fetched: ${missionaries?.length || 0} missionaries`);

  // Filter out missionaries whose user account is Inactive
  const missionaryUserIds = (missionaries || [])
    .map((m) => m.user_id)
    .filter((id): id is string => id != null);

  let activeUserIds = new Set<string>();
  if (missionaryUserIds.length > 0) {
    const { data: activeUsers } = await supabase
      .from("users")
      .select("user_id")
      .eq("status", "Active")
      .in("user_id", missionaryUserIds);
    activeUserIds = new Set((activeUsers || []).map((u) => u.user_id));
  }

  const activeMissionaries = (missionaries || []).filter(
    (m) => m.user_id && activeUserIds.has(m.user_id)
  );

  console.log(`📊 After Active-user filter: ${activeMissionaries.length} (${(missionaries?.length || 0) - activeMissionaries.length} excluded)`);

  const filtered = [];
  let skippedNoPage = 0;
  let skippedNoCountry = 0;
  let skippedWrongRegion = 0;
  const wrongRegions = new Set();

  for (const m of activeMissionaries) {
    // For cursor mode: stop when we have enough
    if (useCursor && filtered.length >= limit) break;

    const pageData = pageMap.get(m.id);
    if (!pageData) {
      skippedNoPage++;
      continue;
    }

    // Normalize ISO code: trim whitespace, lowercase, remove special chars
    const rawIso = m.destination_country || m.country_of_residence || "";
    const iso = rawIso.toString().trim().toLowerCase().replace(/[^a-z]/g, '');
    
    const country = ISO_TO_COUNTRY[iso];
    if (!country) {
      skippedNoCountry++;
      console.log(`⚠️ No country found for ISO: "${rawIso}" → normalized: "${iso}" (missionary ${m.id})`);
      continue;
    }

    const region = findRegionByCountry(country);
    if (region !== regionParam) {
      skippedWrongRegion++;
      wrongRegions.add(`${country}→${region}`);
      continue;
    }

    filtered.push({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      country,
      region,
      church_id: m.sending_church_id,
      mission_field_id: m.mission_field_church_id,
      agency_id: m.agency_id,
      college_id: m.college_id,
      page_url: pageData.page_url || null,
      profile_photo_url: pageData.profile_photo_url || null,
      page_name: pageData.name || null,
      is_managed_by_harvest21: m.is_managed_by_harvest21 ?? false,
      mission_status: m.mission_status || null,
      donation_percentage: pageData.donation_percentage || null,
      open_to_visits: m.open_to_visits || false,
      created_at: m.created_at
    });
  }
  
  console.log(`\n🔍 FILTERING RESULTS FOR: ${regionParam}`);
  console.log(`   📥 Total fetched: ${missionaries?.length || 0} (${(missionaries?.length || 0) - activeMissionaries.length} non-Active-user excluded)`);
  console.log(`   ✅ Matched region: ${filtered.length}`);
  console.log(`   ⚠️ Skipped (no page): ${skippedNoPage}`);
  console.log(`   ⚠️ Skipped (no ISO mapping): ${skippedNoCountry}`);
  console.log(`   ⚠️ Skipped (wrong region): ${skippedWrongRegion}`);
  if (wrongRegions.size > 0) {
    console.log(`   📍 Wrong regions:`, Array.from(wrongRegions).slice(0, 15).join(', '));
  }
  console.log(`\n`);

  if (useCursor) {
    const nextCursor = filtered.length === limit && filtered.length > 0
      ? {
          created_at: filtered[filtered.length - 1].created_at,
          id: filtered[filtered.length - 1].id
        }
      : null;

    return new Response(
      JSON.stringify({
        data: filtered,
        nextCursor,
        hasMore: nextCursor !== null
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const paginatedData = filtered.slice(offset, offset + limit);
  
  console.log(`✅ Region: ${regionParam}, Filtered: ${total}, Page: ${page}, Returning: ${paginatedData.length}`);
  
  return new Response(
    JSON.stringify({
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      region: regionParam,
      data: paginatedData
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
