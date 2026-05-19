# Realtime Messaging Troubleshooting

## Issue: Receiver doesn't see messages in real-time

### ✅ What I've Added:

1. **Console logging** - Check browser console for:
   - `🔌 Realtime subscription status:` - Should show "SUBSCRIBED"
   - `📨 Realtime message received:` - When messages arrive
   - `✅ Adding new message to thread` - When message is displayed

2. **Broadcast self** - Enabled to ensure messages propagate

---

## 🔍 Debugging Steps:

### Step 1: Check Browser Console
Open browser console (F12) on **both sender and receiver** browsers:

**Expected on receiver side:**
```
🔌 Realtime subscription status: SUBSCRIBED
📨 Realtime message received: {payload}
✅ Adding new message to thread
```

**If you see:**
- ❌ `CLOSED` or `CHANNEL_ERROR` → Realtime not configured
- ❌ No message received → Subscription not working
- ✅ `SUBSCRIBED` but no messages → Check RLS policies

---

### Step 2: Verify Migration Ran

Check if the realtime publication was added:

```sql
-- Run in Supabase SQL Editor
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

**Expected result:** Should include:
- `conversations`
- `messages`
- `conversation_members`

**If missing:** Re-run the migration or manually add:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
```

---

### Step 3: Check Supabase Dashboard

1. Go to **Database → Replication**
2. Verify these tables are listed:
   - ✅ `public.conversations`
   - ✅ `public.messages`
   - ✅ `public.conversation_members`

3. If not listed, click **"Enable Replication"** for each table

---

### Step 4: Verify RLS Policies

Run in SQL Editor:
```sql
-- Check messages table policies
SELECT * FROM pg_policies 
WHERE tablename = 'messages' 
AND schemaname = 'public';
```

Should have:
- ✅ "Members can view conversation messages"
- ✅ "Members can send messages"

---

### Step 5: Test Realtime Connection

Create a simple test in browser console:

```javascript
// On receiver's browser console
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY'
);

const channel = supabase
  .channel('test-channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    console.log('TEST: Message received!', payload);
  })
  .subscribe((status) => {
    console.log('TEST: Subscription status:', status);
  });
```

Then send a message from sender. Receiver console should show the message.

---

## 🔧 Common Fixes:

### Fix 1: Realtime Not Enabled
```sql
-- Run in Supabase SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

### Fix 2: Restart Supabase Realtime
In Supabase Dashboard:
- Settings → API → Restart Realtime Server

### Fix 3: Check Environment Variables
Verify `.env.local` has correct values:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Fix 4: Clear Browser Cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear site data in DevTools
- Try incognito window

---

## 🎯 Quick Test:

1. **Open TWO browsers** (or incognito + normal)
2. **Login as different users** (sender and receiver)
3. **Open same conversation** on both
4. **Check console** on both browsers
5. **Send message** from one
6. **Verify it appears instantly** on the other

---

## 📊 Expected Behavior:

✅ **Sender:**
- Message appears instantly (optimistic UI)
- Console shows: "🔄 Replacing optimistic message with real one"

✅ **Receiver:**
- Console shows: "📨 Realtime message received"
- Message appears within 1-2 seconds
- Console shows: "✅ Adding new message to thread"

---

## 🚨 If Still Not Working:

1. **Check Supabase Project Status**
   - Go to Supabase dashboard
   - Check if project is healthy
   - Check Realtime logs

2. **Verify User Permissions**
   - Check RLS policies allow reading messages
   - Verify user is member of conversation

3. **Network Issues**
   - Check if WebSocket connections are blocked
   - Try different network
   - Check firewall settings

4. **Contact Support**
   - Share console logs
   - Share subscription status
   - Share RLS policy output

