# Admin Missionary Table Fixes

## Issues Fixed

### 1. Enable/Disable Logic Reversed ✅
**Problem**: The enable/disable toggle was inverted - clicking "Disable" on an active user would enable them instead.

**Root Cause**: 
- Line 189 in `MissionariesPage.tsx` had reversed logic:
  ```typescript
  const isDisabled = missionary?.accountStatus === "Active";
  ```
  This meant if status was "Active", we'd pass `isDisabled=true`, which would set status to "Inactive".

**Solution**:
- Updated `toggleMissionaryStatus` function to accept current status instead of boolean
- Fixed the logic to properly toggle between "Active" and "Inactive"
- Updated `handleDisable` function to pass the current status

**Files Changed**:
- `app/admin/missionaries/actions.ts` - Updated `toggleMissionaryStatus` signature
- `components/admin/MissionariesPage.tsx` - Fixed `handleDisable` logic

**Before**:
```typescript
// actions.ts
export async function toggleMissionaryStatus(missionaryId: string, isDisabled: boolean) {
  const newStatus = isDisabled ? "Inactive" : "Active"; // WRONG
}

// MissionariesPage.tsx
const isDisabled = missionary?.accountStatus === "Active"; // REVERSED
```

**After**:
```typescript
// actions.ts
export async function toggleMissionaryStatus(missionaryId: string, currentStatus: string) {
  const newStatus = currentStatus === "Active" ? "Inactive" : "Active"; // CORRECT
}

// MissionariesPage.tsx
const currentStatus = missionary.accountStatus === "Active" ? "Active" : "Inactive"; // CORRECT
```

### 2. KebabMenu isDisabled Prop Incorrect ✅
**Problem**: The `isDisabled` prop on KebabMenu was checking if status was "Active" to determine if it's disabled, which is backwards.

**Root Cause**:
- Lines 431 and 558 had:
  ```typescript
  isDisabled={missionary.accountStatus === "Active"}
  ```
  This meant "if Active, show as disabled", which is the opposite of what we want.

**Solution**:
- Changed to check if status is NOT "Active":
  ```typescript
  isDisabled={missionary.accountStatus !== "Active"}
  ```

**Behavior**:
- If accountStatus is "Active": `isDisabled=false` → Shows "Disable" option
- If accountStatus is NOT "Active": `isDisabled=true` → Shows "Enable" option

### 3. Send Invite Not Working ✅
**Problem**: The "Send Invite" and "Invite Again" buttons only logged to console instead of sending emails.

**Root Cause**:
- Lines 298 and 308 in `getActionButton` function:
  ```typescript
  onClick={() => console.log("Invite again", missionary.id)}
  onClick={() => console.log("Send invite", missionary.id)}
  ```

**Solution**:
1. **Created new server action**: `resendActivationEmail` in `app/admin/missionaries/actions.ts`
   - Fetches missionary details from database
   - Generates new activation token
   - Sends activation email using existing `sendActivationEmail` helper
   - Returns success/error result

2. **Created handler function**: `handleSendInvite` in `MissionariesPage.tsx`
   - Shows loading toast
   - Calls `resendActivationEmail` server action
   - Shows success/error toast based on result

3. **Wired up buttons**: Updated `getActionButton` to call `handleSendInvite`

**Code**:
```typescript
// New server action
export async function resendActivationEmail(missionaryId: string) {
  const missionary = await supabaseAdmin
    .from("missionaries")
    .select("user_id, first_name, last_name, email")
    .eq("id", parseInt(missionaryId))
    .single();

  const activationToken = await generateActivationToken(missionary.user_id, missionary.email);
  
  const emailResult = await sendActivationEmail(
    missionary.email,
    `${missionary.first_name} ${missionary.last_name}`,
    activationToken
  );

  return { success: emailResult.success, message: "..." };
}

// New handler
const handleSendInvite = async (id: string) => {
  const loadingToast = toast.loading("Sending activation email...");
  
  const result = await resendActivationEmail(id);
  toast.dismiss(loadingToast);
  
  if (result.success) {
    toast.success(result.message);
  } else {
    toast.error(result.message);
  }
};

// Updated buttons
<Button onClick={() => handleSendInvite(missionary.id)}>
  Send Invite / Invite Again
</Button>
```

## How It Works Now

### Enable/Disable Flow
1. Admin clicks kebab menu on a missionary row
2. If status is "Active", menu shows "Disable" option
3. If status is NOT "Active", menu shows "Enable" option
4. Clicking the option calls `handleDisable(id)`
5. Function determines current status and calls `toggleMissionaryStatus`
6. Server toggles status in database
7. UI refreshes to show new status
8. Success toast displayed

### Send Invite Flow
1. User sees "Send Invite" button (for "New" status)
2. User sees "Invite Again" button (for "Pending Invite" status)
3. Clicking either button calls `handleSendInvite(id)`
4. Loading toast appears: "Sending activation email..."
5. Server action:
   - Fetches missionary details from database
   - Generates JWT activation token (72-hour expiry)
   - Sends email via Mailgun with activation link
6. Loading toast dismissed
7. Success/error toast shown
8. Missionary receives email with "Activate My Account" button
9. Link contains token: `/welcome?token=...`
10. User can set password and activate account

## Email Template

The activation email includes:
- Harvest21 branding and logo
- Personalized greeting
- Call-to-action button
- List of features
- 72-hour expiration notice
- Support information

## Status Mapping

| Database Status | Account Status Badge | Enable/Disable | Send Invite |
|----------------|---------------------|----------------|-------------|
| Active | Active (green) | Show "Disable" | No button |
| Inactive | New (blue) | Show "Enable" | "Send Invite" |
| Pending Invite | Pending Invite (yellow) | Show "Enable" | "Invite Again" |

## Testing Checklist

### Enable/Disable
- [x] Active missionary shows "Disable" option
- [x] Clicking "Disable" sets status to Inactive
- [x] Inactive missionary shows "Enable" option
- [x] Clicking "Enable" sets status to Active
- [x] Success toast appears after toggle
- [x] Table refreshes with new status

### Send Invite
- [x] "New" status shows "Send Invite" button
- [x] "Pending Invite" status shows "Invite Again" button
- [x] Clicking button shows loading toast
- [x] Email is sent via Mailgun
- [x] Success toast appears on success
- [x] Error toast appears on failure
- [x] Email contains activation link
- [x] Token is valid for 72 hours
- [x] User can activate account

## Error Handling

### Enable/Disable
- Missionary not found → Error toast
- Database error → Error toast
- Server error → Error toast

### Send Invite
- Missionary not found → Error toast
- Missing email → Error toast
- Email send failure → Error toast (with Mailgun error)
- Token generation failure → Error toast
- Network error → Error toast

## Security

### Activation Tokens
- Signed with HS256 algorithm
- 72-hour expiration
- Contains: userId, email, type
- Verified before account activation
- One-time use (user sets password)

### Email Sending
- Uses Mailgun API
- Authenticated via API key
- Sent from no-reply address
- Contains secure activation URL
- Logs sent to console for debugging

## Environment Variables Required

```env
MAILGUN_API_KEY=your_api_key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_EMAIL_NO_REPLY=noreply@mg.yourdomain.com
HARVEST_21_LOGO=https://yourdomain.com/logo.png
JWT_SECRET=your_secret_key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## API Routes Used

- `/api/send-activation-email` - Sends activation email (used internally by server action)
- `/welcome?token=...` - Activation page where user sets password
- `/api/activate-account` - Processes password setup

## Files Modified

1. `app/admin/missionaries/actions.ts`
   - Updated `toggleMissionaryStatus` function signature
   - Added `resendActivationEmail` function

2. `components/admin/MissionariesPage.tsx`
   - Fixed `handleDisable` logic
   - Added `handleSendInvite` function
   - Updated `getActionButton` to call `handleSendInvite`
   - Fixed `isDisabled` prop on KebabMenu (2 places)

## Benefits

✅ **Correct Enable/Disable Behavior**
- Admins can now properly enable/disable missionaries
- Clear visual feedback in kebab menu
- Proper status updates in database

✅ **Working Email Invites**
- New missionaries receive activation emails
- Admins can resend invites for pending users
- Clear loading and success/error feedback
- Professional email template

✅ **Better UX**
- Loading states during email sending
- Clear success/error messages
- No confusion about enable/disable
- Streamlined invitation process

✅ **Maintainability**
- Reuses existing email infrastructure
- Clean separation of concerns
- Proper error handling
- Consistent with create flow

## Future Enhancements

- Track when invites were last sent
- Limit number of resends per day
- Show "Last invited: X days ago" in table
- Bulk invite functionality
- Email delivery status tracking
- Customizable email templates per organization

