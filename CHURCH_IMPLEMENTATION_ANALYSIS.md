# Church Landing Page - Complete Implementation Analysis

## Overview
This document provides a complete analysis of the Church Landing Page implementation to serve as a blueprint for the Mission Agency Landing Page.

---

## 1. Database Schema

### Tables
```sql
-- churches table
CREATE TABLE churches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar NOT NULL,
  contact_user_id uuid REFERENCES auth.users(id),
  phone_number varchar,
  address text,
  city varchar,
  country varchar,
  website text,
  created_at timestamptz DEFAULT now()
);

-- pages table (shared across all organization types)
CREATE TABLE pages (
  id bigint PRIMARY KEY,
  organization_type text CHECK (organization_type IN ('church', 'agency', 'college', 'missionary', 'donor')),
  organization_id bigint NOT NULL,
  page_url text UNIQUE,
  name text,
  banner_photo_url text,
  short_quote text,
  template_content text, -- JSON with fixed sections
  video_hashed_id varchar,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  ...
);

-- church_followers table (specific to churches only)
CREATE TABLE church_followers (
  id bigint PRIMARY KEY,
  church_id bigint REFERENCES churches(id),
  user_id uuid REFERENCES auth.users(id),
  status text CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  reviewed_by uuid,
  reviewed_at timestamptz
);

-- church_missionaries table (junction table)
CREATE TABLE church_missionaries (
  id bigint PRIMARY KEY,
  church_id bigint REFERENCES churches(id),
  missionary_id bigint REFERENCES missionaries(id),
  relationship_type text,
  is_active boolean
);
```

---

## 2. TypeScript Types (`types/church.ts`)

### Core Interfaces
```typescript
// Fixed sections - ALL required
export interface ChurchAboutUsContent {
  who_we_are: string;
  our_mission: string;
  our_vision: string;
  what_we_believe: string;
  our_ministries: string;
  join_us: string;
  contact_us: string;
}

export type ChurchFollowerStatus = 'none' | 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface Church {
  id: number;
  name: string;
  contact_user_id?: string | null;
  phone_number?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
}
```

---

## 3. Admin Editor (`components/admin/churches/ChurchAboutUsEditor.tsx`)

### Key Features
1. **Fixed 7 Sections** - Cannot add/remove sections
2. **Video Upload** (Optional) - Uses Supabase Storage
3. **Validation** - All 7 sections required before save
4. **Loading Overlay** - Shows during save/upload
5. **Character Counters** - 1000 chars per section
6. **Disabled Section Titles** - User cannot edit section names

### Fixed Sections Array
```typescript
const FIXED_SECTIONS = [
  { key: "who_we_are", label: "Who We Are", placeholder: "..." },
  { key: "our_mission", label: "Our Mission", placeholder: "..." },
  { key: "our_vision", label: "Our Vision", placeholder: "..." },
  { key: "what_we_believe", label: "What We Believe", placeholder: "..." },
  { key: "our_ministries", label: "Our Ministries", placeholder: "..." },
  { key: "join_us", label: "Join Us", placeholder: "..." },
  { key: "contact_us", label: "Contact Us", placeholder: "..." },
] as const;
```

### Content Validation
```typescript
const allSectionsComplete = FIXED_SECTIONS.every(
  (section) => content[section.key]?.trim().length > 0
);
```

### Video Upload Process
1. File selection → Local preview
2. Validation (type, size ≤ 500MB)
3. Upload via `/api/storage/signed-upload` endpoint
4. Progress tracking with XHR
5. Store public URL in `video_hashed_id` field

### Save Function
```typescript
const handleSave = async () => {
  if (!allSectionsComplete) {
    toast.error("Please complete all sections before saving");
    return;
  }

  // Upload video if pending
  let finalVideoUrl = videoUrl;
  if (videoFile) {
    finalVideoUrl = await handleUploadVideo();
  }

  // Save content as JSON string
  const result = await saveChurchAboutUs(churchId, content, finalVideoUrl);
};
```

---

## 4. Page Details Tab Integration

### How It Works
The `PageDetailsTab` component (`components/admin/shared/PageDetailsTab.tsx`) detects organization type and renders appropriate editor:

```typescript
{organizationType === "church" ? (
  <ChurchAboutUsEditor
    churchId={organizationId}
    pageId={pageData?.id || null}
    initialContent={parsedContent}
    initialVideoHashedId={pageData?.video_hashed_id || null}
    onSave={(content, videoHashedId) => {
      setPageData(prev => ({
        ...prev,
        template_content: JSON.stringify(content),
        video_hashed_id: videoHashedId,
      }));
    }}
  />
) : (
  <TemplateEditor ... /> // For other types
)}
```

### Key Differences from Other Types
- **No donation percentage field** for churches
- **No profile photo** on public view
- **Fixed sections** instead of flexible template
- **Follow system** (churches only)

---

## 5. Public View (`components/church/ChurchPublicView.tsx`)

### Structure
```
<ChurchPublicView>
  <Navbar /> (if not admin preview)
  
  <Banner Section>
    - Banner image
    - Church name (large, centered)
    - Short quote (italic, centered)
    - Follow button (centered)
    - Follower count
    - Admin controls (preview mode only)
  </Banner>
  
  <Tabs Navigation>
    - About Us (default)
    - Our Missionaries (restricted)
  </Tabs>
  
  <Tab Content>
    - About Us: 7 fixed sections + optional video
    - Missionaries: Grid of missionary cards (followers only)
  </Tab Content>
  
  <Footer />
</ChurchPublicView>
```

### Follow Button States
```typescript
switch (followerStatus) {
  case "none": 
    - Yellow button: "Follow Church"
    - Action: Send follow request
  case "pending":
    - Gray button: "Follow Request Sent" (disabled)
  case "accepted":
    - Green button: "Following"
    - Action: Show unfollow confirmation
  case "rejected":
    - Red button: "Request Rejected" (disabled)
  case "blocked":
    - Black button: "Blocked" (disabled)
}
```

### About Us Content Display
```typescript
{aboutUsContent ? (
  <div className="max-w-4xl mx-auto space-y-10">
    {/* Optional Video */}
    {page.video_hashed_id && (
      <video src={page.video_hashed_id} controls />
    )}
    
    {/* 7 Fixed Sections */}
    <section>
      <h2>Who We Are</h2>
      <div>{aboutUsContent.who_we_are}</div>
    </section>
    {/* ... repeat for all 7 sections */}
  </div>
) : (
  <div>No content available</div>
)}
```

### Missionaries Tab Access Control
```typescript
{!isLoggedIn ? (
  <div>Please log in to view missionaries</div>
) : !isAcceptedFollower ? (
  <div>You must be an approved follower</div>
) : missionaries.length === 0 ? (
  <div>No missionaries found</div>
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {missionaries.map(missionary => (
      <MissionaryCard key={missionary.id} missionary={missionary} />
    ))}
  </div>
)}
```

---

## 6. Admin Preview Mode

### Admin Controls (Overlay on Banner)
```typescript
{isAdminPreview && (
  <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
    <Button onClick={onBack}>
      <ArrowLeft /> Back to Settings
    </Button>
    
    {!isPublished && isActualAdmin && (
      <Button onClick={handleApprove}>
        <CheckCircle /> Approve This Page
      </Button>
    )}
    
    {isPublished && isActualAdmin && (
      <Button onClick={() => window.open(`/${page.page_url}`, "_blank")}>
        <ExternalLink /> View Public Page
      </Button>
    )}
  </div>
)}
```

### Approval Logic
```typescript
const handleApprove = async () => {
  const result = await approveOrganizationPage("church", page.id);
  if (result.success) {
    toast.success("Church page approved and published!");
    if (onBack) {
      onBack(); // Return to settings
    }
  }
};
```

---

## 7. Server Actions (`app/admin/churches/pageActions.ts` & `actions.ts`)

### saveChurchAboutUs
```typescript
export async function saveChurchAboutUs(
  churchId: number,
  content: ChurchAboutUsContent,
  videoHashedId: string | null
): Promise<{ success: boolean; error?: string }> {
  // Validate all sections completed
  const allSectionsComplete = Object.values(content).every(
    (value) => value.trim().length > 0
  );
  
  if (!allSectionsComplete) {
    return { success: false, error: "All sections must be completed" };
  }

  // Serialize content to JSON
  const templateContent = JSON.stringify(content);

  // Update pages table
  await supabaseAdmin
    .from("pages")
    .update({
      template_content: templateContent,
      video_hashed_id: videoHashedId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pageId);

  revalidatePath(`/admin/churches/${churchId}`);
  return { success: true };
}
```

### submitChurchPageForReview
```typescript
export async function submitChurchPageForReview(
  churchId: number
): Promise<{ success: boolean; error?: string }> {
  // Get church page
  const { data: page } = await supabaseAdmin
    .from("pages")
    .select("id, template_content")
    .eq("organization_type", "church")
    .eq("organization_id", churchId)
    .single();

  // Validate content is complete
  const content = JSON.parse(page.template_content);
  const allSectionsComplete = Object.values(content).every(
    (value) => value?.trim().length > 0
  );

  if (!allSectionsComplete) {
    return { success: false, error: "Complete all sections first" };
  }

  // Create approval request
  await supabaseAdmin
    .from("page_approvals")
    .insert({
      page_id: page.id,
      status: "Pending",
    });

  return { success: true };
}
```

---

## 8. Public Page Routing (`app/[page_url]/page.tsx`)

### Conditional Rendering
```typescript
if (organizationType === "church") {
  return <ChurchPublicView
    church={...}
    page={...}
    missionaries={organizationResult.data?.missionaries || []}
    followerStatus={organizationResult.data?.followerStatus || "none"}
    followerCount={organizationResult.data?.followerCount || 0}
  />;
}
```

### Data Fetching (getOrganizationPreviewBySlug)
```typescript
// For churches, fetch follower status and missionaries
if (organizationType === "church" && currentUserId) {
  // Get follower status
  const { data: followerData } = await supabaseAdmin
    .from("church_followers")
    .select("status")
    .eq("church_id", organizationId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  followerStatus = followerData?.status || "none";

  // Get follower count
  const { count } = await supabaseAdmin
    .from("church_followers")
    .select("*", { count: "exact", head: true })
    .eq("church_id", organizationId)
    .eq("status", "accepted");

  followerCount = count || 0;

  // If accepted follower, fetch missionaries
  if (followerData?.status === "accepted") {
    const { data: churchMissionaries } = await supabaseAdmin
      .from("church_missionaries")
      .select(`
        missionary_id,
        missionaries (
          id, first_name, last_name, country_of_residence,
          pages (page_url, profile_photo_url, name)
        )
      `)
      .eq("church_id", organizationId)
      .eq("is_active", true);

    missionaries = churchMissionaries.map(...);
  }
}
```

---

## 9. Styling & UI Consistency

### Tabs (Exactly Matching Missionaries)
```tsx
<div className="mb-8 mt-10 flex items-center justify-center overflow-x-auto rounded-full border border-white/10 bg-black/40 px-4 py-3 shadow-inner backdrop-blur">
  <nav className="flex min-w-full items-center justify-start gap-10 text-sm font-semibold uppercase tracking-wide">
    {tabs.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className="group relative px-1 py-1 text-center"
        >
          <span className={`transition-colors duration-200 ${
            isActive ? "text-white" : "text-[#a0a0a0] group-hover:text-[#E1B94D]"
          }`}>
            {tab.label}
          </span>
          <span className={`absolute left-0 right-0 -bottom-2 h-0.5 rounded-full transition-all duration-300 ${
            isActive ? "bg-[#E1B94D]" : "bg-transparent group-hover:bg-[#E1B94D]/60"
          }`} />
        </button>
      );
    })}
  </nav>
</div>
```

### Colors
- Primary: `#E1B94D` (yellow/gold)
- Background: `#000000` (black)
- Text: `#f5f5f5` (off-white)
- Hover: `#d4a639` (darker yellow)

### Banner Layout
- Fixed height: `300px` (mobile) to `400px` (desktop)
- Dark overlay: `bg-black/40` over banner image
- Gradient overlay at bottom: `bg-gradient-to-t from-black via-black/90`
- Content centered and overlaid on banner

---

## 10. Key Differences from Missionaries

| Feature | Church | Missionary |
|---------|--------|------------|
| **Follow System** | ✅ Yes (approval required) | ❌ No |
| **Profile Photo** | ❌ No | ✅ Yes (circular) |
| **Support %** | ❌ No | ✅ Yes |
| **Content Type** | Fixed 7 sections (JSON) | Flexible template |
| **Missionary Access** | Restricted to followers | N/A |
| **Donation %** | ❌ No field | ✅ Has field |

---

## 11. Approval Workflow

### States
1. **Draft** - `is_published = false`, no approval record
2. **Pending** - `is_published = false`, approval status = 'Pending'
3. **Approved** - `is_published = true`, approval status = 'Published'
4. **Rejected** - `is_published = false`, approval status = 'Rejected'

### First-Time Approval
- Submit button available until first approval
- Admin must approve before public visibility
- After first approval, submit button removed

### Post-Approval
- Changes publish immediately
- No re-approval required
- Matches church requirement (MA-LP-012)

---

## Summary for Agency Implementation

### What to Copy Exactly
✅ Fixed sections editor structure
✅ Video upload mechanism
✅ Validation logic
✅ Save functions
✅ Public view layout
✅ Tab navigation
✅ Banner structure
✅ Admin preview controls
✅ Approval workflow
✅ Server actions pattern
✅ TypeScript types structure
✅ Styling and colors

### What to Change
❌ Remove Follow button entirely
❌ Change section names/keys (6 sections vs 7)
❌ Remove follower-related logic
❌ Remove `church_followers` table references
❌ Missionaries tab is public (no access control)
❌ No follower count display

### Agency-Specific Sections
```typescript
const FIXED_SECTIONS = [
  { key: "who_we_are", label: "Who We Are" },
  { key: "mission_vision", label: "Mission / Vision" },
  { key: "what_we_do", label: "What We Do" },
  { key: "where_we_serve", label: "Where We Serve" },
  { key: "how_we_operate", label: "How We Operate" },
  { key: "values", label: "Values" },
  { key: "contact_information", label: "Contact Information" },
];
```

---

**End of Analysis**

