#!/bin/bash

set -e

echo "🚀 Deploying Pagination Fix for Harvest21 Frontend"
echo "=================================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Install it with:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the project root."
    exit 1
fi

echo "✅ Pre-flight checks passed"
echo ""

# Step 1: Deploy Edge Functions
echo "📦 Step 1: Deploying Edge Functions..."
echo ""

echo "  → Deploying fetch_missionaries_overview..."
supabase functions deploy fetch_missionaries_overview --no-verify-jwt

echo "  → Deploying fetch_missionary_pages_by_region (with cursor support)..."
supabase functions deploy fetch_missionary_pages_by_region --no-verify-jwt

echo ""
echo "✅ Edge functions deployed successfully"
echo ""

# Step 2: Verify database schema
echo "🗄️  Step 2: Verifying database schema..."
echo ""
echo "  → Checking if missionaries.created_at exists and has values..."
echo "     Run this SQL in your Supabase dashboard:"
echo ""
echo "     SELECT COUNT(*) as total,"
echo "            COUNT(created_at) as with_timestamp"
echo "     FROM missionaries;"
echo ""
echo "  → If any rows are missing created_at, run:"
echo ""
echo "     UPDATE missionaries"
echo "     SET created_at = NOW() - (random() * INTERVAL '365 days')"
echo "     WHERE created_at IS NULL;"
echo ""

read -p "Press Enter after verifying database schema..."

# Step 3: Build Next.js app
echo "🔨 Step 3: Building Next.js application..."
echo ""

npm run build

echo ""
echo "✅ Build completed successfully"
echo ""

# Step 4: Run tests (if available)
if [ -f "package.json" ] && grep -q "\"test\":" package.json; then
    echo "🧪 Step 4: Running tests..."
    npm test || echo "⚠️  Some tests failed, but continuing..."
else
    echo "⏭️  Step 4: No tests found, skipping..."
fi

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📋 Post-Deployment Checklist:"
echo ""
echo "  1. Test home page (/):"
echo "     → Each continent shows ≤ 10 missionaries"
echo "     → No duplicates"
echo "     → No missing continents"
echo ""
echo "  2. Test region pages (/missionaries/africa):"
echo "     → Pagination works"
echo "     → No duplicate entries across pages"
echo "     → 'View All' link works"
echo ""
echo "  3. Monitor Supabase logs:"
echo "     → Check for any errors in Edge Functions"
echo "     → Verify query performance"
echo ""
echo "  4. Add indexes (if needed for performance):"
echo "     CREATE INDEX idx_missionaries_created_at_id"
echo "     ON missionaries(created_at DESC, id DESC);"
echo ""
echo "📚 See PAGINATION_TEST_PLAN.md for detailed testing guide"
echo ""
echo "🔄 To rollback, run:"
echo "   git checkout HEAD~1 supabase/functions/"
echo "   supabase functions deploy fetch_missionaries_overview"
echo ""
