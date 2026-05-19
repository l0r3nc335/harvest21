# Disabled User Login Prevention

## Overview
Prevents disabled users from logging in and displays a clear error message explaining why access is denied.

## Implementation

### What Was Added
Added user status validation to the signin API route to check if a user's account is disabled (status = "Inactive") after successful authentication.

### Flow

```
1. User enters email/password
   ↓
2. Supabase authentication succeeds
   ↓
3. Check user status in database
   ↓
4a. If status = "Inactive":
    - Sign out user immediately
    - Return 403 error
    - Show error toast: "Your account has been disabled..."
    ↓
4b. If status = "Active" or other:
    - Allow login
    - Proceed normally
```

### File Changed
**`app/api/auth/signin/route.ts`**

### Code Added

```typescript
// After successful authentication
const { data: userData, error: userError } = await supabase
  .from("users")
  .select("status")
  .eq("user_id", data.user.id)
  .single();

if (userError) {
  console.error("Error fetching user status:", userError);
  await supabase.auth.signOut();
  return NextResponse.json(
    { error: "Failed to verify account status" },
    { status: 500 }
  );
}

if (userData?.status === "Inactive") {
  await supabase.auth.signOut();
  return NextResponse.json(
    { 
      error: "Your account has been disabled. Please contact the administrator for assistance.",
      accountDisabled: true
    },
    { status: 403 }
  );
}
```

## User Experience

### Before
- User with disabled account could still log in
- No indication that account was disabled
- Could access the system despite being disabled

### After
- User with disabled account **cannot** log in
- Clear error message displayed
- Toast notification shows: 
  > ❌ **Your account has been disabled. Please contact the administrator for assistance.**

## HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| 400 | Bad Request | Missing email or password |
| 401 | Unauthorized | Invalid credentials |
| 403 | Forbidden | Account disabled |
| 500 | Server Error | Database or system error |

## Security Features

### Immediate Sign Out
- Even if authentication succeeds, user is signed out if disabled
- Prevents any session from being established
- No access to protected routes

### Clear Error Message
- User knows exactly why they can't log in
- Directed to contact administrator
- No ambiguity about account status

### Database Check
- Real-time status verification
- Checks current status from database
- Not cached or outdated information

## Testing Scenarios

### Test Case 1: Disabled User Login
**Steps**:
1. Admin disables a user account
2. User tries to log in with correct credentials
3. Authentication succeeds initially
4. Status check detects "Inactive"
5. User is signed out immediately
6. Error toast appears

**Expected Result**: ❌ Login denied with error message

### Test Case 2: Active User Login
**Steps**:
1. User has active account
2. User logs in with correct credentials
3. Authentication succeeds
4. Status check confirms "Active"
5. User proceeds to dashboard

**Expected Result**: ✅ Login successful

### Test Case 3: Invalid Credentials
**Steps**:
1. User enters wrong password
2. Authentication fails

**Expected Result**: ❌ Standard authentication error

### Test Case 4: Network/Database Error
**Steps**:
1. Database connection fails during status check
2. User is signed out as safety measure
3. Error message shown

**Expected Result**: ❌ Error message about verification failure

## Admin Workflow

### Disabling a User
1. Admin goes to missionaries table
2. Clicks kebab menu on user
3. Selects "Disable"
4. User status set to "Inactive"
5. User immediately **cannot** log in
6. If user has active session, it remains until they log out or session expires

### Enabling a User
1. Admin clicks kebab menu on disabled user
2. Selects "Enable"
3. User status set to "Active"
4. User **can now** log in normally

## Status Values

| Status | Can Login? | Description |
|--------|-----------|-------------|
| Active | ✅ Yes | Normal active user |
| Inactive | ❌ No | Disabled by admin |
| Pending Invite | ❌ No* | Awaiting activation |
| New | ❌ No* | Just created, not activated |

*These users need to activate their account first via email link

## Error Messages

### Account Disabled (403)
```
Your account has been disabled. 
Please contact the administrator for assistance.
```

### Verification Failed (500)
```
Failed to verify account status
```

### Invalid Credentials (401)
```
Invalid login credentials (standard Supabase message)
```

## Implementation Details

### Why Sign Out After Authentication?
- Supabase authentication happens first
- This validates email/password are correct
- Status check happens second
- If disabled, we immediately revoke the session
- This prevents any window where user might access system

### Why 403 Instead of 401?
- **401 (Unauthorized)**: Wrong credentials
- **403 (Forbidden)**: Valid credentials but access denied
- Account disabled means credentials are correct but user is forbidden from accessing

### Response Format
```typescript
{
  error: "Error message here",
  accountDisabled: true  // Optional flag for frontend
}
```

## Session Handling

### Active Sessions
- If user is already logged in when disabled, their **current session remains active**
- They will be blocked from logging in **again**
- To force logout of active sessions, you'd need to:
  - Implement session invalidation
  - Or wait for session to expire naturally
  - Or have middleware check status on each request

### Session Expiration
- Supabase sessions expire after period of inactivity
- When expired, user must log in again
- At that point, disabled check will prevent login

## Future Enhancements

### Possible Improvements
1. **Force Logout**: Invalidate all active sessions when user is disabled
2. **Middleware Check**: Add status check to middleware for every request
3. **Disable Reason**: Allow admin to specify why account was disabled
4. **Temporary Disable**: Set expiration date for automatic re-enable
5. **Email Notification**: Send email when account is disabled/enabled
6. **Audit Log**: Track who disabled/enabled the account and when

### Force Logout Implementation
```typescript
// In toggleMissionaryStatus action
if (newStatus === "Inactive") {
  // Invalidate all sessions for this user
  await supabaseAdmin.auth.admin.signOut(userId);
}
```

## Error Handling

### Database Query Fails
- User is signed out as safety measure
- Generic error message shown
- Error logged to console
- 500 status returned

### User Record Not Found
- Likely means user was deleted
- Treated as verification failure
- User signed out
- Error shown

## Logging

### What's Logged
```typescript
console.error("Error fetching user status:", userError);
console.error("Sign in error:", error);
```

### Production Logging
Consider adding:
- User ID attempting to log in
- Timestamp of attempt
- IP address
- Whether attempt was blocked
- Reason for blocking

## Related Files

- `app/api/auth/signin/route.ts` - Login validation
- `app/admin/missionaries/actions.ts` - Toggle status action
- `components/admin/MissionariesPage.tsx` - Admin UI for disable/enable

## Conclusion

Disabled users are now **properly blocked** from logging in with:
- ✅ Real-time status verification
- ✅ Immediate session revocation
- ✅ Clear error messaging
- ✅ Security-first approach
- ✅ Clean user experience

The system ensures that when an admin disables a missionary account, that user cannot log in to the system.

