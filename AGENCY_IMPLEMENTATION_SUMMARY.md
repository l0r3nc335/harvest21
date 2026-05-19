# Agency Landing Page Implementation Summary

## Overview
Mission Agency Landing Page implementation following the church blueprint (MA-LP-001 to MA-LP-017). All agencies use the existing `pages` table structure with fixed content sections.

---

## Files Created

### 1. Types Definition
**File**: `types/agency.ts`
- `Agency` - Main agency interface
- `AgencyPage` - Page-specific data structure
- `AgencyAboutUsContent` - 7 fixed sections interface:
  - `who_we_are`
  - `mission_vision`
  - `what_we_do`
  - `where_we_serve`
  - `how_we_operate`
  - `values`
  - `contact_information`
- `AgencyPublicViewData` - Complete public view data structure

### 2. Database Migration
**File**: `supabase/migrations/create_agency_landing_page.sql`
- Adds columns to `pages` table if not exists (safe to run):
  - `name` - Agency display name
  - `template_content` - JSON for 7 fixed sections
  - `video_hashed_id` - Background video URL
  - `donation_percentage` - Support percentage
- Creates index on `missionaries.agency_id` for efficient lookups
- Adds `is_agency_owner()` helper function

**Note**: No new tables created! Uses existing:
- `agencies` table (already exists)
- `pages` table (shared across all org types)
- `missionaries` table (with existing `agency_id` column)

### 3. Admin Components
**File**: `components/admin/agencies/AgencyAboutUsEditor.tsx`
- Fixed 7-section editor for agency About Us content
- Optional video upload (Supabase Storage)
- Character counters (1000 chars per section)
- All sections required before saving
- Matches church editor styling exactly

### 4. Server Actions
**File**: `app/admin/agencies/pageActions.ts`
- `saveAgencyAboutUs()` - Save 7-section content + video (MA-LP-006)
- `submitAgencyPageForReview()` - Submit for admin approval (MA-LP-008)
- `updateAgencyPageDetails()` - Update page metadata (MA-LP-004)

### 5. Public View Component
**File**: `components/agency/AgencyPublicView.tsx`
- Default landing on "About" tab (MA-LP-001)
- Agency name + short quote (centered, simple) (MA-LP-002)
- Background video support (MA-LP-007)
- 7 fixed About Us sections with titles (MA-LP-006)
- "Our Missionaries" tab (publicly accessible) (MA-LP-013, MA-LP-015)
- Admin preview controls (MA-LP-008)
- Responsive design matching missionary/church theme
- No follow system (unlike churches)

---

## Files Modified

### 1. PageDetailsTab Component
**File**: `components/admin/shared/PageDetailsTab.tsx`
**Changes**:
- Added `AgencyAboutUsEditor` import
- Conditional rendering for agency type:
  - Shows "Agency Name" label (not "Photo Name")
  - Renders `AgencyAboutUsEditor` (not template editor)
  - "About Your Agency" section header
- Imports `AgencyAboutUsContent` type

### 2. EntityManagePage Component
**File**: `components/admin/shared/EntityManagePage.tsx`
**Changes**:
- Added `AgencyPublicView` import
- Conditional preview rendering for agencies:
  - Uses `AgencyPublicView` for preview (not `OrganizationInlinePreview`)
  - Passes `missionaries` data (empty array in preview)
  - Includes admin controls

### 3. Public Page Routing
**File**: `app/[page_url]/page.tsx`
**Changes**:
- Added `AgencyPublicView` import
- Conditional routing for `organizationType === "agency"`:
  - Renders `AgencyPublicView` with full data
  - Passes missionaries array from `organizationResult`
  - Excludes agencies from generic `OrganizationPublicView`

### 4. Public Page Data Fetching
**File**: `app/[page_url]/actions.ts`
**Changes**:
- Added missionary fetching for agencies in `getOrganizationPreviewBySlug()`:
  - Queries `missionaries` table with `agency_id` filter
  - Joins with `pages` table (only published pages)
  - Sorts alphabetically by last name
  - Publicly accessible (no authentication required) (MA-LP-015)
- Returns `missionaries` array in `OrganizationPublicData`

---

## Key Differences from Churches

| Feature | Churches | Agencies |
|---------|----------|----------|
| **Follow System** | ✅ Yes (with approval) | ❌ No |
| **Missionary Access** | 🔒 Followers only | 🌐 Public (MA-LP-015) |
| **Missionary Relationship** | `church_missionaries` junction table | Direct `missionaries.agency_id` |
| **Profile Picture** | ✅ Yes | ❌ No (agency pages are simpler) |
| **Support Percentage** | ✅ Yes | ❌ No |
| **Tabs** | About, Our Missionaries | About, Our Missionaries |

---

## Database Schema Usage

### Existing Tables Used
1. **`agencies`** - Organization details (already exists)
2. **`missionaries`** - Linked via existing `agency_id` column
3. **`pages`** - Shared page content (`organization_type = 'agency'`)
4. **`page_media`** - Media gallery
5. **`page_approvals`** - Approval workflow

### No New Tables Created
All agency functionality uses existing schema. The migration only:
- Adds missing columns to `pages` (if needed)
- Creates an index for performance
- Adds a helper function

---

## Implementation Checklist

✅ **MA-LP-001**: Default landing on About tab  
✅ **MA-LP-002**: Agency hero section (name + quote)  
✅ **MA-LP-003**: Not applicable (no follow button for agencies)  
✅ **MA-LP-004**: Agency page details editor  
✅ **MA-LP-005**: Not applicable (no follow button)  
✅ **MA-LP-006**: 7 fixed About Us sections  
✅ **MA-LP-007**: Optional background video  
✅ **MA-LP-008**: Submit for admin approval  
✅ **MA-LP-009**: Validation (all sections required)  
✅ **MA-LP-010**: Not applicable (no access restrictions)  
✅ **MA-LP-011**: Not applicable (no access denied message)  
✅ **MA-LP-012**: Not applicable (no followers)  
✅ **MA-LP-013**: Our Missionaries tab  
✅ **MA-LP-014**: Alphabetical sorting (last name)  
✅ **MA-LP-015**: Publicly accessible missionaries tab  
✅ **MA-LP-016**: Responsive design (matches theme)  
✅ **MA-LP-017**: Loading, error, empty states  

---

## Testing Instructions

### 1. Run Migration
```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/create_agency_landing_page.sql
```

### 2. Admin Testing
1. Navigate to `/admin/agencies`
2. Select or create an agency
3. Go to "Page Details" tab
4. Fill in all 7 "About Your Agency" sections
5. Optionally upload a background video
6. Click "Save Changes"
7. Click "Preview" button to see admin preview
8. Click "Approve This Page" (if admin)

### 3. Public Testing
1. Navigate to `/{agency-page-url}`
2. Verify default "About" tab is active
3. Verify 7 sections display correctly
4. Check background video plays (if uploaded)
5. Click "Our Missionaries" tab
6. Verify missionaries display (if agency has any)
7. Test on mobile devices (Android & iOS browsers)

### 4. Verify No Breaking Changes
- ✅ Churches still work correctly
- ✅ Missionaries still work correctly
- ✅ Colleges still work correctly (use generic view)
- ✅ Admin panel tabs all functional

---

## Missionary Assignment

To link missionaries to agencies:

### Option 1: Via Admin Panel (Future)
Will use the "Missionaries" tab in agency settings.

### Option 2: Via Database (Current)
Update the `missionaries` table:

```sql
UPDATE missionaries
SET agency_id = {agency_id}
WHERE id = {missionary_id};
```

The public view will automatically display these missionaries.

---

## Video Upload Implementation

Agencies use **Supabase Storage** (same as churches and missionaries):

**Storage Path**: `h21-dev/agencies/{agency_id}/videos/{filename}`

**Upload Process**:
1. Client requests signed URL from `/api/storage/signed-upload`
2. Client uploads directly to Supabase Storage
3. Public URL saved to `pages.video_hashed_id`

**Preview**: Native `<video>` tag (not Wistia/Bunny.net)

---

## Design Consistency

All agency pages follow the **existing theme**:
- ✅ Black background (`bg-black`)
- ✅ Yellow accent color (`#E1B94D`)
- ✅ White/zinc text colors
- ✅ Same tab styling as missionary pages
- ✅ Same button styling
- ✅ Same responsive breakpoints
- ✅ Same spacing and padding

---

## Next Steps (Optional Enhancements)

1. **Missionary Management Tab**: Add UI to assign/remove missionaries
2. **Statistics**: Show missionary count, countries served, etc.
3. **Filtering**: Filter missionaries by country/status
4. **Agency Logo**: Add profile picture support (currently removed)
5. **Contact Form**: Add "Contact Agency" functionality

---

## Support

For issues or questions about the agency implementation:
1. Check this document first
2. Compare with `CHURCH_IMPLEMENTATION_ANALYSIS.md`
3. Review missionary implementation for reference
4. Check Supabase logs for database errors
5. Check browser console for client errors

---

**Implementation Date**: January 12, 2026  
**Status**: ✅ Complete and Ready for Testing  
**Breaking Changes**: None - all changes are additive

