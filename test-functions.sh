#!/bin/bash

echo "🧪 Testing Supabase Edge Functions"
echo "===================================="
echo ""

# Get Supabase URL from env
source .env.develop
SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
SUPABASE_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

echo "📍 Supabase URL: $SUPABASE_URL"
echo ""

# Test 1: Overview function
echo "1️⃣ Testing fetch_missionaries_overview..."
curl -s "$SUPABASE_URL/functions/v1/fetch_missionaries_overview" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  | jq 'keys' 2>/dev/null || echo "❌ Failed or no data"

echo ""
echo ""

# Test 2: Region function - Africa
echo "2️⃣ Testing fetch_missionary_pages_by_region (africa)..."
curl -s "$SUPABASE_URL/functions/v1/fetch_missionary_pages_by_region?region=africa&page=1&limit=5" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  | jq '{total: .total, returned: (.data | length), region: .region}' 2>/dev/null || echo "❌ Failed"

echo ""
echo ""

# Test 3: Region function - Asia
echo "3️⃣ Testing fetch_missionary_pages_by_region (asia)..."
curl -s "$SUPABASE_URL/functions/v1/fetch_missionary_pages_by_region?region=asia&page=1&limit=5" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  | jq '{total: .total, returned: (.data | length), region: .region}' 2>/dev/null || echo "❌ Failed"

echo ""
echo ""

# Test 4: Region function - Australia
echo "4️⃣ Testing fetch_missionary_pages_by_region (australia)..."
curl -s "$SUPABASE_URL/functions/v1/fetch_missionary_pages_by_region?region=australia&page=1&limit=5" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  | jq '{total: .total, returned: (.data | length), region: .region}' 2>/dev/null || echo "❌ Failed"

echo ""
echo ""

echo "✅ Tests complete! Check results above."
echo ""
echo "To view full logs in Supabase:"
echo "https://supabase.com/dashboard/project/kstznftkyihjchkfkcah/functions"
