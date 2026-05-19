# Missionary-to-Missionary Following Implementation

## Overview
This implementation adds the ability for missionaries to follow other missionaries, similar to how users can follow missionaries. The feature includes follow request management, status notifications, and a dedicated "Following" tab in missionary settings.

## Database Changes

### New Table: `missionary_missionary_followers`
- Location: `supabase/migrations/create_missionary_missionary_followers.sql`
- Purpose: Tracks missionary-to-missionary following relationships
- Key columns:
  - `follower_missionary_id`: The missionary who is following
  - `followed_missionary_id`: The missionary being followed
  - `status`: pending, accepted, rejected, or unfollowed
  - `requested_at`, `reviewed_at`, `reviewed_by`: Audit trail fields

### Row Level Security (RLS) Policies
- Users can view their own missionary following records
- Missionaries can create follow requests
- Missionaries can update their own follow requests
- Missionaries can delete their own follow requests
- Admins have full access

## Server Actions

### File: `app/missionaries/missionary-following-actions.ts`

#### Main Functions:
1. **`getMissionaryFollows(missionaryId?: number)`**
   - Fetches all follows for a missionary (following, pending, rejected)
   - Returns organized data with missionary details and page information

2. **`followMissionaryAsMissionary(followedMissionaryId: number)`**
   - Creates a new follow request from one missionary to another
   - Handles reactivation of rejected/unfollowed requests
   - Sends notification to the followed missionary

3. **`unfollowMissionaryAsMissionary(followedMissionaryId: number)`**
   - Unfollows a missionary (sets status to 'unfollowed')
   - Falls back to delete if migration not run

4. **`cancelMissionaryFollowRequest(followedMissionaryId: number)`**
   - Cancels a pending follow request

5. **`getMissionaryFollowersByMissionary(missionaryId: number)`**
   - Gets all missionaries following a specific missionary
   - Used in the Followers tab to show missionary followers

6. **`updateMissionaryFollowerStatusByMissionary(followerId: number, status)`**
   - Accept or reject missionary follow requests
   - Sends notification to the follower

7. **`getMissionaryFollowerStatusAsMissionary(followedMissionaryId: number)`**
   - Gets the follow status between two missionaries
   - Returns: "none", "pending", "accepted", or "rejected"
   - Used to show correct button state in UI

### Notification Functions:
- **`createMissionaryFollowNotification()`**: Notifies when a new follow request is received
- **`createMissionaryFollowerNotification()`**: Notifies when a follow request is accepted/rejected

## UI Components

### 1. `MissionaryFollowingTab` Component
- Location: `components/missionary/MissionaryFollowingTab.tsx`
- Purpose: Shows who the missionary is following
- Features:
  - Three sections: Following, Pending, Rejected
  - Unfollow functionality for accepted follows
  - Cancel request for pending follows
  - Loading states and empty states

### 2. `MissionaryFollowItem` Component
- Location: `components/missionary/MissionaryFollowItem.tsx`
- Purpose: Displays a single missionary follow item
- Features:
  - Profile photo display
  - Missionary badge
  - Status indicators (pending/rejected)
  - Action buttons (unfollow, cancel)

### 3. `MissionaryMissionaryFollowersTab` Component
- Location: `components/admin/MissionaryMissionaryFollowersTab.tsx`
- Purpose: Shows missionaries who are following this missionary
- Features:
  - Search and filter functionality
  - Accept/Reject pending requests
  - Status management
  - Admin-friendly table view

### 4. Enhanced `MissionaryFollowersTab` Component
- Location: `components/admin/MissionaryFollowersTab.tsx`
- Updates: Added toggle between "Users" and "Missionaries" followers
- Features:
  - Unified interface for both user and missionary followers
  - Separate management for each type
  - Consistent UI/UX across both views

## Integration Points

### 1. Missionary Settings Page
- Location: `components/settings/MissionarySettingsClient.tsx`
- Changes:
  - Added "Following" tab after "Followers"
  - Updated tab navigation to include new tab
  - Integrated `MissionaryFollowingTab` component

### 2. Admin Missionary Management
- Location: `components/admin/MissionaryManagePage.tsx`
- Changes:
  - Added "Following" tab to admin view
  - Shows what the missionary is following
  - Consistent with user settings view

### 3. Settings Sidebar
- Location: `components/settings/SettingsSidebar.tsx`
- Changes:
  - Added "following" to the icon map
  - Supports new tab in navigation

### 4. Follow Button Component
- Location: `components/missionary/FollowButton.tsx`
- Changes:
  - Now detects if user is a missionary (role 3)
  - Uses appropriate follow actions based on user role
  - Calls `followMissionaryAsMissionary()` for missionaries
  - Calls `followMissionary()` for regular users

### 5. Public Page Component
- Location: `app/[page_url]/page.tsx`
- Changes:
  - Detects user role and fetches correct follower status
  - Calls `getMissionaryFollowerStatusAsMissionary()` for missionaries
  - Calls `getMissionaryFollowerStatus()` for regular users
  - Passes correct status to `MissionaryPublicView`

## TypeScript Types

### File: `types/missionary-following.ts`

```typescript
export interface MissionaryFollowItem {
  id: number;
  followed_missionary_id: number;
  missionary_name: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  page_url?: string | null;
  profile_photo_url?: string | null;
}

export interface MissionaryFollows {
  following: MissionaryFollowItem[];
  pending: MissionaryFollowItem[];
  rejected: MissionaryFollowItem[];
}

export interface MissionaryFollowerWithMissionary {
  id: number;
  follower_missionary_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  created_at: string;
  missionary: {
    id?: number;
    first_name: string;
    last_name: string;
    email: string;
    user_id?: string | null;
  };
}
```

## Notifications

### Notification Types:
1. **`missionary_follow_request`**: New follow request received
   - Title: "New Follow Request from Missionary"
   - Message: "{Follower Name} wants to follow you"

2. **`missionary_follow_accepted`**: Follow request accepted
   - Title: "Follow Request Accepted"
   - Message: "{Missionary Name} accepted your follow request"

3. **`missionary_follow_rejected`**: Follow request declined
   - Title: "Follow Request Declined"
   - Message: "{Missionary Name} declined your follow request"

### Push Notifications:
- Integrated with existing push notification system
- Uses `sendPushForNotification()` helper
- Automatically sends push notifications for all status changes

## Usage Flow

### For Following a Missionary:
1. Missionary visits another missionary's profile
2. Clicks "Follow" button
3. Follow request is sent (status: pending)
4. Followed missionary receives notification
5. Followed missionary can accept/reject from Followers tab
6. Follower receives notification of status change

### For Managing Followers:
1. Missionary navigates to Settings → Followers
2. Toggles between "Users" and "Missionaries"
3. Views pending requests, accepted followers
4. Can accept, reject, or remove followers
5. Notifications sent automatically

### For Viewing Following:
1. Missionary navigates to Settings → Following
2. Views three tabs: Following, Pending, Rejected
3. Can unfollow accepted missionaries
4. Can cancel pending requests
5. Can see rejected requests for transparency

## Testing Checklist

### Database:
- [x] Migration file created
- [ ] Run migration in development
- [ ] Verify RLS policies work correctly
- [ ] Test with different user roles

### Server Actions:
- [ ] Test follow request creation
- [ ] Test follow request acceptance
- [ ] Test follow request rejection
- [ ] Test unfollowing
- [ ] Test canceling pending requests
- [ ] Verify notifications are sent

### UI Components:
- [ ] Test Following tab in missionary settings
- [ ] Test Following tab in admin view
- [ ] Test Followers tab with missionaries toggle
- [ ] Verify loading states
- [ ] Verify empty states
- [ ] Test search and filter functionality

### Integration:
- [ ] Verify sidebar navigation
- [ ] Test tab switching
- [ ] Verify proper authentication checks
- [ ] Test with different missionary accounts

### Notifications:
- [ ] Verify notification creation
- [ ] Test push notifications
- [ ] Verify notification actions work correctly

## Next Steps

1. **Run Database Migration**:
   ```bash
   # Apply the migration to your database
   supabase db push
   ```

2. **Test in Development**:
   - Create test missionary accounts
   - Test follow/unfollow flow
   - Verify notifications work
   - Test admin management interface

3. **Deploy to Staging**:
   - Run migration in staging environment
   - Perform full QA testing
   - Verify push notifications work

4. **Deploy to Production**:
   - Schedule maintenance window if needed
   - Run migration in production
   - Monitor for errors
   - Announce new feature to users

## Notes

- The implementation follows the same pattern as user-to-missionary following
- All notifications include push notification support
- RLS policies ensure proper data access control
- The UI is mobile-responsive and accessible
- Error handling is comprehensive with user-friendly messages
- The feature is fully integrated with existing missionary settings
