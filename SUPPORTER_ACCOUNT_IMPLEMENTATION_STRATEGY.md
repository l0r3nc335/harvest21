# Supporter Account Implementation Strategy

## Executive Summary

This document outlines the complete implementation strategy for Supporter Account features including Authentication, Profile Management, and Following functionality. The implementation leverages existing patterns and components from the missionary and church follow systems.

---

## 1. DATABASE ANALYSIS & REQUIRED MIGRATIONS

### 1.1 Existing Tables (Reusable)
- ✅ `auth.users` - Supabase authentication
- ✅ `public.users` - User metadata with role system
- ✅ `public.user_roles` - Role definitions (role 4 = SUPPORTER)
- ✅ `public.notifications` - Existing notification system
- ✅ `public.missionary_followers` - Follow pattern reference
- ✅ `public.church_followers` - Follow pattern reference

### 1.2 New Tables Required

#### Table: `supporter_profiles`
**Purpose:** Store supporter-specific extended profile data

**Migration Required:** `create_supporter_profiles.sql`

```sql
CREATE TABLE IF NOT EXISTS public.supporter_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile Information
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone_number text,
  country_of_residence text NOT NULL,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT supporter_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX idx_supporter_profiles_user_id ON public.supporter_profiles(user_id);
CREATE INDEX idx_supporter_profiles_email ON public.supporter_profiles(email);
```

**Why Separate Table?**
- Supporters don't have organization associations (no page, no missionary/church/agency data)
- Clean separation of concerns
- Simplified RLS policies
- Different data model than org entities

#### Table Modifications: `users`
**Current Schema:** Already supports role 4 (SUPPORTER)
**No modifications needed** - existing structure sufficient

#### Unified Follow View (Optional Enhancement)
Create a database view to aggregate all follows for supporters:

```sql
CREATE OR REPLACE VIEW public.supporter_follows AS
SELECT 
  'missionary' as entity_type,
  mf.user_id,
  mf.missionary_id as entity_id,
  m.first_name || ' ' || m.last_name as entity_name,
  p.profile_photo_url,
  mf.status,
  mf.requested_at,
  mf.reviewed_at,
  mf.created_at
FROM public.missionary_followers mf
JOIN public.missionaries m ON mf.missionary_id = m.id
LEFT JOIN public.pages p ON p.organization_type = 'missionary' AND p.organization_id = m.id

UNION ALL

SELECT 
  'church' as entity_type,
  cf.user_id,
  cf.church_id as entity_id,
  c.name as entity_name,
  p.profile_photo_url,
  cf.status,
  cf.requested_at,
  cf.reviewed_at,
  cf.created_at
FROM public.church_followers cf
JOIN public.churches c ON cf.church_id = c.id
LEFT JOIN public.pages p ON p.organization_type = 'church' AND p.organization_id = c.id

ORDER BY created_at DESC;
```

---

## 2. REUSABLE COMPONENTS & PATTERNS

### 2.1 Authentication (90% Reusable)

**Existing Components:**
- ✅ `/app/api/auth/signin/route.ts` - Sign in API route
- ✅ `/app/api/auth/signout/route.ts` - Sign out API route
- ✅ `/components/auth/SignInForm.tsx` - Sign in form component
- ✅ `/components/auth/LoginModal.tsx` - Login modal
- ✅ `/app/forgot-password/page.tsx` - Password reset flow
- ✅ `/app/reset-password/page.tsx` - Reset password page

**Reuse Strategy:**
- Sign in/out flows work for all user types
- Role-based routing exists in `/app/settings/page.tsx`
- Session management handled by Supabase SSR

**What's Missing:**
- Dedicated supporter sign-up flow (currently admin creates accounts)
- Self-service registration form for supporters

### 2.2 Profile Management (70% Reusable)

**Existing Components:**
- ✅ `/components/admin/AdminAccountTab.tsx` - Profile edit pattern
- ✅ `/components/admin/MissionaryAccountBasicsTab.tsx` - Field validation patterns
- ✅ `/components/admin/shared/AccountBasicsTab.tsx` - Generic profile fields
- ✅ `/lib/countryHelpers.ts` - Country selection logic
- ✅ `/components/ui/Input.tsx`, `/components/ui/Select.tsx` - Form components

**Reuse Strategy:**
- Copy AdminAccountTab structure for supporter profile
- Reuse country selection from countryHelpers
- Use existing form validation patterns
- Leverage Input/Select UI components

**What's Missing:**
- Email change verification flow (requirement US-SUP-PR-003)
- Supporter-specific profile component

### 2.3 Following System (95% Reusable)

**Existing Components:**
- ✅ `/app/missionaries/follow-actions.ts` - Complete follow CRUD operations
- ✅ `/components/missionary/FollowButton.tsx` - Follow UI component
- ✅ `/types/follow.ts` - TypeScript types
- ✅ Database: `missionary_followers`, `church_followers` tables
- ✅ Notification system integrated

**Reuse Strategy:**
- Follow actions already support supporters (role 4 check exists)
- Database tables already exist
- Notification flow implemented
- Status management (pending/accepted/rejected) complete

**What's Missing:**
- Unified "Following Tab" view for supporters
- Server actions to fetch all follows for current user
- UI component to display aggregated follows

---

## 3. IMPLEMENTATION ROADMAP

### Phase 1: Database & Backend (Priority: HIGH)

**Tasks:**
1. ✅ Create migration: `create_supporter_profiles.sql`
2. ✅ Create migration: `create_supporter_follows_view.sql` (optional view)
3. ✅ Add RLS policies for supporter_profiles
4. ✅ Test migrations on dev branch

**Files to Create:**
- `/supabase/migrations/create_supporter_profiles.sql`

**Estimated Effort:** 2-4 hours

---

### Phase 2: Authentication & Sign Up (Priority: HIGH)

**US Stories:** US-SUP-AUTH-001, US-SUP-AUTH-003, US-SUP-AUTH-004, US-SUP-AUTH-005, US-SUP-AUTH-006

**Tasks:**
1. Create supporter self-service sign-up page
2. Create API route: `/app/api/auth/signup-supporter/route.ts`
3. Update login flow to handle role-based redirects
4. Implement logout functionality (already exists)
5. Add password reset (already exists)

**Files to Create:**
- `/app/signup/page.tsx` - Public sign-up page
- `/app/signup/SupporterSignUpForm.tsx` - Form component
- `/app/api/auth/signup-supporter/route.ts` - API endpoint
- `/lib/auth/signUpSupporter.ts` - Server action

**Reusable Patterns:**
- Copy structure from `/app/admin/missionaries/actions.ts` → `createMissionary()`
- Use Supabase auth.signUp() instead of admin.createUser()
- Email confirmation flow through Supabase

**Estimated Effort:** 6-8 hours

---

### Phase 3: Profile Management (Priority: HIGH)

**US Stories:** US-SUP-PR-001 through US-SUP-PR-007

**Tasks:**
1. Create supporter profile server actions
2. Create SupporterProfileTab component
3. Integrate into settings page
4. Implement email change verification flow
5. Add form validation

**Files to Create:**
- `/app/settings/supporter-actions.ts` - CRUD operations
- `/components/supporter/SupporterProfileTab.tsx` - Profile UI
- `/app/api/auth/change-email/route.ts` - Email verification
- `/types/supporter.ts` - TypeScript types

**Reusable Components:**
- Copy `/components/admin/AdminAccountTab.tsx` structure
- Use `/lib/countryHelpers.ts` for country dropdown
- Reuse form validation patterns from missionary forms

**Key Logic:**

```typescript
// Profile update action
export async function updateSupporterProfile(data: SupporterProfileData) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { success: false, error: "Not authenticated" };
  
  // Update supporter_profiles table
  const { error } = await supabase
    .from("supporter_profiles")
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      phone_number: data.phoneNumber,
      country_of_residence: data.countryOfResidence,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);
    
  if (error) return { success: false, error: error.message };
  return { success: true };
}
```

**Email Change Flow:**
1. User initiates email change
2. Send verification to NEW email (Supabase auth.updateUser)
3. User clicks verification link
4. Update supporter_profiles.email
5. Maintain OAuth connection if exists

**Estimated Effort:** 8-10 hours

---

### Phase 4: Following Tab (Priority: MEDIUM)

**US Stories:** US-SUP-FOL-001 through US-SUP-FOL-010

**Tasks:**
1. Create server actions to fetch follows
2. Create FollowingTab component with 3 sections
3. Implement unfollow/cancel actions
4. Add pagination/infinite scroll
5. Integrate with settings page

**Files to Create:**
- `/app/settings/following-actions.ts` - Fetch follows
- `/components/supporter/FollowingTab.tsx` - Main tab component
- `/components/supporter/FollowingList.tsx` - Active follows section
- `/components/supporter/PendingRequestsList.tsx` - Pending section
- `/components/supporter/RejectedRequestsList.tsx` - Rejected section
- `/components/supporter/FollowItem.tsx` - Individual item

**Reusable Logic:**
- `/app/missionaries/follow-actions.ts` → unfollowMissionary, cancelFollowRequest
- Create parallel: unfollowChurch, cancelChurchFollowRequest

**Key Server Action:**

```typescript
export async function getSupporterFollows() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { success: false, error: "Not authenticated" };
  
  // Fetch missionary follows
  const { data: missionaryFollows } = await supabase
    .from("missionary_followers")
    .select(`
      id,
      missionary_id,
      status,
      requested_at,
      reviewed_at,
      missionaries (
        id,
        first_name,
        last_name,
        pages (profile_photo_url, page_url)
      )
    `)
    .eq("user_id", user.id);
  
  // Fetch church follows
  const { data: churchFollows } = await supabase
    .from("church_followers")
    .select(`
      id,
      church_id,
      status,
      requested_at,
      reviewed_at,
      churches (
        id,
        name,
        pages (profile_photo_url, page_url)
      )
    `)
    .eq("user_id", user.id);
  
  // Combine and categorize
  const following = [...missionaryFollows, ...churchFollows]
    .filter(f => f.status === 'accepted');
  const pending = [...missionaryFollows, ...churchFollows]
    .filter(f => f.status === 'pending');
  const rejected = [...missionaryFollows, ...churchFollows]
    .filter(f => f.status === 'rejected');
  
  return { success: true, data: { following, pending, rejected } };
}
```

**UI Component Structure:**

```
FollowingTab
├── Following Section
│   ├── FollowItem (missionary)
│   │   ├── Avatar
│   │   ├── Name + Type badge
│   │   └── Unfollow button
│   └── FollowItem (church)
├── Pending Requests Section
│   └── FollowItem
│       ├── Avatar
│       ├── Name + "Pending" badge
│       └── Cancel Request button
└── Rejected Requests Section
    └── FollowItem
        ├── Avatar
        ├── Name + "Rejected" badge
        └── (No actions)
```

**Estimated Effort:** 10-12 hours

---

### Phase 5: Settings Page Integration (Priority: MEDIUM)

**Tasks:**
1. Update `/app/settings/page.tsx` to handle supporter role
2. Add tab navigation for supporters
3. Integrate SupporterProfileTab
4. Integrate FollowingTab
5. Test role-based access control

**Files to Modify:**
- `/app/settings/page.tsx` - Add supporter case
- `/components/settings/SupporterSettingsClient.tsx` - New settings wrapper

**Settings Tab Structure for Supporters:**
- Account (Profile Information)
- Following (Following management)

**Estimated Effort:** 4-6 hours

---

### Phase 6: Access Control & Security (Priority: HIGH)

**US Stories:** US-SUP-AUTH-004, US-SUP-PR-007, US-SUP-FOL-010

**Tasks:**
1. Implement RLS policies for supporter_profiles
2. Add middleware for route protection
3. Server-side role validation
4. Test unauthorized access attempts

**RLS Policies:**

```sql
-- Supporters can only view/edit their own profile
CREATE POLICY "Supporters can view own profile"
ON public.supporter_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Supporters can update own profile"
ON public.supporter_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all supporter profiles
CREATE POLICY "Admins can view all supporter profiles"
ON public.supporter_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.user_id = auth.uid()
    AND users.role IN (1, 2)
  )
);
```

**Route Protection:**
- Supporters can only access: /settings (own), /messages, public pages
- Supporters CANNOT access: /admin/*, org-specific settings
- Implement in middleware or page-level checks

**Estimated Effort:** 4-6 hours

---

## 4. DETAILED ACTION PLAN

### Sprint 1: Foundation (Week 1)
**Goal:** Database ready, authentication working

**Day 1-2: Database Setup**
- [ ] Write and test migration for supporter_profiles table
- [ ] Write RLS policies
- [ ] Create optional supporter_follows view
- [ ] Deploy to dev environment
- [ ] Verify table creation and policies

**Day 3-5: Authentication**
- [ ] Create supporter sign-up page UI
- [ ] Implement sign-up API route
- [ ] Add email confirmation flow
- [ ] Test sign-up → login → redirect flow
- [ ] Handle duplicate email validation
- [ ] Test password reset for supporters

**Deliverables:**
- Working supporter self-service registration
- Proper role assignment (role 4)
- Email confirmation

---

### Sprint 2: Profile Management (Week 2)
**Goal:** Supporters can view/edit profiles

**Day 1-2: Server Actions**
- [ ] Create supporter-actions.ts file
- [ ] Implement getSupporterProfile()
- [ ] Implement updateSupporterProfile()
- [ ] Add validation logic
- [ ] Write tests for server actions

**Day 3-4: UI Components**
- [ ] Create SupporterProfileTab component
- [ ] Add form fields (name, email, phone, country)
- [ ] Implement client-side validation
- [ ] Add success/error toast notifications
- [ ] Test on multiple screen sizes

**Day 5: Email Change**
- [ ] Create email change API route
- [ ] Implement verification flow
- [ ] Add confirmation UI
- [ ] Test with OAuth accounts
- [ ] Test with password accounts

**Deliverables:**
- Full profile CRUD for supporters
- Email change with verification
- Responsive UI

---

### Sprint 3: Following System (Week 3)
**Goal:** Supporters can manage follows

**Day 1-2: Backend**
- [ ] Create following-actions.ts
- [ ] Implement getSupporterFollows()
- [ ] Implement unfollowEntity() (missionary/church)
- [ ] Implement cancelFollowRequest()
- [ ] Test with sample data

**Day 3-5: UI Components**
- [ ] Create FollowingTab component
- [ ] Build FollowingList (active follows)
- [ ] Build PendingRequestsList
- [ ] Build RejectedRequestsList
- [ ] Add empty states
- [ ] Implement pagination (if needed)
- [ ] Add loading states
- [ ] Test unfollow/cancel flows

**Deliverables:**
- Complete Following tab
- All follow statuses displayed correctly
- Working unfollow/cancel actions

---

### Sprint 4: Integration & Testing (Week 4)
**Goal:** Everything integrated and tested

**Day 1-2: Settings Integration**
- [ ] Update settings page for supporters
- [ ] Add tab navigation
- [ ] Integrate Profile + Following tabs
- [ ] Test navigation between tabs
- [ ] Verify data persists correctly

**Day 3-4: Security & Access Control**
- [ ] Test RLS policies
- [ ] Verify supporters can't access admin routes
- [ ] Test role-based redirects
- [ ] Attempt unauthorized access (negative testing)
- [ ] Check server-side validation

**Day 5: End-to-End Testing**
- [ ] Test complete user journey:
  - Sign up → Confirm email → Login
  - Edit profile → Save → Verify persistence
  - Follow missionary → View in Following tab
  - Unfollow → Verify removal
  - Cancel pending request → Verify removal
  - Logout → Login → Verify session
- [ ] Test on mobile devices
- [ ] Test with different browsers
- [ ] Load testing (pagination)

**Deliverables:**
- Fully functional supporter account system
- All user stories satisfied
- Security verified
- Documentation updated

---

## 5. TECHNICAL SPECIFICATIONS

### 5.1 API Routes

**New Routes:**
```
POST   /api/auth/signup-supporter     → Create supporter account
POST   /api/auth/change-email         → Initiate email change
GET    /api/supporter/profile         → Get profile data
PATCH  /api/supporter/profile         → Update profile
GET    /api/supporter/follows         → Get all follows
DELETE /api/supporter/unfollow        → Unfollow entity
DELETE /api/supporter/cancel-request  → Cancel pending request
```

**Existing Routes (Reuse):**
```
POST   /api/auth/signin               → Sign in (all roles)
POST   /api/auth/signout              → Sign out (all roles)
POST   /api/send-reset-email          → Password reset
```

---

### 5.2 Server Actions

**New Actions:**
```typescript
// /app/signup/actions.ts
signUpSupporter(data: SignUpData): Promise<ActionResult>

// /app/settings/supporter-actions.ts
getSupporterProfile(): Promise<ActionResult<SupporterProfile>>
updateSupporterProfile(data: ProfileData): Promise<ActionResult>
changeEmail(newEmail: string): Promise<ActionResult>

// /app/settings/following-actions.ts
getSupporterFollows(): Promise<ActionResult<FollowsData>>
unfollowMissionary(missionaryId: number): Promise<ActionResult>
unfollowChurch(churchId: number): Promise<ActionResult>
cancelMissionaryRequest(missionaryId: number): Promise<ActionResult>
cancelChurchRequest(churchId: number): Promise<ActionResult>
```

**Reused Actions:**
```typescript
// /app/missionaries/follow-actions.ts
followMissionary() → Already supports supporters
unfollowMissionary() → Reuse with modifications
cancelFollowRequest() → Reuse

// /app/admin/churches/actions.ts
followChurch() → Already exists
unfollowChurch() → Already exists
```

---

### 5.3 TypeScript Types

**New Types:**

```typescript
// /types/supporter.ts

export interface SupporterProfile {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  country_of_residence: string;
  created_at: string;
  updated_at: string;
}

export interface SupporterProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  countryOfResidence: string;
}

export interface SignUpSupporterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  countryOfResidence: string;
}

export interface SupporterFollows {
  following: FollowItem[];
  pending: FollowItem[];
  rejected: FollowItem[];
}

export interface FollowItem {
  id: number;
  entity_type: 'missionary' | 'church';
  entity_id: number;
  entity_name: string;
  profile_photo_url?: string;
  page_url?: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string;
}
```

---

### 5.4 Component Hierarchy

```
/app/signup/page.tsx (Server Component)
└── SupporterSignUpForm.tsx (Client Component)
    ├── Input components
    ├── Select (Country)
    └── Submit button

/app/settings/page.tsx (Server Component)
└── SupporterSettingsClient.tsx (Client Component)
    ├── TabNavigation
    ├── SupporterProfileTab (Client Component)
    │   ├── ProfileForm
    │   │   ├── Input (First Name)
    │   │   ├── Input (Last Name)
    │   │   ├── EmailChangeSection
    │   │   ├── Input (Phone)
    │   │   └── Select (Country)
    │   └── SaveButton
    └── FollowingTab (Client Component)
        ├── FollowingList (Accepted)
        │   └── FollowItem[]
        │       ├── Avatar
        │       ├── Info (Name, Type)
        │       └── UnfollowButton
        ├── PendingRequestsList
        │   └── FollowItem[]
        │       └── CancelRequestButton
        └── RejectedRequestsList
            └── FollowItem[]
```

---

## 6. TESTING STRATEGY

### 6.1 Unit Tests
- Server actions return correct data structures
- Form validation catches invalid inputs
- RLS policies enforce access control

### 6.2 Integration Tests
- Sign up → Profile creation → Database record
- Profile update → Database persistence → UI refresh
- Follow → Database record → Following tab display
- Unfollow → Database deletion → UI update

### 6.3 E2E Tests (Manual)
**Test Case 1: New Supporter Registration**
1. Navigate to /signup
2. Fill form with valid data
3. Submit
4. Check email for confirmation
5. Click confirmation link
6. Login with credentials
7. Verify redirected to appropriate page
8. Check database: users table (role = 4), supporter_profiles table

**Test Case 2: Profile Management**
1. Login as supporter
2. Navigate to /settings
3. Verify Profile tab shows correct data
4. Edit first name, phone, country
5. Save changes
6. Refresh page
7. Verify changes persisted

**Test Case 3: Email Change**
1. Login as supporter
2. Go to Profile tab
3. Initiate email change
4. Check new email for verification
5. Click verification link
6. Login with new email
7. Verify old email no longer works

**Test Case 4: Following Management**
1. Login as supporter
2. Navigate to missionary page
3. Click Follow button
4. Go to Following tab in settings
5. Verify appears in "Pending Requests"
6. (Admin accepts request)
7. Refresh Following tab
8. Verify moved to "Following" section
9. Click Unfollow
10. Verify removed from Following

**Test Case 5: Access Control**
1. Login as supporter
2. Attempt to access /admin/*
3. Verify 403/404 error
4. Attempt to access another supporter's profile via API
5. Verify 403 error

---

## 7. DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All migrations tested on staging
- [ ] Database backups created
- [ ] Environment variables configured
- [ ] RLS policies deployed
- [ ] Email templates configured (confirmation, password reset)

### Deployment Steps
1. [ ] Run migrations on production
2. [ ] Verify tables created
3. [ ] Test RLS policies
4. [ ] Deploy application code
5. [ ] Verify routing works
6. [ ] Test sign-up flow end-to-end
7. [ ] Monitor error logs

### Post-Deployment
- [ ] Create test supporter account
- [ ] Verify email delivery
- [ ] Test profile updates
- [ ] Test following flow
- [ ] Monitor performance metrics
- [ ] Check for security issues

---

## 8. POTENTIAL CHALLENGES & SOLUTIONS

### Challenge 1: Email Change Verification
**Issue:** Supabase email change requires user to be online when clicking link

**Solution:**
- Use Supabase auth.updateUser({ email: newEmail })
- Sends confirmation to new email automatically
- Update supporter_profiles.email after confirmation
- Use webhook or callback to detect confirmation

### Challenge 2: Unified Follow View Performance
**Issue:** Fetching follows from multiple tables could be slow

**Solution:**
- Use database view (supporter_follows)
- Add proper indexes on foreign keys
- Implement pagination (20 items per page)
- Cache results on client side
- Use React Query for data fetching

### Challenge 3: Role-Based Access Control
**Issue:** Supporters accessing protected routes

**Solution:**
- Implement Next.js middleware for route protection
- Server-side checks in all API routes
- RLS policies on database level
- Frontend guards (hide UI elements)
- Return 403/404 for unauthorized access

### Challenge 4: Existing User Migration
**Issue:** If supporters already exist in users table without profiles

**Solution:**
- Create migration to backfill supporter_profiles
- Check for existing users with role 4
- Copy first_name, last_name, email from users table
- Set default country_of_residence = "Unknown"
- Update with actual data when user logs in

---

## 9. SUCCESS METRICS

### Functional Metrics
- [ ] 100% of user stories implemented
- [ ] All acceptance criteria met
- [ ] Zero security vulnerabilities
- [ ] All tests passing

### Performance Metrics
- [ ] Sign-up flow < 3 seconds
- [ ] Profile load < 1 second
- [ ] Following tab load < 2 seconds
- [ ] Unfollow action < 1 second

### User Experience Metrics
- [ ] Mobile-responsive (tested on 3+ devices)
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Clear error messages
- [ ] Loading states for all async operations

---

## 10. FUTURE ENHANCEMENTS (Out of Scope)

**Not Included in Current Implementation:**
- OAuth sign-up (Google, Facebook)
- Profile photo upload
- Email preferences/notifications settings
- Export follow list
- Bulk unfollow
- Search within follows
- Agency/College following (only missionary/church in scope)

**Recommended for Phase 2:**
- Analytics dashboard for supporters (donations, engagement)
- Personalized feed based on follows
- In-app messaging with missionaries
- Prayer request notifications from follows

---

## 11. DOCUMENTATION REQUIREMENTS

### Developer Documentation
- [ ] README for supporter module
- [ ] API documentation (routes, parameters, responses)
- [ ] Database schema documentation
- [ ] RLS policy documentation
- [ ] Component usage examples

### User Documentation
- [ ] Supporter sign-up guide
- [ ] Profile management guide
- [ ] Following system guide
- [ ] FAQ for supporters
- [ ] Troubleshooting common issues

---

## SUMMARY

**Total Estimated Effort:** 30-40 hours (4-5 weeks for 1 developer)

**Critical Path:**
1. Database migrations (blocker for all)
2. Authentication (blocker for profile/following)
3. Profile management (independent)
4. Following tab (depends on authentication)

**Recommended Team:**
- 1 Full-stack developer (primary)
- 1 Designer (UI/UX review)
- 1 QA engineer (testing)

**Risk Level:** LOW-MEDIUM
- Leverage existing patterns (90% reusable)
- No new external dependencies
- Clear requirements
- Existing authentication system

**Key Success Factor:** Following existing patterns from missionary/church systems will accelerate development and ensure consistency.

---

## NEXT STEPS

1. **Review & Approve Strategy** - Stakeholder sign-off
2. **Create Migrations** - Database team review
3. **Begin Sprint 1** - Start with authentication foundation
4. **Weekly Check-ins** - Review progress, adjust timeline
5. **Deploy to Staging** - Test in production-like environment
6. **Production Deployment** - After full QA approval

