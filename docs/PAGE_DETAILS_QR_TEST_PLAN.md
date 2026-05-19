# Page Details QR Code – Test Plan

## Scope
- Feature: Generate and download QR code on **Page Details** tab only.
- Component: `PageDetailsQRCode` used inside `PageDetailsTab`.

---

## Manual tests

### 1. Visibility and placement
- [ ] Open **Settings** as a missionary (or church/agency owner). Go to **Page Details** tab.
- [ ] Confirm: Page URL line is shown; directly below it, **Generate QR Code** button is visible. No QR is shown yet.
- [ ] Confirm: QR section does **not** appear on other tabs (Account, Followers, Donations, etc.).
- [ ] Open **Admin** → Missionary (or Church/Agency) → **Page Details** tab. Confirm the **Generate QR Code** block is **not** visible (admin is not page owner).

### 2. Generate and display
- [ ] Click **Generate QR Code**. Button shows loading/disabled during generation.
- [ ] After generation: one QR code appears inline below the button; no page reload.
- [ ] Click **Regenerate QR Code**: the same QR is replaced (no second QR instance).

### 3. Actions after generation
- [ ] **Download PNG**: file downloads; open and confirm it is QR only (no padding/watermarks/UI).
- [ ] **Download SVG**: file downloads; open and confirm it is QR only.
- [ ] **Copy Page URL**: click copies the canonical public Page URL; paste elsewhere and confirm it matches (e.g. `https://harvest21.com/your-page-slug`).

### 4. Error and edge cases
- [ ] Clear the Page URL field so it is empty (or only origin). **Generate QR Code** should be disabled; if triggered, no QR and clear error near the button; button becomes clickable again.
- [ ] If you simulate a generation failure (e.g. temporarily break the QR library), confirm: no QR shown, error message near button, button re-enabled.

### 5. Security and data
- [ ] As page owner (Settings): you can generate and download; QR content is the **public** page URL only (e.g. `https://harvest21.com/my-slug`).
- [ ] As admin (Admin manage page): QR section is not shown; no way to generate from that context.

---

## Unit tests (when test runner is added)

Suggested tests for `PageDetailsQRCode`:

1. **Renders nothing when `isPageOwner` is false**  
   - Render with `isPageOwner={false}`.  
   - Expect no button and no QR section.

2. **Shows Generate button when `isPageOwner` is true and URL is valid**  
   - Render with `isPageOwner={true}` and a valid `canonicalPageUrl` (e.g. `https://example.com/my-page`).  
   - Expect "Generate QR Code" button to be visible and enabled.

3. **Generate button is disabled when URL is invalid**  
   - Render with `canonicalPageUrl` equal to origin only (e.g. `https://example.com/`).  
   - Expect "Generate QR Code" button to be disabled.

4. **After generate, QR is shown and actions are available**  
   - Render with valid URL, simulate click on Generate.  
   - Expect one QR image, and Download PNG, Download SVG, Copy URL actions to be present (assert by label or role).

5. **Regenerate replaces existing QR**  
   - Generate once, then change `canonicalPageUrl` and click Regenerate.  
   - Expect only one QR in the DOM (e.g. single SVG or canvas).

Project currently has no Jest/Vitest; add these when a test setup is introduced.
