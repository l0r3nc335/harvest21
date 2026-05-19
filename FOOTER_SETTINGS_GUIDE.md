# Footer Settings Feature - Implementation Guide

## Overview
This feature allows admins to manage content for all footer pages through the Homepage Settings admin panel. Footer links remain hardcoded, but page content is fully editable.

## Database Schema

### Table: `footer_content`
Stores content for all 7 footer pages.

**Columns:**
- `id` - Primary key
- `created_at` - Timestamp
- `updated_at` - Timestamp  
- `page_type` - One of: `about_us`, `statement_of_faith`, `donate`, `faq`, `contact_us`, `privacy_policy`, `terms_of_use`
- `title` - Page title
- `content` - JSON content (structure varies by page type)

**RLS Policies:**
- Public: Read access to all content
- Admin: Full CRUD access

## Setup Instructions

### 1. Run Database Migration

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- File: supabase/migrations/create_footer_settings.sql
```

This creates:
- `footer_content` table
- Default content for all 7 pages
- RLS policies

### 2. Admin Interface

Navigate to: **Admin Dashboard → Homepage Settings → Global Settings Tab**

You'll see a new "Footer Page Content" section with tabs for each page.

## Content Format

### FAQ Page (Special Editor)
The **FAQ page** has a dedicated editor where you can add/remove questions and answers dynamically:
- Click "Add Question" to create a new FAQ item
- Fill in the question and answer fields
- Use the up/down arrows to reorder items
- Click the trash icon to delete an item
- Data is stored as JSON: `{"items":[{"id":"...","question":"...","answer":"..."}]}`

### Other Pages (Plain Text)
All other pages use **plain text** format. Simply type your content in the textarea and use line breaks to separate paragraphs and sections.

**Format Tips:**
- Use blank lines to separate sections
- Write headings on their own line
- Follow headings with content paragraphs
- Press Enter twice for paragraph breaks

**Example:**
```
Page Title

This is the first paragraph with some introductory content.

Section Heading

This is a paragraph under the section heading. You can write as much as you need.

Another Section

More content here. Keep it clear and well-organized.
```

## Files Created/Modified

### New Files:
- `supabase/migrations/create_footer_settings.sql`
- `app/admin/homepage-settings/footerActions.ts`
- `components/admin/homepage-settings/FooterSettingsSection.tsx`

### Modified Files:
- `types/homepage.ts` - Added footer types
- `app/admin/homepage-settings/page.tsx` - Fetch footer content
- `components/admin/HomepageSettingsClient.tsx` - Pass footer data
- `components/admin/homepage-settings/GlobalSettingsTab.tsx` - Include footer section

## Features

✅ **7 Editable Pages:**
- About Us
- Statement of Faith
- Donate
- FAQ
- Contact Us
- Privacy Policy
- Terms of Use

✅ **Admin Interface:**
- Tabbed navigation
- Plain text editor (no JSON needed!)
- Title field (read-only)
- Large textarea for content
- Save button per page
- Success/error notifications

✅ **Security:**
- RLS policies (public read, admin write)
- Admin-only access to edit

✅ **Hardcoded Links:**
- Footer links remain in `components/Footer.tsx`
- Only content is managed via admin panel

## Next Steps

### To Integrate with Frontend Pages:

1. **Fetch Content in Page:**
```typescript
import { fetchFooterContent } from "@/app/admin/homepage-settings/footerActions";

export default async function AboutUsPage() {
  const result = await fetchFooterContent("about_us");
  const pageContent = result.success ? result.data : null;
  
  // Content is plain text - split by double line breaks for paragraphs
  const paragraphs = pageContent?.content.split('\n\n') || [];
  
  return (
    <div>
      <h1>{pageContent?.title}</h1>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
```

2. **Update Each Page:**
- `/app/about-us/page.tsx`
- `/app/statement-of-faith/page.tsx`
- `/app/donate/page.tsx`
- `/app/faq/page.tsx`
- `/app/contact-us/page.tsx`
- `/app/privacy-policy/page.tsx`
- `/app/terms-of-use/page.tsx`

## Troubleshooting

**Schema Cache Error?**
- Reload schema cache in Supabase Dashboard (API section)
- Or run: `NOTIFY pgrst, 'reload schema';`

**Permission Denied?**
- Ensure you're logged in as admin
- Check RLS policies in Supabase

**Content Not Saving?**
- Check that you're logged in as admin
- Ensure database migration was run
- Check browser console for errors

## Support

For questions or issues, check:
- Supabase logs for database errors
- Browser console for frontend errors
- Next.js logs for server errors

