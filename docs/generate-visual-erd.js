'use strict';
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');

// ─── dimensions ───────────────────────────────────────────────────────────────
const EW = 162;   // entity width
const EHH = 21;   // header height
const EAH = 13;   // attribute row height

// ─── colours ──────────────────────────────────────────────────────────────────
const COL = {
  identity : '#1E40AF',
  orgs     : '#065F46',
  pages    : '#5B21B6',
  donations: '#991B1B',
  prayers  : '#92400E',
  social   : '#9D174D',
  messaging: '#0C4A6E',
  homepage : '#1F2937',
  ref      : '#6B7280',
  line     : '#7C8FA6',
  arrow    : '#4B5563',
};

// ─── helper: entity box height ────────────────────────────────────────────────
function boxH(e) { return EHH + e.attrs.length * EAH + 1; }

// ─── draw one entity box, return { x,y,w,h } ─────────────────────────────────
function drawBox(doc, e) {
  const [x, y] = e.pos;
  const w = EW;
  const h = boxH(e);

  // shadow
  doc.rect(x+2, y+2, w, h).fill('#E2E8F0');

  // header
  doc.rect(x, y, w, EHH).fill(e.color);
  const hName = e.isRef ? `⟵ ${e.name} (ref)` : e.name;
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
     .text(hName, x+5, y+5, { width: w-10, lineBreak: false });

  // attribute rows
  e.attrs.forEach((a, i) => {
    const ay = y + EHH + i * EAH;
    doc.rect(x, ay, w, EAH).fill(i % 2 ? '#F1F5F9' : '#FFFFFF');

    if (a.pk) {
      doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(5.5)
         .text('PK', x+2, ay+4, { lineBreak: false });
    } else if (a.fk) {
      doc.fillColor('#4338CA').font('Helvetica').fontSize(5.5)
         .text('FK', x+2, ay+4, { lineBreak: false });
    }

    const nx  = a.pk || a.fk ? x+19 : x+5;
    const nc  = a.pk ? '#92400E' : '#1E293B';
    const nf  = a.pk ? 'Helvetica-Bold' : a.fk ? 'Helvetica-Oblique' : 'Helvetica';
    doc.fillColor(nc).font(nf).fontSize(7)
       .text(a.name, nx, ay+3, { width: w-nx+x-3, lineBreak: false });
  });

  // border
  doc.rect(x, y, w, h).lineWidth(0.5).stroke('#CBD5E1');
  doc.moveTo(x, y+EHH).lineTo(x+w, y+EHH).lineWidth(0.5).stroke('#CBD5E1');
  for (let i=1; i<e.attrs.length; i++) {
    const ay = y + EHH + i * EAH;
    doc.moveTo(x, ay).lineTo(x+w, ay).lineWidth(0.2).stroke('#E2E8F0');
  }

  return { x, y, w, h };
}

// ─── connection routing ────────────────────────────────────────────────────────
function getExitEntry(src, tgt) {
  const scx = src.x + src.w/2,  scy = src.y + src.h/2;
  const tcx = tgt.x + tgt.w/2,  tcy = tgt.y + tgt.h/2;
  const dx = tcx - scx, dy = tcy - scy;

  let ex, ey, rx, ry;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) { ex = src.x+src.w; ey = scy; rx = tgt.x;      ry = tcy; }
    else        { ex = src.x;       ey = scy; rx = tgt.x+tgt.w; ry = tcy; }
  } else {
    if (dy > 0) { ex = scx; ey = src.y+src.h; rx = tcx; ry = tgt.y; }
    else        { ex = scx; ey = src.y;        rx = tcx; ry = tgt.y+tgt.h; }
  }
  return { ex, ey, rx, ry, dx, dy };
}

function drawArrowHead(doc, rx, ry, dx, dy, color) {
  let ax, ay;
  if (Math.abs(dx) >= Math.abs(dy)) { ax = dx>0 ? -1 : 1; ay = 0; }
  else                              { ax = 0; ay = dy>0 ? -1 : 1; }
  const s = 5;
  doc.save()
     .moveTo(rx, ry)
     .lineTo(rx + ax*s + ay*s, ry + ay*s - ax*s)
     .lineTo(rx + ax*s - ay*s, ry + ay*s + ax*s)
     .fill(color || COL.arrow);
  doc.restore();
}

function drawCrowFoot(doc, ex, ey, dx, dy, color) {
  let nx, ny;
  if (Math.abs(dx) >= Math.abs(dy)) { nx = dx>0 ? -1 : 1; ny = 0; }
  else                              { nx = 0; ny = dy>0 ? -1 : 1; }
  const s = 5;
  const c = color || COL.line;
  // Three tines
  [-s, 0, s].forEach(offset => {
    const ox = offset * ny, oy = offset * nx;
    doc.moveTo(ex, ey).lineTo(ex + nx*s*2 + ox, ey + ny*s*2 + oy)
       .lineWidth(0.7).stroke(c);
  });
  // Circle at many end
  doc.circle(ex, ey, 2.5).lineWidth(0.7).strokeColor(c).stroke();
}

function drawOneBar(doc, rx, ry, dx, dy, color) {
  let nx, ny;
  if (Math.abs(dx) >= Math.abs(dy)) { nx = dx>0 ? -1 : 1; ny = 0; }
  else                              { nx = 0; ny = dy>0 ? -1 : 1; }
  const s = 5;
  const c = color || COL.line;
  // Double bar (one-and-only-one)
  [4, 9].forEach(d => {
    const bx = rx + nx*d, by = ry + ny*d;
    doc.moveTo(bx + ny*s, by + nx*s)
       .lineTo(bx - ny*s, by - nx*s)
       .lineWidth(1).stroke(c);
  });
}

function drawConnection(doc, boxes, from, to, opt) {
  const src = boxes[from], tgt = boxes[to];
  if (!src || !tgt) return;
  const { ex, ey, rx, ry, dx, dy } = getExitEntry(src, tgt);
  const c = opt?.color || COL.line;

  // draw elbow path
  doc.save();
  doc.moveTo(ex, ey);
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mid = ex + dx/2;
    doc.lineTo(mid, ey).lineTo(mid, ry).lineTo(rx, ry);
  } else {
    const mid = ey + dy/2;
    doc.lineTo(ex, mid).lineTo(rx, mid).lineTo(rx, ry);
  }
  if (opt?.dashed) {
    doc.lineWidth(0.6).dash(4, { space: 3 }).strokeColor(c).stroke().undash();
  } else {
    doc.lineWidth(0.8).strokeColor(c).stroke();
  }
  doc.restore();

  // many end (FK / child side)
  drawCrowFoot(doc, ex, ey, dx, dy, c);
  // one end (PK / parent side)
  drawOneBar(doc, rx, ry, dx, dy, c);
}

// ─── page header ──────────────────────────────────────────────────────────────
function pageHeader(doc, title, sub, pageW) {
  doc.rect(0, 0, pageW, 38).fill('#0F172A');
  doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(13)
     .text('Harvest 21  ·  Entity Relationship Diagram', 18, 10);
  doc.fillColor('#7DD3FC').font('Helvetica').fontSize(8)
     .text(sub, 18, 26);
  const d = `Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`;
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
     .text(d, pageW-240, 27, { width:235, align:'right' });

  // Domain legend
  const domains = [
    { c: COL.identity,  l: 'Auth / Users' },
    { c: COL.orgs,      l: 'Organizations' },
    { c: COL.pages,     l: 'Pages' },
    { c: COL.donations, l: 'Donations' },
    { c: COL.prayers,   l: 'Prayers' },
    { c: COL.social,    l: 'Social / Follow' },
    { c: COL.messaging, l: 'Messaging' },
    { c: COL.homepage,  l: 'Homepage' },
    { c: COL.ref,       l: '(reference — see pg 1)' },
  ];
  let lx = 18;
  const ly = 46;
  doc.fontSize(6.5);
  domains.forEach(d => {
    doc.rect(lx, ly, 8, 8).fill(d.c);
    doc.fillColor('#1E293B').font('Helvetica')
       .text(d.l, lx+11, ly+1, { lineBreak:false });
    lx += doc.widthOfString(d.l) + 22;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const P1_ENTITIES = [
  // ── Auth & Identity ──────────────────────────────────────────────────────────
  { name:'auth.users',         color:COL.identity, pos:[715, 48],
    attrs:[{ name:'id', pk:true },{ name:'email' },{ name:'created_at' }] },

  { name:'users',              color:COL.identity, pos:[430, 200],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'role', fk:true },{ name:'first_name' },
           { name:'last_name' },{ name:'email' },{ name:'status' }] },

  { name:'user_roles',         color:COL.identity, pos:[200, 268],
    attrs:[{ name:'id', pk:true },{ name:'role' }] },

  { name:'supporter_profiles', color:COL.identity, pos:[200, 398],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'first_name' },{ name:'last_name' },
           { name:'email' },{ name:'country_of_residence' }] },

  { name:'donors',             color:COL.identity, pos:[430, 440],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'first_name' },{ name:'last_name' },
           { name:'email' },{ name:'stripe_customer_id' }] },

  // ── Organizations ────────────────────────────────────────────────────────────
  { name:'missionaries',       color:COL.orgs, pos:[715, 195],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'agency_id', fk:true },{ name:'sending_church_id', fk:true },
           { name:'college_id', fk:true },{ name:'first_name' },
           { name:'last_name' },{ name:'mission_status' }] },

  { name:'agencies',           color:COL.orgs, pos:[1010, 70],
    attrs:[{ name:'id', pk:true },{ name:'contact_user_id', fk:true },
           { name:'name' },{ name:'email' },{ name:'country' }] },

  { name:'churches',           color:COL.orgs, pos:[1010, 262],
    attrs:[{ name:'id', pk:true },{ name:'contact_user_id', fk:true },
           { name:'name' },{ name:'city' },{ name:'country' }] },

  { name:'colleges',           color:COL.orgs, pos:[1010, 454],
    attrs:[{ name:'id', pk:true },{ name:'contact_user_id', fk:true },
           { name:'name' },{ name:'email' },{ name:'country' }] },

  // ── Pages ────────────────────────────────────────────────────────────────────
  { name:'pages',              color:COL.pages, pos:[715, 475],
    attrs:[{ name:'id', pk:true },{ name:'organization_type' },
           { name:'organization_id' },{ name:'page_url' },
           { name:'is_published' },{ name:'donation_mode' }] },

  { name:'page_approvals',     color:COL.pages, pos:[480, 678],
    attrs:[{ name:'id', pk:true },{ name:'page_id', fk:true },
           { name:'requested_by', fk:true },{ name:'approved_by', fk:true },
           { name:'status' }] },

  { name:'page_media',         color:COL.pages, pos:[715, 690],
    attrs:[{ name:'id', pk:true },{ name:'page_id', fk:true },
           { name:'media_type' },{ name:'media_url' }] },

  { name:'page_widgets',       color:COL.pages, pos:[960, 678],
    attrs:[{ name:'id', pk:true },{ name:'page_id', fk:true },
           { name:'widget_type' },{ name:'widget_data' }] },

  // ── Donations ────────────────────────────────────────────────────────────────
  { name:'page_donations',     color:COL.donations, pos:[715, 862],
    attrs:[{ name:'id', pk:true },{ name:'donor_id', fk:true },
           { name:'page_id', fk:true },{ name:'user_id', fk:true },
           { name:'amount' },{ name:'status' },
           { name:'type' },{ name:'designation' }] },

  { name:'donation_receipts',  color:COL.donations, pos:[1010, 862],
    attrs:[{ name:'id', pk:true },{ name:'page_donation_id', fk:true },
           { name:'donor_id', fk:true },{ name:'amount' },
           { name:'receipt_number' }] },

  // ── Homepage ─────────────────────────────────────────────────────────────────
  { name:'homepage_banners',   color:COL.homepage, pos:[1295, 70],
    attrs:[{ name:'id', pk:true },{ name:'banner_type' },
           { name:'image_url' },{ name:'display_order' },{ name:'is_active' }] },

  { name:'homepage_settings',  color:COL.homepage, pos:[1295, 245],
    attrs:[{ name:'id', pk:true },{ name:'banner_type' },{ name:'auto_scroll' }] },

  { name:'footer_content',     color:COL.homepage, pos:[1295, 385],
    attrs:[{ name:'id', pk:true },{ name:'page_type' },
           { name:'title' },{ name:'content' }] },
];

const P1_CONNS = [
  // identity
  ['users',               'auth.users'],
  ['users',               'user_roles'],
  ['supporter_profiles',  'auth.users'],
  ['donors',              'auth.users'],
  // orgs
  ['missionaries',        'auth.users'],
  ['missionaries',        'agencies'],
  ['missionaries',        'churches'],
  ['missionaries',        'colleges'],
  ['agencies',            'auth.users',  { color:'#94A3B8', dashed:true }],
  ['churches',            'auth.users',  { color:'#94A3B8', dashed:true }],
  ['colleges',            'auth.users',  { color:'#94A3B8', dashed:true }],
  // pages
  ['page_approvals',      'pages'],
  ['page_media',          'pages'],
  ['page_widgets',        'pages'],
  // donations
  ['page_donations',      'pages'],
  ['page_donations',      'donors'],
  ['page_donations',      'auth.users',  { color:'#94A3B8', dashed:true }],
  ['donation_receipts',   'page_donations'],
  ['donation_receipts',   'donors'],
];

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 entities
// ─────────────────────────────────────────────────────────────────────────────
const P2_ENTITIES = [
  // Reference stubs (from page 1)
  { name:'missionaries', color:COL.ref,  pos:[30,  42],  isRef:true,
    attrs:[{ name:'id', pk:true },{ name:'...' }] },
  { name:'churches',     color:COL.ref,  pos:[30, 198],  isRef:true,
    attrs:[{ name:'id', pk:true },{ name:'...' }] },
  { name:'auth.users',   color:COL.ref,  pos:[30, 340],  isRef:true,
    attrs:[{ name:'id', pk:true },{ name:'...' }] },
  { name:'pages',        color:COL.ref,  pos:[30, 490],  isRef:true,
    attrs:[{ name:'id', pk:true },{ name:'...' }] },

  // Prayers
  { name:'prayers',             color:COL.prayers, pos:[275, 50],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'page_id', fk:true },{ name:'body' },
           { name:'visibility' },{ name:'is_published' }] },

  { name:'prayer_reactions',    color:COL.prayers, pos:[275, 250],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'prayer_id', fk:true },{ name:'type' }] },

  { name:'prayer_updates',      color:COL.prayers, pos:[505, 250],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'prayer_id', fk:true },{ name:'body' }] },

  // Social / Follow
  { name:'missionary_followers', color:COL.social, pos:[775, 50],
    attrs:[{ name:'id', pk:true },{ name:'missionary_id', fk:true },
           { name:'user_id', fk:true },{ name:'status' },{ name:'note' }] },

  { name:'church_followers',     color:COL.social, pos:[775, 248],
    attrs:[{ name:'id', pk:true },{ name:'church_id', fk:true },
           { name:'user_id', fk:true },{ name:'status' },{ name:'note' }] },

  { name:'missionary_missionary_followers', color:COL.social, pos:[775, 440],
    attrs:[{ name:'id', pk:true },{ name:'followed_missionary_id', fk:true },
           { name:'follower_missionary_id', fk:true },
           { name:'status' },{ name:'note' }] },

  { name:'missionary_churches',  color:COL.social, pos:[1020, 310],
    attrs:[{ name:'id', pk:true },{ name:'missionary_id', fk:true },
           { name:'church_id', fk:true },{ name:'relationship_type' }] },

  { name:'notifications',        color:COL.social, pos:[1290, 50],
    attrs:[{ name:'id', pk:true },{ name:'user_id', fk:true },
           { name:'type' },{ name:'title' },{ name:'is_read' }] },

  // Messaging
  { name:'conversations',         color:COL.messaging, pos:[1290, 260],
    attrs:[{ name:'id', pk:true },{ name:'missionary_id', fk:true },
           { name:'supporter_id', fk:true },{ name:'last_message_at' }] },

  { name:'conversation_members',  color:COL.messaging, pos:[1070, 468],
    attrs:[{ name:'id', pk:true },{ name:'conversation_id', fk:true },
           { name:'user_id', fk:true },{ name:'unread_count' }] },

  { name:'messages',              color:COL.messaging, pos:[1290, 480],
    attrs:[{ name:'id', pk:true },{ name:'conversation_id', fk:true },
           { name:'sender_id', fk:true },{ name:'content' },{ name:'is_read' }] },

  { name:'message_reports',       color:COL.messaging, pos:[1550, 280],
    attrs:[{ name:'id', pk:true },{ name:'conversation_id', fk:true },
           { name:'message_id', fk:true },{ name:'reported_by', fk:true },
           { name:'report_type' },{ name:'status' }] },
];

const P2_CONNS = [
  // prayers
  ['prayers',             'auth.users',  { color:'#94A3B8', dashed:true }],
  ['prayers',             'pages',       { color:'#94A3B8', dashed:true }],
  ['prayer_reactions',    'prayers'],
  ['prayer_reactions',    'auth.users',  { color:'#94A3B8', dashed:true }],
  ['prayer_updates',      'prayers'],
  ['prayer_updates',      'auth.users',  { color:'#94A3B8', dashed:true }],
  // followers
  ['missionary_followers','missionaries'],
  ['missionary_followers','auth.users',  { color:'#94A3B8', dashed:true }],
  ['church_followers',    'churches'],
  ['church_followers',    'auth.users',  { color:'#94A3B8', dashed:true }],
  ['missionary_missionary_followers','missionaries'],
  ['missionary_churches', 'missionaries'],
  ['missionary_churches', 'churches'],
  // notifications
  ['notifications',       'auth.users',  { color:'#94A3B8', dashed:true }],
  // messaging
  ['conversations',       'missionaries'],
  ['conversations',       'auth.users',  { color:'#94A3B8', dashed:true }],
  ['conversation_members','conversations'],
  ['conversation_members','auth.users',  { color:'#94A3B8', dashed:true }],
  ['messages',            'conversations'],
  ['messages',            'auth.users',  { color:'#94A3B8', dashed:true }],
  ['message_reports',     'conversations'],
  ['message_reports',     'messages'],
  ['message_reports',     'auth.users',  { color:'#94A3B8', dashed:true }],
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
function generate() {
  const P1W = 1560, P1H = 1075;
  const P2W = 1790, P2H = 720;

  const doc = new PDFDocument({ size:[P1W, P1H], margin:0, autoFirstPage:true });
  const out  = path.join(__dirname, 'h21-database-erd-visual.pdf');
  const stream = fs.createWriteStream(out);
  doc.pipe(stream);

  // ── PAGE 1 ─────────────────────────────────────────────────────────────────
  pageHeader(doc, 'Page 1 of 2  —  Core Schema', 'Auth · Users · Organizations · Pages · Donations · Homepage', P1W);

  const boxes1 = {};
  P1_ENTITIES.forEach(e => { boxes1[e.name] = drawBox(doc, e); });

  // draw connections BEHIND boxes → draw first then redraw boxes on top
  // Actually pdfkit draws in order, so draw connections AFTER all boxes
  // But that will draw lines over box edges. Let's draw connections first, then redraw box outlines.
  // Simpler: draw connections after all boxes (lines will cross box edges which is normal in ERDs)
  P1_CONNS.forEach(([f, t, opt]) => drawConnection(doc, boxes1, f, t, opt));

  // ── PAGE 2 ─────────────────────────────────────────────────────────────────
  doc.addPage({ size:[P2W, P2H], margin:0 });
  pageHeader(doc, 'Page 2 of 2  —  Extended Schema', 'Prayers · Social / Follow · Direct Messaging', P2W);

  const boxes2 = {};
  P2_ENTITIES.forEach(e => { boxes2[e.name] = drawBox(doc, e); });
  P2_CONNS.forEach(([f, t, opt]) => drawConnection(doc, boxes2, f, t, opt));

  doc.end();
  stream.on('finish', () => console.log('✅  Visual ERD →', out));
  stream.on('error',  e => { console.error('❌', e); process.exit(1); });
}

generate();
