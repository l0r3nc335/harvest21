import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Start the Edge Function
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  // --- Parse request body
  let body;
  try {
    body = await req.json();
  } catch  {
    return new Response(JSON.stringify({
      error: "Invalid JSON body"
    }), {
      status: 400
    });
  }
  const { user_id } = body;
  // --- Validate user_id
  if (!user_id || typeof user_id !== "string" || user_id === "undefined") {
    return new Response(JSON.stringify({
      error: "Missing or invalid user_id"
    }), {
      status: 400
    });
  }
  // --- Step 1: Fetch user info and role
  const { data: user, error: userError } = await supabase.from("users").select("id, first_name, last_name, email, role").eq("user_id", user_id).single();
  if (userError || !user) {
    return new Response(JSON.stringify({
      error: userError?.message || "User not found"
    }), {
      status: 404
    });
  }
  // --- Role map definition
  const roleMap = {
    3: {
      table: "missionaries",
      type: "missionary",
      userField: "user_id"
    },
    4: {
      table: "donors",
      type: "supporter",
      userField: "user_id"
    },
    5: {
      table: "agencies",
      type: "agency",
      userField: "contact_user_id"
    },
    6: {
      table: "churches",
      type: "church",
      userField: "contact_user_id"
    },
    7: {
      table: "colleges",
      type: "college",
      userField: "contact_user_id"
    }
  };
  const roleInfo = roleMap[user.role];
  let page_url = null;
  let profile_photo_url = null;
  // --- Step 2: Get related organization & page
  if (roleInfo) {
    const { data: orgData, error: orgError } = await supabase.from(roleInfo.table).select("id").eq(roleInfo.userField, user_id).single();
    if (!orgError && orgData) {
      const { data: pageData } = await supabase.from("pages").select("page_url, profile_photo_url").eq("organization_id", orgData.id).eq("organization_type", roleInfo.type).single();
      if (pageData) {
        page_url = pageData.page_url;
        profile_photo_url = pageData.profile_photo_url;
      }
    }
  }
  // --- Return final response
  return new Response(JSON.stringify({
    ...user,
    page_url,
    profile_photo_url
  }), {
    headers: {
     "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300"
    },
    status: 200
  });
});
