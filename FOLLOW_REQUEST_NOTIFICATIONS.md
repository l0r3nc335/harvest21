# Follow Request Notification Actions

## Overview
Implemented accept/decline buttons directly in notification items for follow requests, allowing missionaries and churches to respond to follow requests without leaving the notification dropdown.

## Features Implemented

### 1. Enhanced Notification Type ✅
**File**: `types/follow.ts`

**Added**:
- `metadata` field to store additional notification data
- Support for `follower` entity type in `related_entity_type`

**Benefits**:
- Store follower_id, follower_name, and entity_type in metadata
- Enables inline actions without additional queries

### 2. Updated Follow Notification Creation ✅

#### For Missionaries
**File**: `app/missionaries/follow-actions.ts`

**Changes**:
- `createFollowNotification()` now stores:
  - `related_entity_type: "follower"`
  - `related_entity_id: follower_record_id`
  - `metadata`: { missionary_id, follower_user_id, follower_name }

#### For Churches
**File**: `app/admin/churches/actions.ts`

**Added**:
- `createChurchFollowNotification()` function
- Integrated into `followChurch()` action
- Stores same metadata structure with `entity_type: "church"`

### 3. Notification Action Handler ✅
**File**: `lib/notificationHelpers.ts`

**Added**: `handleFollowRequestAction()`

**Features**:
- Handles both missionary and church follow requests
- Authorization checks (missionary owner, church owner, or admin)
- Updates follower status in database
- Marks notification as read automatically
- Sends confirmation notification to follower
- Returns success/error status

**Flow**:
```typescript
1. Verify user authentication
2. Determine entity type (missionary or church)
3. Fetch follower record
4. Check authorization
5. Update status to "accepted" or "rejected"
6. Mark notification as read
7. Send confirmation notification
8. Return result
```

### 4. Notification Dropdown UI ✅
**File**: `components/navbar/NotificationDropdown.tsx`

**Added**:
- Accept/Decline buttons for follow request notifications
- Processing state with spinner
- Toast notifications for success/error
- Automatic notification removal on action
- Disabled state during processing

**UI Components**:
```typescript
// Accept Button
<button className="bg-green-600 hover:bg-green-700">
  <CheckCircle /> Accept
</button>

// Decline Button
<button className="bg-zinc-700 hover:bg-zinc-600">
  <XCircle /> Decline
</button>
```

**Features**:
- Inline action buttons (no navigation required)
- Loading spinners during API calls
- Automatic unread count update
- Remove notification after action
- Error handling with toast messages

## User Experience

### Before
1. User sees follow request notification
2. Clicks notification → navigates to followers page
3. Finds the specific request in the list
4. Clicks accept/decline
5. Confirmation shown

### After
1. User sees follow request notification with action buttons
2. Clicks Accept/Decline directly in dropdown
3. Instant feedback with toast
4. Notification automatically removed
5. Done! (No page navigation needed)

## Technical Details

### Database Updates

**For Missionaries**:
```sql
UPDATE missionary_followers 
SET status = 'accepted',
    reviewed_at = NOW(),
    reviewed_by = current_user_id
WHERE id = follower_id;
```

**For Churches**:
```sql
UPDATE church_followers 
SET status = 'accepted',
    reviewed_at = NOW(),
    reviewed_by = current_user_id
WHERE id = follower_id;
```

### Authorization Logic

**Missionaries**:
- Must be the missionary owner (`missionaries.user_id === current_user_id`)
- OR be a superadmin (role 1 or 2)

**Churches**:
- Must be the church owner (`churches.user_id === current_user_id`)
- OR be a superadmin (role 1 or 2)

### Metadata Structure

```typescript
{
  missionary_id?: number,     // For missionary requests
  church_id?: number,          // For church requests
  follower_user_id: string,
  follower_name: string,
  entity_type: "missionary" | "church"
}
```

## Examples

### Missionary Follow Request Notification
```json
{
  "id": 123,
  "type": "follow_request",
  "title": "New Follow Request",
  "message": "John Doe wants to follow you",
  "related_entity_type": "follower",
  "related_entity_id": 456,
  "metadata": {
    "missionary_id": 789,
    "follower_user_id": "uuid-123",
    "follower_name": "John Doe"
  }
}
```

### Church Follow Request Notification
```json
{
  "id": 124,
  "type": "follow_request",
  "title": "New Follow Request",
  "message": "Jane Smith wants to follow First Baptist Church",
  "related_entity_type": "follower",
  "related_entity_id": 457,
  "metadata": {
    "church_id": 890,
    "follower_user_id": "uuid-456",
    "follower_name": "Jane Smith",
    "entity_type": "church"
  }
}
```

## Error Handling

### Authorization Errors
- **401**: User not authenticated
- **403**: User not authorized (not owner or admin)
- **404**: Follow request not found

### Success Responses
```typescript
{ success: true, status: "accepted" | "rejected" }
```

### Error Responses
```typescript
{ success: false, error: "Error message" }
```

## Toast Messages

**Success - Accept**:
> ✅ You accepted John Doe's follow request

**Success - Decline**:
> ✅ You declined John Doe's follow request

**Error**:
> ❌ Failed to accept follow request
> ❌ Unauthorized
> ❌ Follow request not found

## Confirmation Notifications

After accepting/declining, the follower receives a notification:

**Accepted**:
```
Title: Follow Request Accepted
Message: John Smith accepted your follow request
```

**Declined**:
```
Title: Follow Request Declined
Message: John Smith declined your follow request
```

## Benefits

### For Users
- ✅ Faster response to follow requests
- ✅ No context switching (stays in current page)
- ✅ Immediate feedback
- ✅ Less clicks required
- ✅ Mobile-friendly

### For System
- ✅ Reduced page loads
- ✅ Better user engagement
- ✅ Cleaner notification list (auto-removal)
- ✅ Consistent UX across missionary and church requests

## Future Enhancements

### Potential Improvements
1. **Batch Actions**: Accept/decline multiple requests at once
2. **Undo Action**: Allow reverting an accept/decline within 5 seconds
3. **Quick Reply**: Add a message when accepting
4. **Profile Preview**: Show follower profile on hover
5. **Reason for Decline**: Optional message when declining

### Analytics
Consider tracking:
- Accept/decline rates
- Time to respond
- Action location (notification vs followers page)
- Mobile vs desktop usage

## Testing Recommendations

### Manual Testing
1. **Missionary Flow**:
   - Create follower requests as different users
   - Accept some, decline others
   - Verify notifications sent to followers
   - Check authorization (try as non-owner)

2. **Church Flow**:
   - Same as missionary but for churches
   - Test with church owner account

3. **Edge Cases**:
   - Click accept/decline while already processing
   - Try to act on already-processed request
   - Network error during action
   - Invalid follower_id

4. **UI/UX**:
   - Verify loading spinners
   - Check toast messages
   - Confirm notification removal
   - Test on mobile devices

### Integration Testing
```typescript
// Test accept flow
test('should accept follow request from notification', async () => {
  // 1. Create follow request
  // 2. Get notification
  // 3. Call handleFollowRequestAction with "accept"
  // 4. Verify status updated
  // 5. Verify confirmation notification sent
});

// Test decline flow
test('should decline follow request from notification', async () => {
  // Similar to accept test
});

// Test authorization
test('should reject unauthorized users', async () => {
  // Try to accept request as non-owner
  // Expect error
});
```

## Migration Notes

### For Existing Notifications
Old follow request notifications (before this update) will:
- Not have `metadata` field
- Still clickable but won't show action buttons
- Will navigate to followers page (old behavior)

### Database Changes
No schema changes required:
- Uses existing `notifications` table
- `metadata` column already exists (JSONB)
- No migrations needed

## Conclusion

This implementation provides a seamless, inline way for missionaries and churches to respond to follow requests directly from notifications. It improves user experience by reducing clicks and context switching, while maintaining proper authorization and providing clear feedback.

Users can now:
- ✅ Accept follow requests instantly
- ✅ Decline follow requests instantly
- ✅ See immediate feedback
- ✅ Stay focused on their current task

No navigation, no page loads, just simple, intuitive actions.

