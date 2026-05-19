'use strict';
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ─── Page Size ────────────────────────────────────────────────────────────────
const PW = 1190, PH = 842;  // A3 landscape

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  client   : '#1D4ED8',  clientBg  : '#EFF6FF',
  mw       : '#475569',  mwBg      : '#F1F5F9',
  api      : '#059669',  apiBg     : '#ECFDF5',
  actions  : '#7C3AED',  actionsBg : '#F5F3FF',
  services : '#B45309',  servicesBg: '#FFFBEB',
  data     : '#0F766E',  dataBg    : '#F0FDFA',
  external : '#B91C1C',  externalBg: '#FFF1F2',

  user     : '#1D4ED8',
  comp     : '#7C3AED',
  apiBox   : '#059669',
  webhook  : '#0891B2',
  stripe   : '#635BFF',
  db       : '#0F766E',
  email    : '#B45309',
  admin    : '#DC2626',
  social   : '#0284C7',
  system   : '#475569',

  white    : '#FFFFFF',
  text     : '#0F172A',
  sub      : '#64748B',
  arrow    : '#64748B',
  page     : '#F8FAFC',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pageHeader(doc, title, subtitle, pageNum) {
  // Dark bar
  doc.rect(0, 0, PW, 38).fill('#0F172A');
  doc.fillColor('#F1F5F9').font('Helvetica-Bold').fontSize(14)
     .text(title, 20, 10, { continued: true });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(10)
     .text('  —  ' + subtitle, { continued: false });
  // Page number
  doc.fillColor('#64748B').font('Helvetica').fontSize(8)
     .text('H21 Business Logic · Page ' + pageNum + ' / 6', PW - 200, 13,
           { width: 190, align: 'right' });
  // Legend bar
  doc.rect(0, 38, PW, 1).fill('#334155');
}

function legendChip(doc, x, y, label, color) {
  const w = doc.widthOfString(label, { size: 7 }) + 14;
  doc.roundedRect(x, y, w, 13, 3).fill(color);
  doc.fillColor('#fff').font('Helvetica').fontSize(7)
     .text(label, x + 5, y + 3, { lineBreak: false });
  return x + w + 5;
}

function sectionTitle(doc, x, y, text, color) {
  doc.rect(x, y, 8, 14).fill(color);
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(9)
     .text(text, x + 12, y + 2, { lineBreak: false });
}

// ─── Architecture Overview ────────────────────────────────────────────────────
function drawArchPage(doc) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, 'H21 Platform — System Architecture', 'Full-stack component layers and service topology', 1);

  const mx = 25, cy = 46;
  const BW = PW - mx * 2;

  // Helper: draw one architecture layer
  function layer(y, h, bg, border, title, groups) {
    doc.rect(mx, y, BW, h).fill(bg);
    doc.rect(mx, y, BW, h).lineWidth(1).stroke(border);
    // Title pill on left
    doc.rect(mx, y, 105, h).fill(border);
    // Rotated title
    const cx2 = mx + 52, cy2 = y + h / 2;
    doc.save().rotate(-90, { origin: [cx2, cy2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
       .text(title, cx2 - h / 2, cy2 - 4, { width: h, align: 'center', lineBreak: false })
       .restore();

    let gx = mx + 114, gy = y + 10;
    groups.forEach(g => {
      // Group label
      doc.fillColor(border).font('Helvetica-Bold').fontSize(7.5)
         .text(g.label + ':', gx, gy, { lineBreak: false });
      let cx3 = gx + doc.widthOfString(g.label + ': ') + 4;
      g.items.forEach(item => {
        const tw = doc.widthOfString(item, { size: 7 }) + 12;
        if (cx3 + tw > PW - 35) { cx3 = gx + 2; gy += 18; }
        doc.roundedRect(cx3, gy - 1, tw, 15, 3)
           .fillAndStroke(border + '20', border);
        doc.fillColor(border).font('Helvetica').fontSize(7)
           .text(item, cx3 + 5, gy + 3, { lineBreak: false });
        cx3 += tw + 5;
      });
      gy += 22;
      gx = mx + 114;
    });
  }

  // ── Layer 1: Browser / Client ──────────────────────────────────────────────
  layer(cy, 98, C.clientBg, C.client, '① CLIENT\nBROWSER', [
    { label: 'Public Pages', items: ['/ Home', '/missionaries/[region]', '/[page_url] Profile', '/donate', '/login', '/signup', '/church/[id]'] },
    { label: 'Auth Pages', items: ['/forgot-password', '/reset-password', '/welcome', '/settings', '/messages', '/messages/[id]'] },
    { label: 'Admin Pages', items: ['/admin', '/admin/missionaries', '/admin/churches', '/admin/agencies', '/admin/transactions', '/admin/users', '/admin/homepage-settings'] },
    { label: 'Key Components', items: ['DonateFormClient', 'MessagesShell', 'TemplateRenderer', 'PrayerWall', 'PhotoWall', 'VideoWall', 'MissionaryGrid', 'AdminDashboard'] },
  ]);

  // Arrow 1
  const ax = PW / 2;
  drawArrow(doc, ax, cy + 98, ax, cy + 115, '#94A3B8', 'HTTP / Server Actions');

  // ── Layer 2: Middleware ────────────────────────────────────────────────────
  layer(cy + 116, 34, C.mwBg, C.mw, '② MIDDLEWARE', [
    { label: 'middleware.ts', items: ['Maintenance redirect', 'CORS (OPTIONS)', 'Auth session refresh (updateSession)', 'Route guards: admin role check', 'Unauthenticated redirect → /', 'Skip /api routes'] },
  ]);

  drawArrow(doc, ax, cy + 150, ax, cy + 163, '#94A3B8', '');

  // ── Layer 3: API Routes + Server Actions ──────────────────────────────────
  const l3y = cy + 164, l3h = 120;
  const halfW = (BW - 4) / 2;

  // Left: API Routes
  doc.rect(mx, l3y, halfW, l3h).fill(C.apiBg);
  doc.rect(mx, l3y, halfW, l3h).lineWidth(1).stroke(C.api);
  doc.rect(mx, l3y, 105, l3h).fill(C.api);
  doc.save().rotate(-90, { origin: [mx + 52, l3y + l3h / 2] })
     .fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
     .text('③ API ROUTES  /api/*', mx + 52 - l3h / 2, l3y + l3h / 2 - 4,
           { width: l3h, align: 'center', lineBreak: false }).restore();

  const apiGroups = [
    { label: 'Auth', items: ['signin', 'signout', 'signup-supporter', 'activate-account', 'send-activation-email', 'send-reset-email'] },
    { label: 'Payments', items: ['donate/create-payment-intent', 'stripe-connect/create-account', 'stripe-connect/account-status', 'webhooks/stripe'] },
    { label: 'Media', items: ['page-media', 'page-widgets', 'photos', 'videos', 'storage/signed-upload'] },
    { label: 'Video', items: ['wistia/token', 'wistia/upload', 'wistia/upload-credentials', 'wistia/folders', 'wistia/move-video', 'wistia/config'] },
    { label: 'Misc', items: ['contact', 'get-page-id', 'get-page-data', 'user-profile', 'missionaries/[id]/followers'] },
  ];
  let gx3 = mx + 114, gy3 = l3y + 8;
  apiGroups.forEach(g => {
    doc.fillColor(C.api).font('Helvetica-Bold').fontSize(7)
       .text(g.label + ':', gx3, gy3, { lineBreak: false });
    let cx3 = gx3 + doc.widthOfString(g.label + ': ') + 4;
    g.items.forEach(item => {
      const tw = doc.widthOfString(item, { size: 6.5 }) + 10;
      if (cx3 + tw > mx + halfW - 5) { cx3 = gx3 + 2; gy3 += 16; }
      doc.roundedRect(cx3, gy3 - 1, tw, 13, 3).fillAndStroke(C.api + '20', C.api);
      doc.fillColor(C.api).font('Helvetica').fontSize(6.5)
         .text(item, cx3 + 4, gy3 + 2, { lineBreak: false });
      cx3 += tw + 4;
    });
    gy3 += 18;
    gx3 = mx + 114;
  });

  // Right: Server Actions
  const rx = mx + halfW + 4;
  doc.rect(rx, l3y, halfW, l3h).fill(C.actionsBg);
  doc.rect(rx, l3y, halfW, l3h).lineWidth(1).stroke(C.actions);
  doc.rect(rx, l3y, 105, l3h).fill(C.actions);
  doc.save().rotate(-90, { origin: [rx + 52, l3y + l3h / 2] })
     .fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
     .text('③ SERVER ACTIONS  actions.ts', rx + 52 - l3h / 2, l3y + l3h / 2 - 4,
           { width: l3h, align: 'center', lineBreak: false }).restore();

  const actGroups = [
    { label: 'Admin', items: ['createMissionary', 'updateMissionaryDetails', 'getMissionaryDonations', 'createChurch', 'createAgency'] },
    { label: 'Settings', items: ['getCurrentUserProfile', 'getDonationsForCurrentUser', 'cancelRecurringDonation', 'updateDonationOptions', 'publishPage'] },
    { label: 'Social', items: ['followMissionary', 'unfollowMissionary', 'getChurchFollowers', 'updateFollowerStatus'] },
    { label: 'Messaging', items: ['getConversations', 'sendMessage', 'markAsRead', 'reportMessage'] },
    { label: 'Content', items: ['createBanner', 'updateHomepageSettings', 'submitPageForReview', 'getMissionaryMedia', 'createMissionaryWidget'] },
    { label: 'Fetch', items: ['fetchMissionariesOverview', 'fetchMissionariesByRegion', 'getMissionaryPreviewBySlug', 'getMissionaryDonationsTotal'] },
  ];
  let gx4 = rx + 114, gy4 = l3y + 8;
  actGroups.forEach(g => {
    doc.fillColor(C.actions).font('Helvetica-Bold').fontSize(7)
       .text(g.label + ':', gx4, gy4, { lineBreak: false });
    let cx4 = gx4 + doc.widthOfString(g.label + ': ') + 4;
    g.items.forEach(item => {
      const tw = doc.widthOfString(item, { size: 6.5 }) + 10;
      if (cx4 + tw > rx + halfW - 5) { cx4 = gx4 + 2; gy4 += 16; }
      doc.roundedRect(cx4, gy4 - 1, tw, 13, 3).fillAndStroke(C.actions + '20', C.actions);
      doc.fillColor(C.actions).font('Helvetica').fontSize(6.5)
         .text(item, cx4 + 4, gy4 + 2, { lineBreak: false });
      cx4 += tw + 4;
    });
    gy4 += 18;
    gx4 = rx + 114;
  });

  drawArrow(doc, ax, cy + 284, ax, cy + 297, '#94A3B8', '');

  // ── Layer 4: Business Logic (lib/) ────────────────────────────────────────
  layer(cy + 298, 76, C.servicesBg, C.services, '④ LIB\nSERVICES', [
    { label: 'Donations', items: ['donationHelpers', 'stripeHelpers', 'stripeRecurringDonationPersist', 'stripeDonationEmails'] },
    { label: 'Email', items: ['gmailMailerService', 'emailHelpers', 'emailTemplates'] },
    { label: 'Pages', items: ['pageHelpers', 'pageActions', 'pageDataLoader', 'templateRegistry', 'organizationPreviewActions'] },
    { label: 'Users', items: ['userActions', 'navbarHelpers', 'userActivityHelpers', 'tokenHelpers', 'affiliationFollowSync'] },
    { label: 'Media', items: ['wistiaService', 'wistiaClient', 'fileUploadHelpers', 'mediaCompressionService', 'photoActions', 'videoActions'] },
    { label: 'Other', items: ['notificationHelpers', 'prayerActions', 'missionaryContentUpdates', 'globalSearch', 'rateLimit', 'supabaseServer'] },
  ]);

  drawArrow(doc, ax, cy + 374, ax, cy + 387, '#94A3B8', '');

  // ── Layer 5: Data + External ──────────────────────────────────────────────
  const l5y = cy + 388, l5h = 90;
  const q1 = (BW - 4) * 0.55;
  const q2 = (BW - 4) * 0.45;

  // Supabase
  doc.rect(mx, l5y, q1, l5h).fill(C.dataBg);
  doc.rect(mx, l5y, q1, l5h).lineWidth(1).stroke(C.data);
  doc.rect(mx, l5y, 105, l5h).fill(C.data);
  doc.save().rotate(-90, { origin: [mx + 52, l5y + l5h / 2] })
     .fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
     .text('⑤ SUPABASE', mx + 52 - l5h / 2, l5y + l5h / 2 - 4,
           { width: l5h, align: 'center', lineBreak: false }).restore();
  const supaItems = [
    { label: 'Database', items: ['page_donations', 'donors', 'pages', 'missionaries', 'churches', 'agencies', 'follow_requests', 'prayer_requests', 'page_media', 'page_widgets', 'conversations', 'messages'] },
    { label: 'Auth', items: ['auth.users (JWT sessions)', 'Row Level Security (RLS)', 'Session cookies'] },
    { label: 'Storage', items: ['h21-dev bucket (images, files, thumbnails, PDFs)'] },
    { label: 'Realtime', items: ['messages channel', 'notifications'] },
  ];
  let sgy = l5y + 8, sgx = mx + 114;
  supaItems.forEach(g => {
    doc.fillColor(C.data).font('Helvetica-Bold').fontSize(7)
       .text(g.label + ':', sgx, sgy, { lineBreak: false });
    let scx = sgx + doc.widthOfString(g.label + ': ') + 4;
    g.items.forEach(item => {
      const tw = doc.widthOfString(item, { size: 6.5 }) + 10;
      if (scx + tw > mx + q1 - 5) { scx = sgx + 2; sgy += 16; }
      doc.roundedRect(scx, sgy - 1, tw, 13, 3).fillAndStroke(C.data + '20', C.data);
      doc.fillColor(C.data).font('Helvetica').fontSize(6.5)
         .text(item, scx + 4, sgy + 2, { lineBreak: false });
      scx += tw + 4;
    });
    sgy += 18;
    sgx = mx + 114;
  });

  // External APIs
  const ex = mx + q1 + 4;
  doc.rect(ex, l5y, q2, l5h).fill(C.externalBg);
  doc.rect(ex, l5y, q2, l5h).lineWidth(1).stroke(C.external);
  doc.rect(ex, l5y, 105, l5h).fill(C.external);
  doc.save().rotate(-90, { origin: [ex + 52, l5y + l5h / 2] })
     .fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
     .text('⑤ EXTERNAL APIs', ex + 52 - l5h / 2, l5y + l5h / 2 - 4,
           { width: l5h, align: 'center', lineBreak: false }).restore();
  const extItems = [
    { label: 'Stripe', items: ['PaymentIntents', 'Subscriptions', 'Webhooks', 'Connect (Express accounts)', 'Refunds / Disputes'] },
    { label: 'Gmail', items: ['Nodemailer transport', 'Activation emails', 'Donation receipts', 'Missionary notifications', 'Contact form', 'Password reset'] },
    { label: 'Wistia', items: ['Video hosting', 'OAuth2 token', 'Upload API', 'Projects & folders'] },
    { label: 'Other', items: ['Google Analytics (GA4)'] },
  ];
  let egy = l5y + 8, egx = ex + 114;
  extItems.forEach(g => {
    doc.fillColor(C.external).font('Helvetica-Bold').fontSize(7)
       .text(g.label + ':', egx, egy, { lineBreak: false });
    let ecx = egx + doc.widthOfString(g.label + ': ') + 4;
    g.items.forEach(item => {
      const tw = doc.widthOfString(item, { size: 6.5 }) + 10;
      if (ecx + tw > ex + q2 - 5) { ecx = egx + 2; egy += 16; }
      doc.roundedRect(ecx, egy - 1, tw, 13, 3).fillAndStroke(C.external + '20', C.external);
      doc.fillColor(C.external).font('Helvetica').fontSize(6.5)
         .text(item, ecx + 4, egy + 2, { lineBreak: false });
      ecx += tw + 4;
    });
    egy += 18;
    egx = ex + 114;
  });

  // Footer note
  doc.fillColor(C.sub).font('Helvetica').fontSize(7.5)
     .text('All layers communicate via typed TypeScript interfaces. Supabase Admin client (service role) bypasses RLS for privileged operations. Auth session managed via @supabase/ssr HTTP-only cookies.',
           mx, PH - 18, { width: BW });
}

// ─── Arrow Helper ─────────────────────────────────────────────────────────────
function drawArrow(doc, x1, y1, x2, y2, color, label) {
  color = color || C.arrow;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const arrowSize = 6;

  doc.moveTo(x1, y1).lineTo(x2, y2)
     .lineWidth(1.2).strokeColor(color).stroke();
  // Arrowhead
  doc.polygon(
    [x2, y2],
    [x2 - ux * arrowSize - uy * arrowSize * 0.5, y2 - uy * arrowSize + ux * arrowSize * 0.5],
    [x2 - ux * arrowSize + uy * arrowSize * 0.5, y2 - uy * arrowSize - ux * arrowSize * 0.5]
  ).fill(color);

  if (label) {
    const lx = (x1 + x2) / 2 + 4, ly = (y1 + y2) / 2 - 8;
    doc.fillColor(color).font('Helvetica').fontSize(6.5)
       .text(label, lx, ly, { lineBreak: false });
  }
}

function drawArrowH(doc, x1, y, x2, color, label) {
  drawArrow(doc, x1, y, x2, y, color, label);
}

function drawArrowV(doc, x, y1, y2, color, label) {
  drawArrow(doc, x, y1, x, y2, color, label);
}

// ─── Flow Box ─────────────────────────────────────────────────────────────────
function flowBox(doc, x, y, w, h, color, title, sub) {
  doc.roundedRect(x, y, w, h, 5).fill(color);
  const titleH = sub ? h * 0.5 : h;
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
     .text(title, x + 6, y + (sub ? 6 : (h - 10) / 2),
           { width: w - 12, align: 'center', lineBreak: false });
  if (sub) {
    doc.fillColor('rgba(255,255,255,0.75)').font('Helvetica').fontSize(6.5)
       .text(sub, x + 5, y + h * 0.52, { width: w - 10, align: 'center' });
  }
}

function decisionBox(doc, x, y, w, h, color, title) {
  const cx = x + w / 2, cy2 = y + h / 2;
  doc.polygon([cx, y], [x + w, cy2], [cx, y + h], [x, cy2]).fill(color);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(6.5)
     .text(title, x + 12, cy2 - 6, { width: w - 24, align: 'center' });
}

// ─── Swimlane Page Helpers ────────────────────────────────────────────────────
function swimPage(doc, title, subtitle, pageNum, lanes) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, title, subtitle, pageNum);

  const startY = 44;
  let totalH = PH - startY - 8;
  const laneH = Math.floor(totalH / lanes.length);

  lanes.forEach((lane, i) => {
    const ly = startY + i * laneH;
    const bg = i % 2 === 0 ? '#F8FAFC' : '#F1F5F9';
    doc.rect(0, ly, PW, laneH).fill(bg);
    // Swimlane header strip
    doc.rect(0, ly, 56, laneH).fill(lane.color);
    // Rotated label
    doc.save()
       .rotate(-90, { origin: [28, ly + laneH / 2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
       .text(lane.name, 28 - laneH / 2, ly + laneH / 2 - 4,
             { width: laneH, align: 'center', lineBreak: false })
       .restore();
    // Separator line
    if (i > 0) doc.moveTo(0, ly).lineTo(PW, ly).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  });

  return { laneY: (i) => startY + i * laneH, laneH };
}

// ─── Page 2: Auth & User Onboarding ──────────────────────────────────────────
function drawAuthPage(doc) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, 'Authentication & User Onboarding', 'Sign-in · Sign-up · Activation · Password Reset · Session Management', 2);

  const TOP = 46, BOT = PH - 10;
  const USABLE = BOT - TOP;

  // ── Swimlanes (5 rows) ───────────────────────────────────────────────────
  const lanes = [
    { name: 'USER / BROWSER', color: C.user },
    { name: 'MIDDLEWARE', color: C.mw },
    { name: 'API ROUTES', color: C.api },
    { name: 'SUPABASE AUTH', color: C.data },
    { name: 'DATABASE + EMAIL', color: C.email },
  ];
  const LH = Math.floor(USABLE / lanes.length);
  lanes.forEach((l, i) => {
    const ly = TOP + i * LH;
    doc.rect(0, ly, PW, LH).fill(i % 2 === 0 ? '#F8FAFC' : '#F1F5F9');
    doc.rect(0, ly, 56, LH).fill(l.color);
    doc.save().rotate(-90, { origin: [28, ly + LH / 2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(7)
       .text(l.name, 28 - LH / 2, ly + LH / 2 - 4,
             { width: LH, align: 'center', lineBreak: false }).restore();
    if (i > 0) doc.moveTo(0, ly).lineTo(PW, ly).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  });

  // ── Helper: row center Y ──────────────────────────────────────────────────
  const ry = (row) => TOP + row * LH + LH / 2;

  // ── BOX DIMENSIONS ────────────────────────────────────────────────────────
  const BW2 = 135, BH2 = 48;
  const bcy = (row) => ry(row) - BH2 / 2;

  // ── Column positions (X center of each step) ─────────────────────────────
  const cols = [105, 250, 400, 555, 715, 870, 1040, 1160];

  // Color helper
  const lc = (row) => lanes[row].color;

  // ── FLOW 1: Standard Email + Password Login ───────────────────────────────

  // Step labels across top
  const sty = TOP + 2;
  [
    [cols[0], '① Login'],
    [cols[2], '② Submit'],
    [cols[3], '③ Check user'],
    [cols[4], '④ Verify'],
    [cols[5], '⑤ Session'],
    [cols[6], '⑥ Guard'],
  ].forEach(([x, t]) => {
    doc.fillColor(C.sub).font('Helvetica').fontSize(6.5)
       .text(t, x - 40, sty, { width: 80, align: 'center', lineBreak: false });
  });

  // Row 0 (User)
  flowBox(doc, cols[0] - BW2/2, bcy(0), BW2, BH2, lc(0),
    '/login page', 'SignInForm (client component)');
  flowBox(doc, cols[5] - 55, bcy(0), 110, BH2, lc(0),
    'Redirect → / or /settings', '');

  // Row 1 (Middleware)
  flowBox(doc, cols[2] - 55, bcy(1), 110, BH2, lc(1),
    'Pass through', 'JWT cookie refresh\nupdateSession()');
  flowBox(doc, cols[6] - 55, bcy(1), 120, BH2, lc(1),
    'Route guard check', 'Authenticated? → allow\nAdmin role? → allow /admin');

  // Row 2 (API Routes)
  flowBox(doc, cols[2] - 55, bcy(2), 110, BH2, lc(2),
    'POST /api/auth/signin', 'Extract email + password');
  flowBox(doc, cols[3] - 55, bcy(2), 110, BH2, lc(2),
    'Check users.status', 'If "Inactive" → sign out\n& return 401');

  // Row 3 (Supabase Auth)
  flowBox(doc, cols[4] - 55, bcy(3), 110, BH2, lc(3),
    'signInWithPassword()', 'Sets auth.users session\nReturns user object');

  // Row 4 (DB + Email)
  flowBox(doc, cols[3] - 55, bcy(4), 110, BH2, lc(4),
    'users table lookup', 'Check status field\n(active / inactive)');
  flowBox(doc, cols[5] - 55, bcy(4), 110, BH2, lc(4),
    'Set session cookies', 'HTTP-only cookie\nvia @supabase/ssr');

  // Arrows – login flow
  drawArrow(doc, cols[0] + BW2/2, ry(0), cols[2] - 55, ry(2), '#94A3B8', 'POST /api/auth/signin');
  drawArrow(doc, cols[2] + 55, ry(2), cols[3] - 55, ry(2), lc(2));
  drawArrow(doc, cols[3], bcy(2) + BH2, cols[3], bcy(4), lc(2));   // API → DB
  drawArrow(doc, cols[3] + 55, ry(4), cols[4] - 55, ry(3), lc(3), 'valid');
  drawArrow(doc, cols[4] + 55, ry(3), cols[5] - 55, ry(4), lc(4));
  drawArrow(doc, cols[5], bcy(4), cols[5], bcy(0) + BH2, lc(0), '200 + redirect');

  // ── SEPARATOR ─────────────────────────────────────────────────────────────
  const sx = 740;
  doc.moveTo(sx, TOP + 4).lineTo(sx, BOT - 4).lineWidth(1).dash(4, { space: 3 }).strokeColor('#CBD5E1').stroke();
  doc.undash();
  doc.fillColor(C.sub).font('Helvetica-Bold').fontSize(7)
     .text('Account Activation Flow', sx + 8, TOP + 5, { lineBreak: false });

  // ── FLOW 2: Activation (right half) ──────────────────────────────────────
  const ac = [790, 900, 1010, 1120];
  const abw = 100, abh = 44;
  const aby = (row) => TOP + row * LH + (LH - abh) / 2;

  // Row 0 (User): Click activation link
  flowBox(doc, ac[0] - abw/2, aby(0), abw, abh, lc(0),
    'Click activation link', '/activate?token=...');
  flowBox(doc, ac[3] - abw/2, aby(0), abw, abh, lc(0),
    'Set password form', 'Redirect → /settings');

  // Row 2 (API): verify + activate
  flowBox(doc, ac[0] - abw/2, aby(2), abw, abh, lc(2),
    'POST /api/verify-activation-token', 'Decode JWT (tokenHelpers)');
  flowBox(doc, ac[1] - abw/2, aby(2), abw, abh, lc(2),
    'POST /api/activate-account', 'Validate + set password');

  // Row 3 (Supabase Auth)
  flowBox(doc, ac[2] - abw/2, aby(3), abw, abh, lc(3),
    'admin.updateUserById()', 'Set hashed password\nEnable account');

  // Row 4 (DB + Email)
  flowBox(doc, ac[0] - abw/2, aby(4), abw, abh, lc(4),
    'Send activation email', 'POST /api/send-activation-email\nGmail/Nodemailer');
  flowBox(doc, ac[2] - abw/2, aby(4), abw, abh, lc(4),
    'UPDATE users', 'status → "active"');

  drawArrow(doc, ac[0], aby(0) + abh, ac[0], aby(2), '#94A3B8');
  drawArrow(doc, ac[0] + abw/2, aby(2) + abh/2, ac[1] - abw/2, aby(2) + abh/2, lc(2));
  drawArrow(doc, ac[1], aby(2) + abh, ac[2], aby(3), lc(3));
  drawArrow(doc, ac[2], aby(3) + abh, ac[2], aby(4), lc(4));
  drawArrow(doc, ac[3], aby(4), ac[3], aby(0) + abh, lc(0), '✓ activated');

  // Footer note
  doc.fillColor(C.sub).font('Helvetica').fontSize(7)
     .text('Password reset follows the same activation pattern using Supabase Admin generateLink() + custom Gmail email. OAuth callback handled at app/auth/callback/route.ts (code exchange → session).',
           60, PH - 14, { width: PW - 80 });
}

// ─── Page 3: Donation & Payment ───────────────────────────────────────────────
function drawDonationPage(doc) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, 'Donation & Payment Processing', 'One-time · Recurring · Stripe Webhooks · Receipts · Donor Records', 3);

  const TOP = 46, BOT = PH - 12;
  const USABLE = BOT - TOP;
  const lanes = [
    { name: 'DONOR\nBROWSER', color: C.user },
    { name: 'DONATE FORM\nCOMPONENT', color: C.comp },
    { name: 'API\n/api/donate/*', color: C.api },
    { name: 'STRIPE API', color: C.stripe },
    { name: 'STRIPE\nWEBHOOK', color: C.webhook },
    { name: 'DATABASE\n+ EMAIL', color: C.db },
  ];
  const LH = Math.floor(USABLE / lanes.length);
  lanes.forEach((l, i) => {
    const ly = TOP + i * LH;
    doc.rect(0, ly, PW, LH).fill(i % 2 === 0 ? '#F8FAFC' : '#F1F5F9');
    doc.rect(0, ly, 56, LH).fill(l.color);
    doc.save().rotate(-90, { origin: [28, ly + LH / 2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(6.5)
       .text(l.name, 28 - LH / 2, ly + LH / 2 - 4,
             { width: LH, align: 'center', lineBreak: false }).restore();
    if (i > 0) doc.moveTo(0, ly).lineTo(PW, ly).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  });

  const ry = (row) => TOP + row * LH + LH / 2;
  const BW3 = 130, BH3 = 44;
  const by = (row) => ry(row) - BH3 / 2;
  const lc = (row) => lanes[row].color;

  // X positions for each step
  const xs = [95, 230, 365, 500, 635, 770, 905, 1040, 1150];

  // ── Step labels ───────────────────────────────────────────────────────────
  const labels = ['① Open page', '② Fill form', '③ POST intent', '④ Create customer', '⑤ Create intent', '⑥ Confirm', '⑦ Redirect', '⑧ Webhook', '⑨ Persist'];
  labels.forEach((t, i) => {
    doc.fillColor(C.sub).font('Helvetica').fontSize(6)
       .text(t, xs[i] - 40, TOP + 2, { width: 80, align: 'center', lineBreak: false });
  });

  // Row 0 (Donor)
  flowBox(doc, xs[0] - BW3/2, by(0), BW3, BH3, lc(0),
    'Open /donate?page_id=…', 'Browser loads donation page');
  flowBox(doc, xs[6] - 55, by(0), 110, BH3, lc(0),
    'Stripe redirect →\n/donate?payment_intent=…', '');
  flowBox(doc, xs[8] - 50, by(0), 100, BH3, '#10B981',
    '✓ Donation Complete', 'Receipt shows in /settings');

  // Row 1 (DonateFormClient)
  flowBox(doc, xs[1] - BW3/2, by(1), BW3, BH3, lc(1),
    'DonateFormClient', 'Amount + Billing Info\nDesignation (optional)');
  flowBox(doc, xs[5] - 55, by(1), 110, BH3, lc(1),
    'stripe.confirmPayment()', 'Stripe Elements handles\ncard input securely');

  // Row 2 (API)
  flowBox(doc, xs[2] - BW3/2, by(2), BW3, BH3, lc(2),
    'POST create-payment-intent', 'Rate limit · Build metadata:\nbilling_* · designation · page_id');
  flowBox(doc, xs[7] - 55, by(2), 110, BH3, lc(2),
    'ensureDonationFrom\nPaymentIntent()', 'Fallback: insert if\nwebhook missed');

  // Row 3 (Stripe)
  flowBox(doc, xs[3] - BW3/2, by(3), BW3, BH3, lc(3),
    'Stripe.customers.create()', 'or retrieve existing\ncustomer by email');
  flowBox(doc, xs[4] - BW3/2, by(3), BW3, BH3, lc(3),
    'PaymentIntent / Subscription', 'One-time: createPaymentIntent\nRecurring: createSubscription');

  // Row 4 (Webhook)
  flowBox(doc, xs[7] - BW3/2, by(4), BW3, BH3, lc(4),
    'payment_intent.succeeded\nor invoice.paid', 'Verify Stripe signature\nExtract metadata');

  // Row 5 (DB + Email)
  flowBox(doc, xs[8] - 60, by(5), 120, BH3, lc(5),
    'INSERT page_donations', 'donor_id · amount · designation\ndonor_first/last/email');
  flowBox(doc, xs[6] - 55, by(5), 110, BH3, lc(5),
    'INSERT donation_receipts\nNotify missionary', 'donors table lookup\ngetOrCreateDonorFromBilling');
  flowBox(doc, xs[4] - 55, by(5), 110, BH3, lc(5),
    'Send emails (Gmail)', 'Donor receipt HTML\nMissionary confirmation');

  // ── Arrows ────────────────────────────────────────────────────────────────
  // User opens page → form
  drawArrow(doc, xs[0] + BW3/2, ry(0), xs[1] - BW3/2, ry(1), '#94A3B8', '');
  // Form → POST
  drawArrow(doc, xs[1] + BW3/2, ry(1), xs[2] - BW3/2, ry(2), '#94A3B8', '');
  // API → create customer
  drawArrow(doc, xs[2] + BW3/2, ry(2), xs[3] - BW3/2, ry(3), '#94A3B8', '');
  // Customer → create intent
  drawArrow(doc, xs[3] + BW3/2, ry(3), xs[4] - BW3/2, ry(3), lc(3), '');
  // Intent → client secret back to form
  drawArrow(doc, xs[4] - 20, by(3), xs[5] - 20, by(1) + BH3, lc(1), 'clientSecret');
  // Form confirm payment
  drawArrow(doc, xs[5] + 55, ry(1), xs[6] - 55, ry(0), '#94A3B8', '');
  // Redirect → ensureDonation
  drawArrow(doc, xs[6] + 55, ry(0), xs[7] - 55, ry(2), lc(2), '');
  // Stripe fires webhook
  drawArrow(doc, xs[4] + BW3/2, ry(3), xs[7] - BW3/2, ry(4), '#94A3B8', 'Stripe event');
  // Webhook → DB
  drawArrow(doc, xs[7], by(4) + BH3, xs[7], by(5), lc(5), '');
  // DB → emails
  drawArrow(doc, xs[6] + 55, ry(5), xs[4] + 55, ry(5), lc(5), '');
  // emails → DB receipts
  drawArrow(doc, xs[6], by(5), xs[7] - 60, by(5), lc(5), '');
  // DB → complete
  drawArrow(doc, xs[8] - 60 + 120, ry(5), xs[8] - 50, by(0) + BH3, '#10B981', '');

  // ── Recurring note ────────────────────────────────────────────────────────
  doc.rect(60, PH - 22, PW - 70, 14).fill('#EFF6FF');
  doc.fillColor(C.client).font('Helvetica-Bold').fontSize(7)
     .text('Recurring Donations: ', 65, PH - 19, { continued: true })
     .font('Helvetica')
     .text('Stripe creates a Subscription → fires invoice.paid each billing cycle → handled by persistHarvest21RecurringDonationForInvoice() → separate page_donations row per cycle. Cancellation: cancelRecurringDonation() server action calls stripe.subscriptions.cancel().',
           { lineBreak: false });
}

// ─── Page 4: Profile Pages & Content ─────────────────────────────────────────
function drawProfilePage(doc) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, 'Missionary Profile Pages & Content Management', 'Create → Configure → Submit → Review → Approve → Publish · Media · Widgets · Templates', 4);

  const TOP = 46, BOT = PH - 12;
  const USABLE = BOT - TOP;
  const lanes = [
    { name: 'ADMIN\nUSER', color: C.admin },
    { name: 'SERVER\nACTIONS', color: C.actions },
    { name: 'LIB\nSERVICES', color: C.services },
    { name: 'SUPABASE\nDB', color: C.db },
    { name: 'SUPABASE\nSTORAGE', color: C.data },
  ];
  const LH = Math.floor(USABLE / lanes.length);
  lanes.forEach((l, i) => {
    const ly = TOP + i * LH;
    doc.rect(0, ly, PW, LH).fill(i % 2 === 0 ? '#F8FAFC' : '#F1F5F9');
    doc.rect(0, ly, 56, LH).fill(l.color);
    doc.save().rotate(-90, { origin: [28, ly + LH / 2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(6.5)
       .text(l.name, 28 - LH / 2, ly + LH / 2 - 4,
             { width: LH, align: 'center', lineBreak: false }).restore();
    if (i > 0) doc.moveTo(0, ly).lineTo(PW, ly).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  });

  const ry = (row) => TOP + row * LH + LH / 2;
  const BW4 = 125, BH4 = 44;
  const by = (row) => ry(row) - BH4 / 2;
  const lc = (row) => lanes[row].color;

  const xs4 = [95, 225, 355, 490, 625, 755, 885, 1020, 1145];

  const stepLabels = ['① Create', '② Invite', '③ Activate', '④ Configure', '⑤ Add Content', '⑥ Submit Review', '⑦ Approve', '⑧ Publish', '⑨ Public View'];
  stepLabels.forEach((t, i) => {
    doc.fillColor(C.sub).font('Helvetica').fontSize(6)
       .text(t, xs4[i] - 40, TOP + 2, { width: 80, align: 'center', lineBreak: false });
  });

  // Row 0: Admin
  flowBox(doc, xs4[0] - BW4/2, by(0), BW4, BH4, lc(0),
    '/admin/missionaries', 'createMissionary() action');
  flowBox(doc, xs4[3] - BW4/2, by(0), BW4, BH4, lc(0),
    '/settings page', 'Missionary fills out\nprofile & page details');
  flowBox(doc, xs4[4] - BW4/2, by(0), BW4, BH4, lc(0),
    'Add media & widgets', 'Photos · Videos · PDFs\nRich text editor');
  flowBox(doc, xs4[5] - BW4/2, by(0), BW4, BH4, lc(0),
    'Submit for review', 'submitPageForReview()');
  flowBox(doc, xs4[6] - BW4/2, by(0), BW4, BH4, lc(0),
    'Admin approves', 'approveMissionaryPage()');
  flowBox(doc, xs4[8] - 55, by(0), 110, BH4, '#10B981',
    '✓ Live public page', '/[page_url] visible');

  // Row 1: Server Actions
  flowBox(doc, xs4[0] - BW4/2, by(1), BW4, BH4, lc(1),
    'createMissionary()', 'auth.admin.createUser\nInsert missionaries row');
  flowBox(doc, xs4[1] - BW4/2, by(1), BW4, BH4, lc(1),
    'sendInviteToManaged\nMissionary()', 'sendActivationEmail()');
  flowBox(doc, xs4[3] - BW4/2, by(1), BW4, BH4, lc(1),
    'updateCurrentMissionary\nDetails()', 'Page details · photo');
  flowBox(doc, xs4[7] - BW4/2, by(1), BW4, BH4, lc(1),
    'publishPage()', 'Set pages.published=true');

  // Row 2: Lib Services
  flowBox(doc, xs4[0] - BW4/2, by(2), BW4, BH4, lc(2),
    'pageHelpers\ncreatePageForEntity()', 'Generate unique URL slug\nInsert pages row');
  flowBox(doc, xs4[1] - BW4/2, by(2), BW4, BH4, lc(2),
    'emailHelpers\nsendActivationEmail()', 'JWT token + Gmail\nActivation link email');
  flowBox(doc, xs4[4] - BW4/2, by(2), BW4, BH4, lc(2),
    'pageActions\nfileUploadHelpers', 'Media insert · storage\nWidget create · PDF');
  flowBox(doc, xs4[7] - BW4/2, by(2), BW4, BH4, lc(2),
    'notificationHelpers\nmissionaryContentUpdates', 'Notify followers\nContent badges');

  // Row 3: DB
  flowBox(doc, xs4[0] - BW4/2, by(3), BW4, BH4, lc(3),
    'INSERT missionaries\nINSERT pages', 'missionaries + pages tables\npage_url slug');
  flowBox(doc, xs4[3] - BW4/2, by(3), BW4, BH4, lc(3),
    'UPDATE missionaries\nUPDATE pages', 'Profile data · template\nContact info');
  flowBox(doc, xs4[4] - BW4/2, by(3), BW4, BH4, lc(3),
    'INSERT page_media\nINSERT page_widgets', 'Media rows + storage refs\nWidget data');
  flowBox(doc, xs4[7] - BW4/2, by(3), BW4, BH4, lc(3),
    'UPDATE pages\npublished = true', 'notifications INSERT\nfollowers alerted');

  // Row 4: Storage
  flowBox(doc, xs4[4] - BW4/2, by(4), BW4, BH4, lc(4),
    'h21-dev bucket', 'Profile photos · banners\nPDF widgets · thumbnails');
  flowBox(doc, xs4[1] - BW4/2, by(4), BW4, BH4, lc(4),
    'Wistia / Supabase Storage', 'Video upload\nSigned upload URLs');

  // Arrows
  drawArrow(doc, xs4[0] + BW4/2, ry(0), xs4[1] - BW4/2, ry(1), '#94A3B8', 'invite');
  drawArrow(doc, xs4[0], by(1) + BH4, xs4[0], by(2), lc(2));
  drawArrow(doc, xs4[0], by(2) + BH4, xs4[0], by(3), lc(3));
  drawArrow(doc, xs4[1], by(1) + BH4, xs4[1], by(2), lc(2));
  drawArrow(doc, xs4[1], by(2) + BH4, xs4[1], by(4), lc(4));
  drawArrow(doc, xs4[1] + BW4/2, ry(1), xs4[2] - 10, ry(0), '#94A3B8', '② email sent');
  // Activate = col 2 → 3
  drawArrow(doc, xs4[2] - 5, ry(0), xs4[3] - BW4/2, ry(0), '#94A3B8', '③ activated');
  drawArrow(doc, xs4[3] + BW4/2, ry(0), xs4[4] - BW4/2, ry(0), '#94A3B8', '');
  drawArrow(doc, xs4[3], by(0) + BH4, xs4[3], by(1), lc(1));
  drawArrow(doc, xs4[3], by(1) + BH4, xs4[3], by(3), lc(3));
  drawArrow(doc, xs4[4] + BW4/2, ry(0), xs4[5] - BW4/2, ry(0), '#94A3B8', '');
  drawArrow(doc, xs4[4], by(0) + BH4, xs4[4], by(2), lc(2));
  drawArrow(doc, xs4[4], by(2) + BH4, xs4[4], by(3), lc(3));
  drawArrow(doc, xs4[4], by(3) + BH4, xs4[4], by(4), lc(4));
  drawArrow(doc, xs4[5] + BW4/2, ry(0), xs4[6] - BW4/2, ry(0), '#94A3B8', 'pending review');
  drawArrow(doc, xs4[6] + BW4/2, ry(0), xs4[7] - BW4/2, ry(0), '#94A3B8', '');
  drawArrow(doc, xs4[7], by(0) + BH4, xs4[7], by(1), lc(1));
  drawArrow(doc, xs4[7], by(1) + BH4, xs4[7], by(2), lc(2));
  drawArrow(doc, xs4[7], by(2) + BH4, xs4[7], by(3), lc(3));
  drawArrow(doc, xs4[7] + BW4/2, ry(0), xs4[8] - 55, ry(0), '#10B981', '');

  doc.fillColor(C.sub).font('Helvetica').fontSize(7)
     .text('Template rendering: app/[page_url]/page.tsx → pageDataLoader.getPageDataWithRelations() → TemplateRenderer → section components. Public pages have no auth requirement.',
           60, PH - 14, { width: PW - 80 });
}

// ─── Page 5: Social & Messaging ───────────────────────────────────────────────
function drawSocialPage(doc) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, 'Social Features: Follow · Prayer · Messaging', 'Follow requests · Notifications · Prayer wall · Direct messages · Reports', 5);

  const TOP = 46, BOT = PH - 12;
  const USABLE = BOT - TOP;

  // Split page into two halves: left = Follow/Notifications, right = Messaging
  const halfX = PW / 2 + 30;

  // ── LEFT HALF: Follow & Notifications ─────────────────────────────────────
  doc.fillColor(C.social).font('Helvetica-Bold').fontSize(9)
     .text('FOLLOW & NOTIFICATION FLOW', 60, TOP + 6);

  const lanes5L = [
    { name: 'USER', color: C.user },
    { name: 'SERVER\nACTION', color: C.actions },
    { name: 'DATABASE', color: C.db },
    { name: 'NOTIFICATIONS', color: C.social },
  ];
  const LH5 = Math.floor((USABLE - 24) / lanes5L.length);
  lanes5L.forEach((l, i) => {
    const ly = TOP + 24 + i * LH5;
    doc.rect(56, ly, halfX - 70, LH5).fill(i % 2 === 0 ? '#F8FAFC' : '#F1F5F9');
    doc.rect(56, ly, 50, LH5).fill(l.color);
    doc.save().rotate(-90, { origin: [81, ly + LH5 / 2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(6.5)
       .text(l.name, 81 - LH5 / 2, ly + LH5 / 2 - 4,
             { width: LH5, align: 'center', lineBreak: false }).restore();
    if (i > 0)
      doc.moveTo(56, ly).lineTo(halfX - 14, ly).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  });

  const lry = (r) => TOP + 24 + r * LH5 + LH5 / 2;
  const lbh = 40, lbw = 100;
  const lby = (r) => lry(r) - lbh / 2;
  const llc = (r) => lanes5L[r].color;
  const lxs = [115, 220, 330, 445, 555];

  // Follow request flow
  flowBox(doc, lxs[0] - lbw/2, lby(0), lbw, lbh, llc(0), 'Follow button click', '/missionaries/[id]');
  flowBox(doc, lxs[2] - lbw/2, lby(0), lbw, lbh, llc(0), 'Receive notification', 'Follow request in inbox');
  flowBox(doc, lxs[4] - lbw/2, lby(0), lbw, lbh, '#10B981', '✓ Following', 'Content updates visible');

  flowBox(doc, lxs[0] - lbw/2, lby(1), lbw, lbh, llc(1), 'followMissionary()', 'With optional note (100 chars)');
  flowBox(doc, lxs[2] - lbw/2, lby(1), lbw, lbh, llc(1), 'updateFollowerStatus()', '"approved" / "rejected"');

  flowBox(doc, lxs[0] - lbw/2, lby(2), lbw, lbh, llc(2), 'INSERT follow_requests', 'status="pending", note text');
  flowBox(doc, lxs[2] - lbw/2, lby(2), lbw, lbh, llc(2), 'UPDATE follow_requests', 'status field');

  flowBox(doc, lxs[1] - lbw/2, lby(3), lbw, lbh, llc(3), 'INSERT notifications', 'type="follow_request"');
  flowBox(doc, lxs[3] - lbw/2, lby(3), lbw, lbh, llc(3), 'INSERT notifications', 'type="new_content"\nAll followers notified');

  drawArrow(doc, lxs[0] + lbw/2, lry(0), lxs[0] - lbw/2, lry(1), '#94A3B8');
  drawArrow(doc, lxs[0], lby(1) + lbh, lxs[0], lby(2), llc(2));
  drawArrow(doc, lxs[0] + lbw/2, lry(2), lxs[1] - lbw/2, lry(3), llc(3), 'notify');
  drawArrow(doc, lxs[1], lby(3), lxs[2] - lbw/2, lry(0), '#94A3B8');
  drawArrow(doc, lxs[2] + lbw/2, lry(0), lxs[2] - lbw/2, lry(1), '#94A3B8', 'respond');
  drawArrow(doc, lxs[2], lby(1) + lbh, lxs[2], lby(2), llc(2));
  drawArrow(doc, lxs[2] + lbw/2, lry(2), lxs[3] - lbw/2, lry(3), llc(3));
  drawArrow(doc, lxs[3] + lbw/2, lry(3), lxs[4] - lbw/2, lry(0), '#10B981');

  // ── RIGHT HALF: Messaging ─────────────────────────────────────────────────
  const rStart = halfX;
  const rWidth = PW - rStart - 20;

  doc.fillColor(C.social).font('Helvetica-Bold').fontSize(9)
     .text('DIRECT MESSAGING FLOW', rStart, TOP + 6);

  const lanes5R = [
    { name: 'USER', color: C.user },
    { name: 'SERVER\nACTION', color: C.actions },
    { name: 'DATABASE', color: C.db },
    { name: 'REALTIME', color: '#7C3AED' },
  ];
  lanes5R.forEach((l, i) => {
    const ly = TOP + 24 + i * LH5;
    doc.rect(rStart, ly, rWidth, LH5).fill(i % 2 === 0 ? '#F8FAFC' : '#F1F5F9');
    doc.rect(rStart, ly, 50, LH5).fill(l.color);
    doc.save().rotate(-90, { origin: [rStart + 25, ly + LH5 / 2] })
       .fillColor('#fff').font('Helvetica-Bold').fontSize(6.5)
       .text(l.name, rStart + 25 - LH5 / 2, ly + LH5 / 2 - 4,
             { width: LH5, align: 'center', lineBreak: false }).restore();
    if (i > 0)
      doc.moveTo(rStart, ly).lineTo(PW - 20, ly).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  });

  const rry = (r) => TOP + 24 + r * LH5 + LH5 / 2;
  const rby = (r) => rry(r) - lbh / 2;
  const rlc = (r) => lanes5R[r].color;
  const rxs = [rStart + 75, rStart + 185, rStart + 295, rStart + 405];

  flowBox(doc, rxs[0] - lbw/2, rby(0), lbw, lbh, rlc(0), '/messages page', 'MessagesShell component');
  flowBox(doc, rxs[2] - lbw/2, rby(0), lbw, lbh, rlc(0), 'Type + send message', 'Real-time delivery');
  flowBox(doc, rxs[3] - lbw/2, rby(0), lbw, lbh, rlc(0), 'Receive message', 'Realtime subscription');

  flowBox(doc, rxs[0] - lbw/2, rby(1), lbw, lbh, rlc(1), 'getConversations()', 'message-actions.ts');
  flowBox(doc, rxs[2] - lbw/2, rby(1), lbw, lbh, rlc(1), 'sendMessage()', 'INSERT messages row');

  flowBox(doc, rxs[0] - lbw/2, rby(2), lbw, lbh, rlc(2), 'conversations\nmessages tables', 'SELECT with pagination');
  flowBox(doc, rxs[2] - lbw/2, rby(2), lbw, lbh, rlc(2), 'INSERT messages', 'conversation_id\nread_at = null');

  flowBox(doc, rxs[1] - lbw/2, rby(3), lbw, lbh, rlc(3), 'Supabase Realtime', 'Channel subscription');
  flowBox(doc, rxs[3] - lbw/2, rby(3), lbw, lbh, rlc(3), 'Event pushed', 'All subscribers notified');

  drawArrow(doc, rxs[0] + lbw/2, rry(0), rxs[0] - lbw/2, rry(1), '#94A3B8');
  drawArrow(doc, rxs[0], rby(1) + lbh, rxs[0], rby(2), rlc(2));
  drawArrow(doc, rxs[0] + lbw/2, rry(2), rxs[1] - lbw/2, rry(3), rlc(3));
  drawArrow(doc, rxs[1] + lbw/2, rry(3), rxs[2] - lbw/2, rry(0), '#94A3B8', 'display');
  drawArrow(doc, rxs[2] + lbw/2, rry(0), rxs[2] - lbw/2, rry(1), '#94A3B8');
  drawArrow(doc, rxs[2], rby(1) + lbh, rxs[2], rby(2), rlc(2));
  drawArrow(doc, rxs[2] + lbw/2, rry(2), rxs[3] - lbw/2, rry(3), rlc(3));
  drawArrow(doc, rxs[3] + lbw/2, rry(3), rxs[3] - lbw/2, rry(0), '#94A3B8');

  // Divider
  doc.moveTo(halfX - 8, TOP + 4).lineTo(halfX - 8, BOT - 4)
     .lineWidth(1).dash(4, { space: 3 }).strokeColor('#CBD5E1').stroke();
  doc.undash();

  doc.fillColor(C.sub).font('Helvetica').fontSize(7)
     .text('Prayer wall: prayerActions.ts manages INSERT/UPDATE/soft-delete for prayer_requests, reactions (prayer_reactions), and prayer updates. Same notification pattern via notificationHelpers.',
           60, PH - 14, { width: PW - 80 });
}

// ─── Page 6: Admin & Reporting ────────────────────────────────────────────────
function drawAdminPage(doc) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  pageHeader(doc, 'Admin Operations & Reporting', 'Entity Management · Transactions · Users · Homepage Settings · Stripe Payouts', 6);

  const TOP = 46;
  const mx = 25;

  // Draw a grid of operation cards
  function card(x, y, w, h, color, title, items) {
    doc.rect(x, y, w, h).fill(color + '10');
    doc.rect(x, y, w, h).lineWidth(1).stroke(color);
    doc.rect(x, y, w, 18).fill(color);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
       .text(title, x + 6, y + 4, { width: w - 12, lineBreak: false });
    let cy2 = y + 23;
    items.forEach(item => {
      doc.fillColor(C.text).font('Helvetica').fontSize(7.5)
         .text('• ' + item, x + 8, cy2, { width: w - 16 });
      cy2 += 13;
    });
  }

  const CW = (PW - mx * 2 - 15) / 4;
  const rows = [
    {
      y: TOP + 16, h: 160,
      title: 'Data Flow Overview',
      items: null,
      cards: [
        { color: C.admin, title: '👤 Missionaries', items: [
          '/admin/missionaries → list',
          'createMissionary() → auth.admin.createUser()',
          'createPageForEntity() → unique URL slug',
          'sendActivationEmail() → JWT + Gmail',
          'updateMissionaryDetails() → DB update',
          'uploadMissionaryMedia() → storage + page_media',
          'deleteMissionary() → cascade cleanup',
        ]},
        { color: C.social, title: '⛪ Organizations', items: [
          'Churches · Agencies · Colleges',
          'createChurch/Agency/College() actions',
          'Invite to managed org → activation',
          'toggleStatus() → active/inactive',
          'addChurchMissionary() → affiliation',
          'affiliationFollowSync() → auto-follow',
          'getChurchFollowers() → paginated list',
        ]},
        { color: C.email, title: '💳 Transactions', items: [
          '/admin/transactions → getTransactions()',
          'Selects: amount · page · donor · designation',
          'donor_first/last/email from page_donations',
          'TransactionDetailModal: full details',
          'TransactionsPageClient: table + filters',
          'Columns: donor, amount, date, designation',
          'Export-ready with all donor fields',
        ]},
        { color: C.stripe, title: '💰 Stripe Payouts', items: [
          '/settings → Stripe Connect setup',
          'POST /api/stripe-connect/create-account',
          'Creates Express account → onboarding URL',
          'GET /api/stripe-connect/account-status',
          'Syncs payout_status on missionaries',
          'Stripe routes payouts to connected accounts',
          'Dispute/refund events → DB + email',
        ]},
      ]
    },
    {
      y: TOP + 184, h: 160,
      cards: [
        { color: C.data, title: '👥 Users & Donors', items: [
          '/admin/users → user list + status',
          'toggleUserStatus() → active/inactive',
          'deleteUser() → admin.deleteUser()',
          '/admin/donors → donor list',
          'toggleDonorStatus() → enable/disable',
          'donors table: linked to auth.users',
          'Donor details from page_donations fields',
        ]},
        { color: '#7C3AED', title: '🏠 Homepage Settings', items: [
          '/admin/homepage-settings',
          'createBanner() → insert banner row',
          'updateBanner() + uploadBannerImage()',
          'reorderBanners() → display_order',
          'toggleBannerActive() → active flag',
          'updateHomepageSettings() → global config',
          'updateFooterContent() → footer text',
        ]},
        { color: '#0891B2', title: '📩 Message Reports', items: [
          '/admin/message-reports',
          'updateReportStatus() → reviewed/actioned',
          'Reports created when user flags DM',
          'Admin reviews conversation excerpt',
          'Notification sent to reporter on action',
          'message_reports table with status field',
        ]},
        { color: C.services, title: '⚙️ Settings & Misc', items: [
          'updateDonationOptions() → donation_mode',
          'donation_mode controls donate button visibility',
          'submitPageForReview() → status = "pending"',
          'approveMissionaryPage() → status = "approved"',
          'Rate limiting on /api/donate/* (rateLimit.ts)',
          'globalSearch() → across all entity types',
          'mediaCompressionService → image optimization',
        ]},
      ]
    },
  ];

  rows.forEach(row => {
    row.cards.forEach((c, i) => {
      const cx2 = mx + i * (CW + 5);
      card(cx2, row.y, CW, row.h, c.color, c.title, c.items);
    });
  });

  // ── Admin Access Flow ─────────────────────────────────────────────────────
  const fY = TOP + 352;
  doc.rect(mx, fY, PW - mx * 2, 80).fill('#F1F5F9');
  doc.rect(mx, fY, PW - mx * 2, 80).lineWidth(1).stroke('#CBD5E1');
  sectionTitle(doc, mx + 10, fY + 8, 'Admin Authentication & Authorization Flow', C.admin);

  const fx = [100, 230, 380, 530, 680, 840, 1000, 1130];
  const fboxes = [
    { x: fx[0], label: 'Admin opens /admin/*', sub: 'Any admin page', color: C.admin },
    { x: fx[1], label: 'middleware.ts', sub: 'Check auth session', color: C.mw },
    { x: fx[2], label: 'Check users.role', sub: 'role = 1 or 2?', color: C.db },
    { x: fx[3], label: 'Supabase Admin\nclient', sub: 'getSupabaseAdmin()\nservice role key', color: C.data },
    { x: fx[4], label: 'fetchActions.ts\nactions.ts', sub: 'RLS-bypassed queries\nFull data access', color: C.actions },
    { x: fx[5], label: 'Admin Dashboard\nrendered', sub: 'Server component\nSSR data', color: C.admin },
    { x: fx[6], label: 'Unauthorized?', sub: 'role ≠ 1,2 OR\nnot logged in', color: C.mw },
    { x: fx[7], label: '→ Redirect /', sub: 'Public home page', color: C.sub },
  ];
  const fbw = 105, fbh = 40, fby2 = fY + 30;
  fboxes.forEach(b => {
    flowBox(doc, b.x - fbw/2, fby2, fbw, fbh, b.color, b.label, b.sub);
  });
  // Arrow chain 0-5
  for (let i = 0; i < 5; i++) {
    drawArrow(doc, fx[i] + fbw/2, fby2 + fbh/2, fx[i+1] - fbw/2, fby2 + fbh/2, '#94A3B8');
  }
  // Unauthorized branch
  drawArrow(doc, fx[2], fby2 + fbh, fx[6], fby2, '#DC2626', 'no');
  drawArrow(doc, fx[6] + fbw/2, fby2 + fbh/2, fx[7] - fbw/2, fby2 + fbh/2, '#DC2626');

  // ── Legend ────────────────────────────────────────────────────────────────
  const legY = PH - 22;
  doc.fillColor(C.sub).font('Helvetica-Bold').fontSize(7).text('COLOR KEY:', mx, legY);
  let lx = mx + 65;
  [
    ['Client / Browser', C.user],
    ['Server Actions', C.actions],
    ['API Routes', C.api],
    ['Lib Services', C.services],
    ['Supabase DB', C.db],
    ['Stripe', C.stripe],
    ['Email', C.email],
    ['Admin', C.admin],
  ].forEach(([label, color]) => {
    lx = legendChip(doc, lx, legY - 1, label, color);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'h21-business-logic.pdf');
const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: false });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

console.log('Generating Page 1: System Architecture…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawArchPage(doc);

console.log('Generating Page 2: Authentication Flow…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawAuthPage(doc);

console.log('Generating Page 3: Donation Flow…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawDonationPage(doc);

console.log('Generating Page 4: Profile Pages & Content…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawProfilePage(doc);

console.log('Generating Page 5: Social & Messaging…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawSocialPage(doc);

console.log('Generating Page 6: Admin Operations…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawAdminPage(doc);

doc.end();
stream.on('finish', () => {
  const size = fs.statSync(outPath).size;
  console.log('✅ Done → docs/h21-business-logic.pdf (' + (size / 1024).toFixed(1) + ' KB)');
});
stream.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
