'use strict';
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PW = 1190, PH = 842; // A3 landscape

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  // Zone backgrounds + borders
  bwBg: '#EFF6FF', bwBdr: '#2563EB',
  vcBg: '#F8FAFC', vcBdr: '#1E293B',
  spBg: '#E6FDF8', spBdr: '#0D9488',
  exBg: '#FFF7ED', exBdr: '#EA580C',

  // Service box fills
  react  : '#1D4ED8', edge   : '#334155', mw     : '#1E293B',
  ssr    : '#059669', apiBox : '#0891B2', actions: '#7C3AED',
  auth   : '#6D28D9', db     : '#0F766E', storage: '#B45309',
  rtBox  : '#B91C1C', stripe : '#635BFF', gmail  : '#DC2626',
  wistia : '#2563EB', ga4    : '#D97706', flags  : '#374151',
  mailgun: '#F95454',

  // IAM role colors
  guest  : '#94A3B8', supporter: '#2563EB', missionary: '#059669',
  entity : '#D97706', staff  : '#7C3AED', superAdmin: '#DC2626',

  // Env colors
  devCol : '#2563EB', stagCol: '#D97706', prodCol: '#059669',

  text   : '#0F172A', sub: '#64748B', white: '#FFFFFF',
  page   : '#E2E8F0', arrow: '#475569', divLine: '#CBD5E1',
};

// ─── Shared Primitives ────────────────────────────────────────────────────────
function pHeader(doc, title, subtitle, n) {
  doc.rect(0, 0, PW, PH).fill(C.page);
  doc.rect(0, 0, PW, 34).fill('#0F172A');
  doc.fillColor('#F1F5F9').font('Helvetica-Bold').fontSize(13).text(title, 16, 9, { continued: true });
  doc.fillColor('#64748B').font('Helvetica').fontSize(9).text('  —  ' + subtitle);
  doc.fillColor('#475569').font('Helvetica').fontSize(7.5)
     .text(`H21 Architecture · Page ${n} / 3`, PW - 200, 12, { width: 190, align: 'right' });
}

function lbl(doc, x, y, text, size, color, bold) {
  doc.fillColor(color || C.text).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size || 7.5)
     .text(text, x, y, { lineBreak: false });
}

function zone(doc, x, y, w, h, bg, bdr, title) {
  doc.rect(x, y, w, h).fill(bg);
  doc.rect(x, y, w, h).lineWidth(1.5).stroke(bdr);
  doc.rect(x, y, w, 20).fill(bdr);
  lbl(doc, x + 6, y + 5, title, 8, C.white, true);
}

function svcBox(doc, x, y, w, h, color, title, lines) {
  doc.roundedRect(x, y, w, h, 4).fill(color);
  lbl(doc, x + 6, y + 5, title, 7.5, C.white, true);
  let ty = y + 18;
  (lines || []).forEach(l => {
    doc.fillColor('rgba(255,255,255,0.72)').font('Helvetica').fontSize(6)
       .text('· ' + l, x + 6, ty, { width: w - 12, lineBreak: false });
    ty += 10;
  });
}

function subZone(doc, x, y, w, h, color, title) {
  doc.rect(x, y, w, h).fillAndStroke(color + '12', color);
  doc.rect(x, y, w, 16).fill(color);
  lbl(doc, x + 6, y + 4, title, 6.5, C.white, true);
}

function arrow(doc, x1, y1, x2, y2, color, label, bidir) {
  color = color || C.arrow;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const as = 5.5;
  doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(1.3).strokeColor(color).stroke();
  // Forward head
  doc.polygon([x2, y2],
    [x2 - ux * as - uy * as * 0.5, y2 - uy * as + ux * as * 0.5],
    [x2 - ux * as + uy * as * 0.5, y2 - uy * as - ux * as * 0.5]).fill(color);
  // Back head
  if (bidir) {
    doc.polygon([x1, y1],
      [x1 + ux * as - uy * as * 0.5, y1 + uy * as + ux * as * 0.5],
      [x1 + ux * as + uy * as * 0.5, y1 + uy * as - ux * as * 0.5]).fill(color);
  }
  if (label) {
    const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
    const vert = Math.abs(dx) < 4;
    doc.fillColor(color).font('Helvetica').fontSize(5.5)
       .text(label, vert ? lx + 2 : lx - 25, vert ? ly - 4 : ly - 9,
             { width: 52, align: 'center', lineBreak: false });
  }
}

function bentArrow(doc, pts, color, label) {
  color = color || C.arrow;
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
  doc.lineWidth(1.3).strokeColor(color).stroke();
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  const dx = last[0] - prev[0], dy = last[1] - prev[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len, as = 5.5;
  doc.polygon([last[0], last[1]],
    [last[0] - ux * as - uy * as * 0.5, last[1] - uy * as + ux * as * 0.5],
    [last[0] - ux * as + uy * as * 0.5, last[1] - uy * as - ux * as * 0.5]).fill(color);
  if (label) {
    const mx = (pts[0][0] + last[0]) / 2;
    const my = Math.min(...pts.map(p => p[1])) - 7;
    doc.fillColor(color).font('Helvetica').fontSize(5.5)
       .text(label, mx - 26, my, { width: 52, align: 'center', lineBreak: false });
  }
}

function connLabel(doc, x, y, text, color) {
  const tw = doc.widthOfString(text, { size: 5.5 }) + 8;
  doc.roundedRect(x - tw / 2, y - 6, tw, 12, 3).fill(color + '22');
  doc.fillColor(color).font('Helvetica').fontSize(5.5)
     .text(text, x - tw / 2 + 4, y - 3, { lineBreak: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — SYSTEM ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────
function drawArchPage(doc) {
  pHeader(doc, 'H21 Platform — System Architecture', 'Infrastructure topology: Frontend · Backend · Auth · Database · Storage · External APIs', 1);

  // ── Zone geometry ──────────────────────────────────────────────────────────
  const ZY = 40, ZH = 548;               // main tier top/height
  const EY = ZY + ZH + 18, EH = 155;    // external row
  const G = 12;                          // gap between zones
  const BX = 12,  BW = 158;             // Browser  zone
  const VX = BX + BW + G, VW = 462;     // Vercel   zone
  const SX = VX + VW + G, SW = 490;     // Supabase zone  (fills to right margin)

  // ── BROWSER ZONE ──────────────────────────────────────────────────────────
  zone(doc, BX, ZY, BW, ZH, C.bwBg, C.bwBdr, 'BROWSER / CLIENT');

  const bsx = BX + 6, bsw = BW - 12;
  svcBox(doc, bsx, ZY + 24, bsw, 62, C.react, 'React App (Next.js)',
    ['Server + Client components', 'App Router (Next.js 16)', 'TailwindCSS + Radix UI', 'React Query · TipTap editor', 'React Hook Form + Yup']);

  svcBox(doc, bsx, ZY + 92, bsw, 48, '#635BFF', 'Stripe.js Elements',
    ['Credit card input (PCI DSS)', 'stripe.confirmPayment()', 'Client-side only — no card data']);

  svcBox(doc, bsx, ZY + 146, bsw, 36, C.rtBox, 'Supabase Realtime Client',
    ['WebSocket channel listener', 'messages · notifications']);

  svcBox(doc, bsx, ZY + 188, bsw, 26, C.ga4, 'Google Analytics 4',
    ['Client-side events SDK']);

  svcBox(doc, bsx, ZY + 220, bsw, 46, '#54BBFF', 'Wistia Video Player',
    ['Embed player (JS)', 'Video stream via Akamai CDN', 'embed-ssl.wistia.com']);

  svcBox(doc, bsx, ZY + 272, bsw, 36, '#475569', 'Next.js Image / Link',
    ['remotePatterns allowlist', 'supabase.co · wistia.com']);

  svcBox(doc, bsx, ZY + 314, bsw, 46, '#0F172A', 'next.config.ts',
    ['Image remote patterns', 'Server Actions 100MB limit', 'Turbopack · pdfjs external']);

  svcBox(doc, bsx, ZY + 366, bsw, 36, '#374151', 'env-cmd',
    ['.env.develop / .env.local', '.env.staging / .env.prod']);

  // browser security note
  doc.rect(bsx, ZY + 408, bsw, 50).fillAndStroke('#EFF6FF', '#93C5FD');
  lbl(doc, bsx + 4, ZY + 412, 'Security Boundary', 6, C.bwBdr, true);
  doc.fillColor('#1E40AF').font('Helvetica').fontSize(5.5)
     .text('No secret keys in browser\nSTRIPE_PUBLISHABLE (pk_*) only\nAnon key for client Supabase\nAll sensitive ops via server', bsx + 4, ZY + 421, { width: bsw - 8 });

  // ── VERCEL ZONE ───────────────────────────────────────────────────────────
  zone(doc, VX, ZY, VW, ZH, C.vcBg, C.vcBdr, 'VERCEL PLATFORM  (harvest21.com · staging-m2.harvest21.com)');

  // Edge sub-zone
  const ELH = 110;
  subZone(doc, VX + 5, ZY + 24, VW - 10, ELH, '#334155', 'EDGE NETWORK — CDN + Middleware  (runs at Edge runtime before any server code)');

  svcBox(doc, VX + 9, ZY + 44, 180, 82, '#1E293B', 'Vercel CDN / Static Assets',
    ['Public JS/CSS/font bundles', 'Next.js Image Optimization', 'CORS on /_next/image route', 'Static pages (ISR/SSG)']);

  svcBox(doc, VX + 196, ZY + 44, 264, 82, '#334155', 'Edge Middleware  (middleware.ts)',
    ['① Maintenance mode redirect  (Vercel Flags SDK)',
     '② CORS — OPTIONS preflight  (allowlist: harvest21.com, staging, localhost)',
     '③ Auth session refresh  supabase.auth.getClaims() · HTTP-only cookies',
     '④ Route guards  /admin → role check · unauthenticated → redirect /']);

  // Application sub-zone
  const ALY = ZY + ELH + 30;
  const ALH = ZH - ELH - 35;
  subZone(doc, VX + 5, ALY, VW - 10, ALH, '#065F46', 'APPLICATION LAYER — Next.js Serverless Functions');

  // SSR + Actions column
  const ssrW = 210, ssrX = VX + 9;
  svcBox(doc, ssrX, ALY + 20, ssrW, 70, C.ssr, 'Next.js SSR Pages  (app/ router)',
    ['30+ page routes', '/ · /missionaries · /[page_url]', '/donate · /settings · /messages', '/admin/* (role-gated)']);

  svcBox(doc, ssrX, ALY + 96, ssrW, 70, C.actions, 'Server Actions  (actions.ts files)',
    ['~15 actions.ts modules', 'Admin CRUD · Settings · Social', 'Donations · Messaging · Media', 'Run server-side — no HTTP overhead']);

  svcBox(doc, ssrX, ALY + 172, ssrW, 52, '#0F766E', 'lib/ Business Services',
    ['donationHelpers · stripeHelpers', 'notificationHelpers · pageHelpers', 'gmailMailerService · tokenHelpers', 'wistiaService · fileUploadHelpers']);

  svcBox(doc, ssrX, ALY + 230, ssrW, 42, '#7C3AED', 'Rate Limiter  (lib/rateLimit.ts)',
    ['In-memory IP counter', '10 req / 60s on /api/donate/*', 'Returns HTTP 429']);

  // API Routes column
  const apiX = ssrX + ssrW + 6, apiW = VW - ssrW - 21;
  svcBox(doc, apiX, ALY + 20, apiW, 58, C.apiBox, 'Auth API  /api/auth/*',
    ['POST signin — email+pw · status check · sign out on inactive',
     'POST signup-supporter · POST signout',
     'POST activate-account · POST send-activation-email · POST send-reset-email']);

  svcBox(doc, apiX, ALY + 84, apiW, 48, '#635BFF', 'Payments API  /api/donate/*  /api/stripe-connect/*',
    ['POST create-payment-intent — rate limited, email validated',
     'Stripe PaymentIntent / Subscription with metadata',
     'POST create-account (Stripe Connect) · GET account-status']);

  svcBox(doc, apiX, ALY + 138, apiW, 38, '#B91C1C', 'Stripe Webhook  /api/webhooks/stripe',
    ['HMAC signature verify (stripe.webhooks.constructEvent)',
     'payment_intent.succeeded · invoice.paid · customer.subscription.deleted']);

  svcBox(doc, apiX, ALY + 182, apiW, 38, '#0891B2', 'Media API  /api/page-media · /api/storage · /api/photos · /api/videos',
    ['Signed upload URLs (UUID-prefixed filenames)',
     'fileName sanitization: /[^a-zA-Z0-9.-]/g → "_"']);

  svcBox(doc, apiX, ALY + 226, apiW, 48, '#54BBFF', 'Wistia API  /api/wistia/*',
    ['token · upload · upload-credentials · folders · move-video',
     'OAuth: /api/wistia/callback — code exchange → token storage',
     'Config · Projects · Delete endpoints']);

  svcBox(doc, apiX, ALY + 280, apiW, 28, '#374151', 'Misc APIs',
    ['contact · user-profile · get-page-id · check-unpublished-owner · missionaries/[id]/followers/*']);

  // ── SUPABASE ZONE ─────────────────────────────────────────────────────────
  zone(doc, SX, ZY, SW, ZH, C.spBg, C.spBdr, 'SUPABASE PLATFORM  (kstznftkyihjchkfkcah.supabase.co)');

  const spx = SX + 5, sp2w = (SW - 15) / 2;
  const spgap = 6;

  // Auth
  svcBox(doc, spx, ZY + 24, SW - 10, 78, C.auth, 'Auth Service  (@supabase/ssr)',
    ['JWT sessions — signed Supabase tokens', 'HTTP-only cookies (path=/ · sameSite=lax · secure in prod)',
     'supabase.auth.getClaims() on every request (middleware)', 'supabase.auth.getUser() for admin routes',
     'Custom JWT (jose HS256) for invitations — 72h expiry, type="activation" field',
     'Password reset via admin.generateLink() + Gmail email']);

  // Database
  svcBox(doc, spx, ZY + 108, SW - 10, 100, C.db, 'PostgreSQL Database  (30+ tables, 8 domains)',
    ['Row Level Security (RLS) enabled on all tables',
     'Domains: Auth/Identity · Organizations · Donations · Content · Social · Messaging · Admin · Settings',
     'Key tables: missionaries · churches · agencies · pages · page_donations · donors · follow_requests',
     '           prayer_requests · conversations · messages · notifications · page_media · page_widgets',
     'Service role key bypasses RLS for privileged server ops (webhooks, admin actions)',
     'Anon key used for client/SSR — RLS policies enforced via auth.uid()']);

  // Storage
  svcBox(doc, spx, ZY + 214, SW - 10, 70, C.storage, 'Storage  (h21-dev bucket)',
    ['File types: profile photos · banners · PDFs · video thumbnails',
     'Access: public URLs (images) + signed upload URLs (writes)',
     'File path: /{entity_type}/{entity_id}/{folder}/{uuid}-{sanitized_name}',
     'Wistia handles large video — Supabase storage for images/docs only']);

  // Realtime
  svcBox(doc, spx, ZY + 290, SW - 10, 58, C.rtBox, 'Realtime  (WebSocket pub/sub)',
    ['Channels: messages table, notifications table',
     'Browser subscribes via supabase.channel() — direct WS to Supabase (NOT via Vercel)',
     'Used for: DM delivery · unread badge updates']);

  // RLS policies summary
  doc.rect(spx, ZY + 354, SW - 10, 80).fillAndStroke('#F0FDFA', '#0D9488');
  lbl(doc, spx + 5, ZY + 358, 'Key RLS Policies', 7, C.spBdr, true);
  const rls = [
    ['missionary_followers', 'INSERT: auth.uid()=user_id · UPDATE: owner or admin role'],
    ['messages / conversations', 'SELECT: only conversation participants can read'],
    ['users', 'SELECT: any authenticated · UPDATE: admin role only'],
    ['page_donations', 'INSERT/SELECT: service role (webhook, server actions)'],
    ['pages', 'SELECT: public · INSERT/UPDATE: owner or service role'],
  ];
  rls.forEach((r, i) => {
    doc.fillColor('#0F766E').font('Helvetica-Bold').fontSize(5.5)
       .text(r[0], spx + 5, ZY + 371 + i * 12, { lineBreak: false });
    doc.fillColor('#374151').font('Helvetica').fontSize(5.5)
       .text(r[1], spx + 5 + doc.widthOfString(r[0] + '  ', { size: 5.5 }), ZY + 371 + i * 12, { lineBreak: false });
  });

  // Supabase functions note
  svcBox(doc, spx, ZY + 440, SW - 10, 50, '#475569', 'Supabase Edge Functions  (supabase/functions/)',
    ['fetch_missionaries_overview · fetch_missionary_pages_by_region · get_profile',
     'Called from lib/ server utilities for heavy data queries',
     'Run in Deno runtime on Supabase infrastructure']);

  // ── EXTERNAL SERVICES ROW (below Vercel + Supabase) ──────────────────────
  const extW = (VW + G + SW);  // span across both Vercel + Supabase
  zone(doc, VX, EY, extW, EH, C.exBg, C.exBdr, 'EXTERNAL SERVICES  (called from Vercel server-side only — never exposed to browser)');

  const exSvcW = Math.floor((extW - 18) / 5) - 4;
  const exSvcY = EY + 24;
  const exSvcH = EH - 30;

  svcBox(doc, VX + 6,                     exSvcY, exSvcW, exSvcH, C.stripe, 'Stripe',
    ['Node.js SDK (server-only)', 'PaymentIntents (one-time)', 'Subscriptions (monthly)', 'Connect Express accounts', 'Webhooks → /api/webhooks/stripe', 'Refunds · Disputes handling', 'Idempotency keys on PI create', 'Mode: TEST (pk_test_ / sk_test_)']);

  svcBox(doc, VX + 6 + (exSvcW + 5),     exSvcY, exSvcW, exSvcH, C.gmail, 'Gmail / Nodemailer',
    ['gmailMailerService.ts', 'Auth: App Password (SMTP)', 'Emails: activation · reset', 'Donation receipts', 'Missionary notifications', 'Contact form replies', 'From: no-reply@harvest21.com', 'Mailgun configured (env) — not yet active']);

  svcBox(doc, VX + 6 + (exSvcW + 5) * 2, exSvcY, exSvcW, exSvcH, '#2563EB', 'Wistia Video',
    ['OAuth 2.0 token exchange', '/api/wistia/callback route', 'Video upload (server proxy)', 'Project/folder management', 'Delivery: Akamai CDN', 'Domains: embed-ssl.wistia.com', '        fast.wistia.com', 'Player: Browser ↔ Akamai direct']);

  svcBox(doc, VX + 6 + (exSvcW + 5) * 3, exSvcY, exSvcW, exSvcH, C.ga4, 'Google Analytics 4',
    ['Client-side SDK', 'GoogleAnalytics component', 'Page view tracking', 'No server-side events', '(analytics.tsx in components/)']);

  svcBox(doc, VX + 6 + (exSvcW + 5) * 4, exSvcY, exSvcW, exSvcH, '#0F172A', 'Vercel Flags SDK',
    ['@flags-sdk/vercel adapter', 'flags.ts: maintenanceMode flag', 'Evaluated at Edge runtime', 'Blocks all routes when ON', '→ redirects to /maintenance', 'FLAGS_SECRET · FLAGS env keys']);

  // ── CONNECTION ARROWS ─────────────────────────────────────────────────────
  const bRight = BX + BW;    // 170
  const vLeft  = VX;         // 182
  const vRight = VX + VW;    // 644
  const sLeft  = SX;         // 656
  const vBottom = ZY + ZH;   // main tier bottom
  const eTop  = EY;          // external tier top

  // Browser ↔ Vercel Edge — page requests
  arrow(doc, bRight, ZY + 60, vLeft, ZY + 60, C.bwBdr, 'HTTPS req', true);
  connLabel(doc, (bRight + vLeft) / 2, ZY + 56, 'HTTPS · Next.js', C.bwBdr);

  // Browser ↔ Vercel — React hydration + Server Actions
  arrow(doc, bRight, ZY + 130, vLeft, ZY + 130, '#059669', '', true);
  connLabel(doc, (bRight + vLeft) / 2, ZY + 126, 'RSC · Server Actions', '#059669');

  // Browser ↔ Vercel — Stripe Elements
  arrow(doc, bRight, ZY + 108, vLeft + 196, ZY + 108, '#635BFF', '', false);
  connLabel(doc, bRight + 20, ZY + 104, 'clientSecret', '#635BFF');

  // Vercel ↔ Supabase — Auth JWT
  arrow(doc, vRight, ZY + 75, sLeft, ZY + 75, C.auth, '', true);
  connLabel(doc, (vRight + sLeft) / 2, ZY + 70, 'JWT verify / getClaims()', C.auth);

  // Vercel ↔ Supabase — DB queries
  arrow(doc, vRight, ZY + 200, sLeft, ZY + 200, C.db, '', true);
  connLabel(doc, (vRight + sLeft) / 2, ZY + 195, 'PostgREST API (anon + service role)', C.db);

  // Vercel ↔ Supabase — Storage
  arrow(doc, vRight, ZY + 340, sLeft, ZY + 340, C.storage, '', true);
  connLabel(doc, (vRight + sLeft) / 2, ZY + 335, 'Storage REST API (signed URL)', C.storage);

  // Browser → Supabase — Realtime (bent arrow going below zones)
  bentArrow(doc, [
    [BX + BW / 2, ZY + ZH + 4],
    [BX + BW / 2, ZY + ZH + 12],
    [SX + SW / 2, ZY + ZH + 12],
    [SX + SW / 2, ZY + ZH + 4],
  ], C.rtBox, 'WebSocket (Realtime — direct browser → Supabase, bypasses Vercel)');

  // Vercel → External (vertical arrows)
  const extMidX = VX + 6 + exSvcW / 2;
  const extMidXGmail = VX + 6 + (exSvcW + 5) + exSvcW / 2;
  const extMidXWistia = VX + 6 + (exSvcW + 5) * 2 + exSvcW / 2;

  arrow(doc, extMidX, vBottom, extMidX, eTop, C.stripe, 'Stripe Node.js SDK', false);
  arrow(doc, extMidXGmail, vBottom, extMidXGmail, eTop, C.gmail, 'Nodemailer SMTP', false);
  arrow(doc, extMidXWistia, vBottom, extMidXWistia, eTop, '#2563EB', 'Wistia REST API', false);

  // Stripe → Vercel webhook (reverse arrow, offset)
  arrow(doc, extMidX + 10, eTop, extMidX + 10, vBottom, '#DC2626', 'Webhook (HMAC signed)', false);

  // ── LEGEND ────────────────────────────────────────────────────────────────
  const LY = EY + EH + 6;
  lbl(doc, VX, LY + 2, 'Connection legend:', 6.5, C.sub, true);
  const legendItems = [
    ['↔ HTTPS · RSC · Server Actions', C.bwBdr],
    ['↔ JWT auth / DB queries (PostgREST)', C.auth],
    ['↔ Storage API (signed URL)', C.storage],
    ['⇣ Stripe/Gmail/Wistia API calls', C.stripe],
    ['⇡ Stripe Webhook (HMAC verified)', '#DC2626'],
    ['↔ WebSocket Realtime (direct)', C.rtBox],
  ];
  let lx = VX + 110;
  legendItems.forEach(([t, c]) => {
    doc.circle(lx, LY + 6, 3).fill(c);
    lbl(doc, lx + 6, LY + 2, t, 6, c);
    lx += doc.widthOfString(t, { size: 6 }) + 20;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — IAM & ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────
function drawIAMPage(doc) {
  pHeader(doc, 'H21 Platform — IAM & Access Control', 'User roles · Permission model · Session lifecycle · Token types · RLS enforcement', 2);

  const TOP = 40;

  // ── LEFT: Role hierarchy ──────────────────────────────────────────────────
  lbl(doc, 14, TOP + 4, 'USER ROLE HIERARCHY', 8, C.sub, true);
  doc.moveTo(14, TOP + 16).lineTo(14 + 260, TOP + 16).lineWidth(0.5).strokeColor(C.divLine).stroke();

  const roles = [
    { label: 'SUPER ADMIN  (role = 1)', color: C.superAdmin, y: TOP + 24,
      lines: ['Full platform access', 'Bypass all RLS via service role', 'Manage missionaries/orgs/users', 'View all transactions', 'Admin dashboard + settings'] },
    { label: 'STAFF ADMIN  (role = 2)', color: C.staff, y: TOP + 104,
      lines: ['Admin dashboard access', 'Manage entities & users', 'Approve pages · review reports', 'View donations + analytics'] },
    { label: 'MISSIONARY', color: C.missionary, y: TOP + 178,
      lines: ['Own public profile page', 'Manage media, widgets, content', 'Approve/reject follow requests', 'Receive donations · view receipts', 'Enable Stripe Connect payout', 'Send/receive DMs'] },
    { label: 'CHURCH / AGENCY / COLLEGE REP', color: C.entity, y: TOP + 274,
      lines: ['Manage own organization page', 'View affiliated missionaries', 'Send/receive DMs'] },
    { label: 'SUPPORTER / DONOR', color: C.supporter, y: TOP + 338,
      lines: ['Follow missionaries (requires approval)', 'Send donations (one-time or monthly)', 'Send DMs to missionaries', 'View own donation history', 'Cancel recurring donations'] },
    { label: 'GUEST  (unauthenticated)', color: C.guest, y: TOP + 402,
      lines: ['View public missionary profiles', 'View public church/agency pages', 'Browse missionaries by region', 'Make one-time donations (no login required)', 'Cannot follow, DM, or view settings'] },
  ];

  const rw = 268;
  roles.forEach(r => {
    const h = 14 + r.lines.length * 12 + 6;
    doc.roundedRect(14, r.y, rw, h, 4).fill(r.color);
    lbl(doc, 20, r.y + 5, r.label, 7.5, C.white, true);
    r.lines.forEach((l, i) => {
      doc.fillColor('rgba(255,255,255,0.78)').font('Helvetica').fontSize(6)
         .text('• ' + l, 20, r.y + 18 + i * 12, { width: rw - 12, lineBreak: false });
    });
    // Downward chevron
    if (r.y < TOP + 402) {
      lbl(doc, 14 + rw / 2 - 4, r.y + h + 1, '▼', 7, r.color);
    }
  });

  // ── CENTER: Permission Matrix ──────────────────────────────────────────────
  const MX = 298, MW = 540;
  lbl(doc, MX, TOP + 4, 'PERMISSION MATRIX', 8, C.sub, true);
  doc.moveTo(MX, TOP + 16).lineTo(MX + MW, TOP + 16).lineWidth(0.5).strokeColor(C.divLine).stroke();

  const colW = [175, 58, 58, 68, 58, 68, 55]; // action | guest | supporter | missionary | entity | admin | superAdmin
  const colHeaders = ['Action / Resource', 'Guest', 'Supporter', 'Missionary', 'Org Rep', 'Admin', 'Super Admin'];
  const colColors = [C.text, C.guest, C.supporter, C.missionary, C.entity, C.staff, C.superAdmin];
  let cx = MX;
  let hy = TOP + 22;

  // Header
  colHeaders.forEach((h, i) => {
    doc.rect(cx, hy, colW[i], 18).fill(colColors[i]);
    lbl(doc, cx + 3, hy + 5, h, i === 0 ? 6.5 : 6, C.white, true);
    cx += colW[i];
  });
  hy += 18;

  const Y = '✓', N = '✗', O = '◐', A = 'own';
  const permRows = [
    ['View public missionary profiles', Y, Y, Y, Y, Y, Y],
    ['View public org pages', Y, Y, Y, Y, Y, Y],
    ['Browse missionaries by region', Y, Y, Y, Y, Y, Y],
    ['One-time donation (no login)', Y, Y, Y, Y, Y, Y],
    ['Monthly recurring donation', N, Y, Y, N, Y, Y],
    ['Follow a missionary (w/ approval)', N, Y, N, N, Y, Y],
    ['Send direct messages', N, Y, Y, Y, Y, Y],
    ['View own donation history', N, Y, Y, N, Y, Y],
    ['Cancel own recurring donation', N, Y, N, N, Y, Y],
    ['Create/edit own profile page', N, N, A, A, Y, Y],
    ['Submit page for review', N, N, A, A, N, Y],
    ['Approve/reject page review', N, N, N, N, Y, Y],
    ['Manage media + widgets', N, N, A, A, Y, Y],
    ['Approve follower requests', N, N, A, N, Y, Y],
    ['Enable Stripe Connect payout', N, N, A, N, N, Y],
    ['View all donations', N, N, N, N, Y, Y],
    ['Manage all users / missionaries', N, N, N, N, Y, Y],
    ['Admin dashboard access', N, N, N, N, Y, Y],
    ['Bypass RLS (service role)', N, N, N, N, N, Y],
    ['Homepage + footer settings', N, N, N, N, Y, Y],
    ['Feature flag management', N, N, N, N, N, Y],
  ];

  permRows.forEach((row, ri) => {
    const [action, ...vals] = row;
    const rowBg = ri % 2 === 0 ? '#F8FAFC' : C.white;
    cx = MX;
    doc.rect(cx, hy, colW.reduce((a, b) => a + b, 0), 15).fill(rowBg);
    doc.moveTo(cx, hy + 15).lineTo(cx + MW, hy + 15).lineWidth(0.3).strokeColor(C.divLine).stroke();
    lbl(doc, cx + 3, hy + 4, action, 6, C.text);
    cx += colW[0];
    vals.forEach((v, i) => {
      const color = v === Y ? C.missionary : v === N ? '#DC2626' : v === O ? C.entity : C.supporter;
      lbl(doc, cx + colW[i + 1] / 2 - 4, hy + 4, v, 7.5, color, v !== N);
      cx += colW[i + 1];
    });
    hy += 15;
  });

  // ── RIGHT: Session & Token lifecycle ─────────────────────────────────────
  const RX = MX + MW + 12, RW = PW - RX - 14;
  lbl(doc, RX, TOP + 4, 'SESSION & TOKEN LIFECYCLE', 8, C.sub, true);
  doc.moveTo(RX, TOP + 16).lineTo(RX + RW, TOP + 16).lineWidth(0.5).strokeColor(C.divLine).stroke();

  function tokenCard(x, y, w, h, color, title, lines) {
    doc.roundedRect(x, y, w, h, 4).fill(color + '18');
    doc.roundedRect(x, y, w, h, 4).lineWidth(1).stroke(color);
    doc.rect(x, y, w, 16).fill(color);
    lbl(doc, x + 5, y + 4, title, 7, C.white, true);
    lines.forEach((l, i) => {
      lbl(doc, x + 5, y + 20 + i * 11, l, 6, C.text);
    });
  }

  let ty = TOP + 24;
  const tw = RW - 4;

  tokenCard(RX, ty, tw, 72, C.auth, 'Supabase Session JWT  (@supabase/ssr)',
    ['Issued by: Supabase Auth on signInWithPassword()', 'Stored in: HTTP-only cookie (secure, sameSite=lax)', 'Refreshed by: supabase.auth.getClaims() on every request', 'Claims: user_id, email, role, iat, exp', 'Validated by: middleware → updateSession()']); ty += 78;

  tokenCard(RX, ty, tw, 66, '#7C3AED', 'Custom Activation JWT  (jose / HS256)',
    ['Issued by: POST /api/send-activation-email', 'Algorithm: HS256 signed with JWT_SECRET env var', 'Expiry: 72 hours', 'Claims: { userId, email, type:"activation" }', 'Used once: POST /api/activate-account then discarded']); ty += 72;

  tokenCard(RX, ty, tw, 50, C.db, 'Supabase Service Role Key  (server-only)',
    ['Used by: getSupabaseAdmin() — server-side only', 'Bypasses RLS — all tables accessible', 'Used for: webhooks, admin actions, onboarding ops', 'Never sent to browser / never in NEXT_PUBLIC_ vars']); ty += 56;

  tokenCard(RX, ty, tw, 44, C.stripe, 'Stripe Webhook Signature  (HMAC-SHA256)',
    ['Every webhook verified: stripe.webhooks.constructEvent()', 'Secret: STRIPE_WEBHOOK_SECRET env var', 'Missing/invalid signature → 400 rejection immediately']); ty += 50;

  tokenCard(RX, ty, tw, 38, '#EA580C', 'Stripe API Keys  (server-only)',
    ['STRIPE_SECRET_KEY (sk_*) — server only, Stripe SDK init', 'STRIPE_PUBLISHABLE_KEY (pk_*) — browser, Stripe.js Elements']); ty += 44;

  tokenCard(RX, ty, tw, 44, '#0F172A', 'Feature Flag Auth  (Vercel Flags SDK)',
    ['FLAGS_SECRET: HMAC for flag override requests', 'FLAGS: server token for Vercel Toolbar', 'maintenanceMode flag evaluated at Edge — kills all routes']); ty += 50;

  // Admin auth flow box
  doc.rect(RX, ty, tw, 88).fillAndStroke('#FFF1F2', '#DC2626');
  lbl(doc, RX + 5, ty + 5, 'Admin Authentication Flow  (/admin/* routes)', 7, '#DC2626', true);
  doc.fillColor(C.text).font('Helvetica').fontSize(6.5)
     .text(
       '1. Request hits Edge Middleware\n' +
       '2. supabase.auth.getClaims() — checks JWT cookie\n' +
       '3. If no user → redirect to /\n' +
       '4. If user present → supabase.auth.getUser() (full user fetch)\n' +
       '5. Query users table: SELECT role WHERE user_id = auth.uid()\n' +
       '6. If role ≠ 1 or 2 → redirect to /\n' +
       '7. Passes request to Next.js admin page / server action\n' +
       '8. Admin pages use getSupabaseAdmin() → service role → RLS bypassed',
       RX + 5, ty + 18, { width: tw - 10 });

  ty += 96;
  tokenCard(RX, ty, tw, 32, '#94A3B8', 'Account Status Guard  (POST /api/auth/signin)',
    ['After Supabase auth → query users.status field', 'status = "Inactive" → signOut() immediately → return 403 + accountDisabled:true']);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — ENVIRONMENTS & DEPLOYMENT PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
function drawEnvPage(doc) {
  pHeader(doc, 'H21 Platform — Environments & Deployment', 'Dev · Staging · Production · CI/CD pre-push pipeline · Key inventory · Security posture', 3);

  const TOP = 40;

  // ── ENVIRONMENT COLUMNS ───────────────────────────────────────────────────
  lbl(doc, 14, TOP + 4, 'ENVIRONMENT CONFIGURATIONS', 8, C.sub, true);
  doc.moveTo(14, TOP + 16).lineTo(PW - 14, TOP + 16).lineWidth(0.5).strokeColor(C.divLine).stroke();

  const envW = (PW - 28 - 24) / 3;
  const envData = [
    {
      label: 'DEVELOPMENT', color: C.devCol,
      cmd: 'npm run dev  (env-cmd -f .env.develop)',
      url: 'http://localhost:3000',
      supabase: 'kstznftkyihjchkfkcah.supabase.co',
      stripe: 'TEST mode  (pk_test_ / sk_test_)',
      email: 'Gmail — no-reply@harvest21.com',
      flags: 'FLAGS + FLAGS_SECRET env keys',
      envFile: '.env.develop',
      notes: ['Hot reload (Turbopack)', 'RLS still enforced', 'Stripe test cards only', 'Dev Supabase project'],
    },
    {
      label: 'STAGING', color: C.stagCol,
      cmd: 'npm run dev:staging  (env-cmd -f .env.staging)',
      url: 'https://staging-m2.harvest21.com',
      supabase: 'Separate Supabase project',
      stripe: 'TEST mode (staging Stripe keys)',
      email: 'Gmail or Mailgun (mg.harvest21.com)',
      flags: 'Vercel Flags SDK — staging project',
      envFile: '.env.staging',
      notes: ['CORS allowlist includes staging domain', 'Pre-push hook runs here', 'Full build + type check required', 'Test webhooks via Stripe CLI'],
    },
    {
      label: 'PRODUCTION', color: C.prodCol,
      cmd: 'npm run build:prod  (env-cmd -f .env.prod)',
      url: 'https://harvest21.com',
      supabase: 'tuoqghemdpiimyrkjzrf.supabase.co',
      stripe: 'LIVE mode  (pk_live_ / sk_live_)',
      email: 'Gmail — no-reply@harvest21.com',
      flags: 'Vercel Flags SDK — production',
      envFile: '.env.prod  (not committed)',
      notes: ['HTTPS-only cookies (secure:true)', 'Live Stripe payments', 'Production Supabase + RLS', 'Real webhook secret'],
    },
  ];

  const EY2 = TOP + 22;
  const EH2 = 258;
  envData.forEach((e, i) => {
    const ex = 14 + i * (envW + 8);
    doc.roundedRect(ex, EY2, envW, EH2, 5).fill(e.color + '10');
    doc.roundedRect(ex, EY2, envW, EH2, 5).lineWidth(1.5).stroke(e.color);
    doc.rect(ex, EY2, envW, 22).fill(e.color);
    lbl(doc, ex + 8, EY2 + 6, e.label, 9, C.white, true);

    let ey = EY2 + 28;
    const rows = [
      ['npm script', e.cmd], ['URL', e.url], ['Supabase', e.supabase],
      ['Stripe', e.stripe], ['Email', e.email], ['Flags', e.flags], ['Env file', e.envFile],
    ];
    rows.forEach(([k, v]) => {
      lbl(doc, ex + 6, ey, k + ':', 6, e.color, true);
      const kw = doc.widthOfString(k + ':  ', { size: 6 });
      doc.fillColor(C.text).font('Helvetica').fontSize(6)
         .text(v, ex + 6 + kw, ey, { width: envW - kw - 12, lineBreak: false });
      ey += 12;
    });
    ey += 4;
    doc.moveTo(ex + 6, ey).lineTo(ex + envW - 6, ey).lineWidth(0.3).strokeColor(C.divLine).stroke();
    ey += 6;
    e.notes.forEach(n => {
      doc.circle(ex + 11, ey + 3, 2).fill(e.color);
      lbl(doc, ex + 16, ey, n, 6.5, C.text);
      ey += 11;
    });
  });

  // ── PRE-PUSH PIPELINE ─────────────────────────────────────────────────────
  const PY = EY2 + EH2 + 14;
  lbl(doc, 14, PY, 'CI / CD — PRE-PUSH VALIDATION PIPELINE  (.husky/pre-push)', 8, C.sub, true);
  doc.moveTo(14, PY + 12).lineTo(PW - 14, PY + 12).lineWidth(0.5).strokeColor(C.divLine).stroke();

  const stepY = PY + 18;
  const steps = [
    { label: 'git push', sub: 'developer runs\ngit push origin branch', color: '#0F172A', w: 95 },
    { label: 'Husky hook\ntriggers', sub: '.husky/pre-push\nexecutes', color: '#374151', w: 95 },
    { label: 'TypeScript Check\nnpm run type-check', sub: 'tsc --noEmit\nacross entire codebase', color: C.devCol, w: 130 },
    { label: 'Production Build\nnpm run build', sub: 'next build\nfull build validation', color: '#059669', w: 130 },
    { label: '✓ Push Allowed', sub: 'git push completes\nbranch updated', color: '#059669', w: 110 },
  ];

  let sx = 14;
  steps.forEach((s, i) => {
    const sh = 56;
    doc.roundedRect(sx, stepY, s.w, sh, 4).fill(s.color);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
       .text(s.label, sx + 5, stepY + 6, { width: s.w - 10 });
    doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(5.5)
       .text(s.sub, sx + 5, stepY + 30, { width: s.w - 10 });
    if (i < steps.length - 1) {
      arrow(doc, sx + s.w + 1, stepY + sh / 2, sx + s.w + 9, stepY + sh / 2, C.arrow, '', false);
    }
    sx += s.w + 14;
  });

  // Failure paths
  const failY = stepY + 70;
  const failItems = [
    { x: 14 + 95 + 14 + 95 + 14, label: 'TS Error → Push Blocked', color: '#DC2626',
      desc: 'TypeScript type error found → "Please fix type errors before pushing" → exit 1' },
    { x: 14 + 95 + 14 + 95 + 14 + 130 + 14, label: 'Build Error → Push Blocked', color: '#DC2626',
      desc: 'Next.js build fails (missing pages, import errors) → "Please fix build errors" → exit 1' },
  ];
  failItems.forEach(f => {
    arrow(doc, f.x + 65, stepY + 56, f.x + 65, failY, '#DC2626', '', false);
    doc.roundedRect(f.x, failY, 244, 32, 4).fill('#FFF1F2');
    doc.roundedRect(f.x, failY, 244, 32, 4).lineWidth(1).stroke('#DC2626');
    lbl(doc, f.x + 5, failY + 5, f.label, 7, '#DC2626', true);
    lbl(doc, f.x + 5, failY + 17, f.desc, 5.5, C.text);
  });

  // ── ENVIRONMENT VARIABLES INVENTORY ──────────────────────────────────────
  const VIY = failY + 50;
  lbl(doc, 14, VIY, 'ENVIRONMENT VARIABLES INVENTORY', 8, C.sub, true);
  doc.moveTo(14, VIY + 12).lineTo(PW - 14, VIY + 12).lineWidth(0.5).strokeColor(C.divLine).stroke();

  const varCols = Math.floor((PW - 28) / 4);
  const varGroups = [
    { title: 'Supabase', color: C.spBdr, vars: [
      ['NEXT_PUBLIC_SUPABASE_URL', 'public', 'PostgREST + Storage API base URL'],
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public', 'Client-side RLS-enforced access'],
      ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public', 'New-style publishable key'],
      ['SUPABASE_SERVICE_ROLE_KEY', 'secret', 'Bypasses RLS — server-only'],
    ]},
    { title: 'Stripe', color: C.stripe, vars: [
      ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'public', 'Browser — Stripe.js Elements only'],
      ['STRIPE_SECRET_KEY', 'secret', 'Server SDK — create PIs, subs'],
      ['STRIPE_WEBHOOK_SECRET', 'secret', 'Verify incoming webhook signatures'],
    ]},
    { title: 'Auth & Security', color: C.auth, vars: [
      ['JWT_SECRET', 'secret', 'Sign activation tokens (HS256)'],
      ['FLAGS_SECRET', 'secret', 'Vercel feature flag HMAC'],
      ['FLAGS', 'secret', 'Vercel Flags server token'],
    ]},
    { title: 'Email', color: C.gmail, vars: [
      ['GMAIL_USER', 'secret', 'no-reply@harvest21.com'],
      ['GMAIL_APP_PASSWORD', 'secret', 'Google App Password (SMTP)'],
      ['MAILGUN_API_KEY', 'secret', 'Mailgun API (configured, not active)'],
      ['MAILGUN_DOMAIN', 'config', 'mg.harvest21.com'],
      ['MAILGUN_EMAIL_NO_REPLY', 'config', 'noreply@mg.harvest21.com'],
    ]},
  ];

  varGroups.forEach((g, gi) => {
    const gx = 14 + gi * (varCols + 4);
    let vy = VIY + 18;
    doc.rect(gx, vy - 2, varCols, 16).fill(g.color);
    lbl(doc, gx + 4, vy + 2, g.title + ' Variables', 7, C.white, true);
    vy += 18;
    g.vars.forEach(([name, type, desc]) => {
      const tc = type === 'public' ? '#059669' : type === 'secret' ? '#DC2626' : '#D97706';
      const bg = vy % 2 === 0 ? '#F8FAFC' : C.white;
      doc.rect(gx, vy - 1, varCols, 26).fill(bg);
      doc.moveTo(gx, vy + 25).lineTo(gx + varCols, vy + 25).lineWidth(0.3).strokeColor(C.divLine).stroke();
      lbl(doc, gx + 4, vy + 2, name, 5.5, C.text, true);
      const tw2 = doc.widthOfString(type, { size: 5.5 }) + 6;
      doc.roundedRect(gx + varCols - tw2 - 3, vy + 1, tw2, 10, 2).fill(tc + '20');
      lbl(doc, gx + varCols - tw2, vy + 2, type, 5.5, tc, true);
      lbl(doc, gx + 4, vy + 14, desc, 5.5, C.sub);
      vy += 28;
    });
  });

  // ── SECURITY POSTURE SUMMARY ──────────────────────────────────────────────
  const SPY = VIY + 200;
  lbl(doc, 14, SPY, 'SECURITY POSTURE SUMMARY', 8, C.sub, true);
  doc.moveTo(14, SPY + 12).lineTo(PW - 14, SPY + 12).lineWidth(0.5).strokeColor(C.divLine).stroke();

  const spcols = [
    { title: 'TRANSPORT', color: '#0891B2', items: [
      'HTTPS everywhere (Vercel enforced)',
      'HTTP-only cookies (JS cannot read)',
      'secure flag on all cookies in prod',
      'CORS allowlist (not wildcard on API)',
      'HMAC signature on all Stripe webhooks',
    ]},
    { title: 'AUTHENTICATION', color: C.auth, items: [
      'Supabase Auth — JWT sessions',
      'Custom JWT for invitations (HS256)',
      'Account status checked on every login',
      'Admin role checked on every /admin/* request',
      'No secrets in NEXT_PUBLIC_ variables (except pub keys)',
    ]},
    { title: 'DATA', color: C.db, items: [
      'Row Level Security on all tables',
      'Service role key: server-only usage',
      'Parameterized queries via PostgREST',
      'File names sanitized before storage',
      'HTML escaped before email insertion',
    ]},
    { title: 'KNOWN GAPS', color: '#DC2626', items: [
      'Rate limiter: in-memory (resets on restart)',
      'storage/signed-upload: no auth check',
      'JWT_SECRET fallback to hardcoded value',
      'users SELECT: open to all authenticated',
      'No ESLint in pre-push (only tsc + build)',
    ]},
  ];

  const spcw = (PW - 28 - 18) / 4;
  spcols.forEach((col, i) => {
    const scx = 14 + i * (spcw + 6);
    const scy = SPY + 18;
    doc.rect(scx, scy, spcw, 16).fill(col.color);
    lbl(doc, scx + 4, scy + 4, col.title, 7, C.white, true);
    col.items.forEach((item, j) => {
      const iy = scy + 20 + j * 18;
      doc.rect(scx, iy, spcw, 16).fill(j % 2 === 0 ? '#F8FAFC' : C.white);
      doc.circle(scx + 8, iy + 8, 3).fill(col.color + (i === 3 ? 'FF' : '88'));
      lbl(doc, scx + 15, iy + 4, item, 6, C.text);
    });
  });
}

// ─── Generate PDF ─────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'h21-architecture.pdf');
const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: false });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

console.log('Page 1: System Architecture…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawArchPage(doc);

console.log('Page 2: IAM & Access Control…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawIAMPage(doc);

console.log('Page 3: Environments & Deployment…');
doc.addPage({ size: [PW, PH], margin: 0 });
drawEnvPage(doc);

doc.end();
stream.on('finish', () => {
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`✅  docs/h21-architecture.pdf  (${kb} KB)`);
});
stream.on('error', e => { console.error('❌', e.message); process.exit(1); });
