# Follow System - Quick Start Guide

## ✅ What's Been Implemented

I've successfully implemented a complete Facebook-style Follow System for your missionary platform. Here's what's ready:

### 🗄️ Database (Ready to Deploy)
- `missionary_followers` table - tracks all follow relationships
- `notifications` table - stores follow event notifications  
- Complete RLS security policies
- Helper functions for status checks and access control

### 🎨 UI Components (Ready to Use)
- `FollowButton` - Smart button that handles all follow states
- `FollowGate` - Content gate for restricted tabs (Photos, Videos, Prayer Wall)
- Updated `MissionaryCard` with integrated follow functionality
- Updated `MissionaryPublicView` with content gating
- Updated `MissionaryFollowersTab` for admin management

### ⚙️ Server Actions (Ready to Use)
- Follow/Unfollow missionaries
- Get follower status
- Accept/Reject/Block followers
- Notification creation and management

---

## 🚀 How to Deploy

### Step 1: Run Database Migration

```bash
cd supabase
npx supabase migration up
```

This creates the `missionary_followers` and `notifications` tables with all required security policies.

### Step 2: Update Your Page Loader

You need to fetch the follower status when loading missionary pages. Update `/app/[page_url]/page.tsx`:

```typescript
import { getMissionaryFollowerStatus, isMissionaryFollower } from "@/app/missionaries/follow-actions";

// Inside your page component:
const followerStatus = await getMissionaryFollowerStatus(missionary.id);
const isFollower = await isMissionaryFollower(missionary.id);

// Pass to MissionaryPublicView:
<MissionaryPublicView
  missionary={missionary}
  page={page}
  media={media}
  widgets={widgets}
  followerStatus={followerStatus}
  isFollower={isFollower}
  // ... other props
/>
```

### Step 3: Update Missionary Card Usage

When rendering missionary cards (e.g., in `/app/missionaries/[region]/page.tsx`), pass the required props:

```typescript
<MissionaryCard
  id={missionary.id}
  firstName={missionary.first_name}
  lastName={missionary.last_name}
  country={missionary.country_of_residence}
  pageUrl={missionary.page?.page_url}
  profilePhotoUrl={missionary.page?.profile_photo_url}
  pageName={missionary.page?.name}
  isLoggedIn={!!userProfile}  // Add this
  followerStatus="none"  // Fetch from server or default to "none"
/>
```

---

## 🧪 Testing the Implementation

### Test Scenario 1: Non-Logged-In User
1. Visit a missionary page
2. Click "Follow" button
3. ✅ Should see login modal
4. After login, click Follow again
5. ✅ Should see "Pending" state

### Test Scenario 2: Follow Request Flow
1. Supporter sends follow request
2. ✅ Supporter sees "Pending" button
3. ✅ Missionary receives notification
4. Missionary goes to `/admin/missionaries/[id]` → "Followers" tab
5. ✅ Sees pending request
6. Missionary clicks "Accept"
7. ✅ Supporter receives notification
8. ✅ Supporter can now access Photos, Videos, Prayer Wall

### Test Scenario 3: Content Gating
1. Non-follower visits missionary page
2. Clicks on "Photos" tab
3. ✅ Sees gate message with "Send Follow Request" button
4. After becoming follower
5. ✅ Can view photos

### Test Scenario 4: 24-Hour Resend Rule
1. Missionary rejects request
2. Supporter tries to resend immediately
3. ✅ Gets error message
4. Wait 24 hours (or modify `last_rejected_at` in DB for testing)
5. ✅ Can resend request

---

## 📋 Implementation Checklist

### Must Do Before Launch
- [x] Database migration
- [ ] Update page loaders to fetch follower status
- [ ] Test all button states
- [ ] Test content gating
- [ ] Test notification creation
- [ ] Verify RLS policies work correctly

### Nice to Have (Can Add Later)
- [ ] Email notifications for follow events
- [ ] User settings page to manage followers
- [ ] Notification bell in navbar
- [ ] Real-time notification updates
- [ ] Bulk follower actions

---

## 🎯 How It Works

### For Supporters & Missionaries
1. Click "Follow" on missionary card or page
2. Request goes to "Pending" state
3. Receive notification when approved/declined
4. Access Photos, Videos, Prayer Wall once approved
5. Can unfollow at any time
6. Missionaries can follow other missionaries (but not themselves)

### For Missionaries
1. Receive notification when someone requests to follow
2. Go to admin panel → Followers tab
3. See all requests (pending, accepted, rejected, blocked)
4. Accept, Reject, or Block as needed
5. Accepted followers gain access to restricted content

### Content Access Rules
- **Public:** About, Update Letters
- **Followers Only:** Photos, Videos, Prayer Wall
- **Always Accessible:** Owners, Admins (for testing)

---

## 🔧 Troubleshooting

### Button doesn't show correct state
- Check that `followerStatus` prop is being passed correctly
- Verify database has correct status in `missionary_followers` table

### Content gate not working
- Check `isFollower` prop is being calculated correctly
- Verify user is logged in
- Check RLS policies are enabled on tables

### Notifications not created
- Check `createFollowNotification()` is being called in actions
- Verify `notifications` table exists
- Check service role key has permission to insert

### 24-hour rule not working
- Verify `last_rejected_at` is being set on rejection
- Check `can_resend_follow_request()` function logic

---

## 📞 Need Help?

Check these files:
- **Implementation Summary:** `FOLLOW_SYSTEM_IMPLEMENTATION.md`
- **Database Schema:** `supabase/migrations/create_missionary_follow_system.sql`
- **Follow Actions:** `app/missionaries/follow-actions.ts`
- **UI Components:** `components/missionary/FollowButton.tsx` and `FollowGate.tsx`

---

**Status:** ✅ Ready for Testing & Deployment
**Next Step:** Run database migration and update page loaders

