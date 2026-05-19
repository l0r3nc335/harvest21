'use strict';
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// A3 landscape – 2 wireframes side by side per page
const PW = 1190, PH = 842;

// ── Wireframe palette ─────────────────────────────────────────────────────────
const W = {
  pageBg   : '#E2E8F0',
  chrome   : '#F3F4F6',
  border   : '#CBD5E1',
  bg       : '#F9FAFB',
  card     : '#FFFFFF',
  imgPh    : '#E5E7EB',
  imgLine  : '#C4C4C4',
  textPh   : '#D1D5DB',
  textSub  : '#9CA3AF',
  text     : '#374151',
  textDark : '#111827',
  navBg    : '#0F172A',
  navText  : '#FFFFFF',
  navLink  : '#94A3B8',
  inp      : '#FFFFFF',
  inpBdr   : '#D1D5DB',
  btnDark  : '#1E293B',
  btnBlue  : '#2563EB',
  btnBg    : '#F8FAFC',
  div      : '#E5E7EB',
  sidebar  : '#F8FAFC',
  tblHead  : '#F9FAFB',
  blue     : '#2563EB',
  green    : '#059669',
  orange   : '#D97706',
  red      : '#DC2626',
  violet   : '#7C3AED',
};

// ── Low-level primitives ──────────────────────────────────────────────────────
function imgPh(doc, x, y, w, h, txt) {
  doc.rect(x, y, w, h).fillAndStroke(W.imgPh, W.border);
  doc.moveTo(x, y).lineTo(x + w, y + h).lineWidth(0.4).strokeColor(W.imgLine).stroke();
  doc.moveTo(x + w, y).lineTo(x, y + h).lineWidth(0.4).strokeColor(W.imgLine).stroke();
  if (txt) {
    doc.fillColor(W.textSub).font('Helvetica').fontSize(6.5)
       .text(txt, x, y + h / 2 - 3, { width: w, align: 'center', lineBreak: false });
  }
}

function tph(doc, x, y, w, h = 5) {               // text placeholder bar
  doc.rect(x, y, w, h).fill(W.textPh);
}

function para(doc, x, y, w, n = 3) {              // paragraph placeholder
  for (let i = 0; i < n; i++) {
    tph(doc, x, y + i * 9, i === n - 1 ? w * 0.62 : w);
  }
}

function btn(doc, x, y, w, h, label, style = 'dark') {
  const F = { dark: W.btnDark, blue: W.btnBlue, outline: W.btnBg, success: W.green, danger: W.red, light: '#F1F5F9' };
  const T = { dark: W.navText, blue: W.navText, outline: W.text, success: W.navText, danger: W.navText, light: W.text };
  const S = { dark: W.btnDark, blue: W.btnBlue, outline: W.inpBdr, success: W.green, danger: W.red, light: W.border };
  doc.roundedRect(x, y, w, h, 3).fillAndStroke(F[style] || W.btnDark, S[style] || W.btnDark);
  doc.fillColor(T[style] || W.navText).font('Helvetica-Bold').fontSize(7)
     .text(label, x, y + (h - 7) / 2, { width: w, align: 'center', lineBreak: false });
}

function inp(doc, x, y, w, placeholder = '', h = 22) {
  doc.roundedRect(x, y, w, h, 3).fillAndStroke(W.inp, W.inpBdr);
  if (placeholder) {
    doc.fillColor(W.textSub).font('Helvetica').fontSize(6.5)
       .text(placeholder, x + 6, y + (h - 6.5) / 2, { width: w - 12, lineBreak: false });
  }
}

function lbl(doc, x, y, text, size = 7, color = W.text, bold = false) {
  doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size)
     .text(text, x, y, { lineBreak: false });
}

function fieldGroup(doc, x, y, w, label, placeholder, inpH = 22) {
  lbl(doc, x, y, label, 6.5, W.text, true);
  inp(doc, x, y + 10, w, placeholder, inpH);
  return y + 10 + inpH + 8;
}

function divline(doc, x, y, w) {
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.4).strokeColor(W.div).stroke();
}

function badge(doc, x, y, text, color = W.blue) {
  const tw = doc.widthOfString(text, { size: 6 }) + 8;
  doc.roundedRect(x, y, tw, 12, 6).fill(color + '22');
  doc.fillColor(color).font('Helvetica').fontSize(6)
     .text(text, x + 4, y + 3, { lineBreak: false });
  return x + tw + 4;
}

function tab(doc, x, y, w2, text, active) {
  const tw = doc.widthOfString(text, { size: 7.5 }) + 22;
  if (active) {
    doc.rect(x, y, tw, 28).fill(W.card);
    doc.moveTo(x + 2, y + 26).lineTo(x + tw - 2, y + 26).lineWidth(2).strokeColor(W.blue).stroke();
    doc.fillColor(W.blue).font('Helvetica-Bold').fontSize(7.5)
       .text(text, x, y + 9, { width: tw, align: 'center', lineBreak: false });
  } else {
    doc.rect(x, y, tw, 28).fill(W.chrome);
    doc.fillColor(W.textSub).font('Helvetica').fontSize(7.5)
       .text(text, x, y + 9, { width: tw, align: 'center', lineBreak: false });
  }
  return x + tw;
}

function navbar(doc, x, y, w, logo, links, right) {
  const h = 36;
  doc.rect(x, y, w, h).fill(W.navBg);
  doc.fillColor(W.navText).font('Helvetica-Bold').fontSize(10)
     .text(logo, x + 10, y + 10, { lineBreak: false });
  let lx = x + 65;
  (links || []).forEach(link => {
    const tw = doc.widthOfString(link, { size: 7 });
    doc.fillColor(W.navLink).font('Helvetica').fontSize(7)
       .text(link, lx, y + 13, { lineBreak: false });
    lx += tw + 14;
  });
  let rx = x + w - 6;
  ([...right]).reverse().forEach(item => {
    const tw = doc.widthOfString(item.label, { size: 7 }) + 16;
    rx -= tw;
    doc.roundedRect(rx, y + 8, tw, 20, 3)
       .fillAndStroke(item.filled ? W.btnBlue : 'transparent', item.filled ? W.btnBlue : '#475569');
    doc.fillColor(item.filled ? W.navText : W.navLink).font('Helvetica').fontSize(7)
       .text(item.label, rx, y + 14, { width: tw, align: 'center', lineBreak: false });
    rx -= 5;
  });
  return y + h;
}

function statCard(doc, x, y, w, h, num, label, color) {
  doc.rect(x, y, w, h).fillAndStroke(W.card, W.div);
  doc.rect(x, y, 3, h).fill(color);
  doc.fillColor(W.textDark).font('Helvetica-Bold').fontSize(14)
     .text(num, x + 10, y + 8, { width: w - 15, lineBreak: false });
  doc.fillColor(W.textSub).font('Helvetica').fontSize(6.5)
     .text(label, x + 10, y + 28, { width: w - 15, lineBreak: false });
}

function tblHead(doc, x, y, cols) {
  const tw = cols.reduce((s, c) => s + c.w, 0);
  doc.rect(x, y, tw, 18).fill(W.tblHead);
  divline(doc, x, y, tw);
  divline(doc, x, y + 18, tw);
  let cx = x + 5;
  cols.forEach(c => {
    lbl(doc, cx, y + 6, c.label, 5.5, W.textSub, true);
    cx += c.w;
  });
}

function tblRow(doc, x, y, cols, vals, even) {
  const tw = cols.reduce((s, c) => s + c.w, 0);
  doc.rect(x, y, tw, 17).fill(even ? W.bg : W.card);
  divline(doc, x, y + 17, tw);
  let cx = x + 5;
  cols.forEach((c, i) => {
    if (!vals[i]) { cx += c.w; return; }
    const v = vals[i];
    if (typeof v === 'string') lbl(doc, cx, y + 5, v, 6.5, W.text);
    else if (v.badge) badge(doc, cx, y + 3, v.label, v.color);
    cx += c.w;
  });
}

function sidebarItem(doc, x, y, w, text, active) {
  if (active) {
    doc.rect(x, y, w, 24).fill(W.blue + '15');
    doc.rect(x, y, 3, 24).fill(W.blue);
  }
  const color = active ? W.blue : W.textSub;
  const bold = active;
  doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
     .text(text, x + 10, y + 8, { lineBreak: false });
}

function avatar(doc, x, y, r, initials) {
  doc.circle(x + r, y + r, r).fillAndStroke(W.imgPh, W.border);
  if (initials) lbl(doc, x, y + r - 4, initials, 7, W.textSub, true);
}

// ── Wireframe frame ───────────────────────────────────────────────────────────
function frame(doc, ox, oy, ow, oh, title, url) {
  doc.rect(ox - 2, oy - 2, ow + 4, oh + 4).fill(W.pageBg);
  doc.rect(ox + 3, oy + 3, ow, oh).fill('#00000014');
  doc.rect(ox, oy, ow, oh).fillAndStroke(W.card, W.border);
  doc.rect(ox, oy, ow, 28).fill(W.chrome);
  doc.moveTo(ox, oy + 28).lineTo(ox + ow, oy + 28).lineWidth(0.5).strokeColor(W.div).stroke();
  [[ox + 10, '#FF5F57'], [ox + 18, '#FEBC2E'], [ox + 26, '#28C840']].forEach(([bx, c]) => {
    doc.circle(bx, oy + 14, 4).fill(c);
  });
  doc.roundedRect(ox + 38, oy + 5, ow - 54, 18, 4).fillAndStroke(W.inp, W.inpBdr);
  lbl(doc, ox + 42, oy + 10, url, 6.5, W.textSub);
  // bottom label
  doc.rect(ox, oy + oh - 16, ow, 16).fill(W.btnDark);
  lbl(doc, ox + 8, oy + oh - 10, title, 6.5, W.navLink, true);
}

// ── Page header ───────────────────────────────────────────────────────────────
function pageHeader(doc, title, sub) {
  doc.rect(0, 0, PW, PH).fill('#E8EDF2');
  doc.rect(0, 0, PW, 30).fill('#0F172A');
  lbl(doc, 16, 9, title, 11, W.navText, true);
  lbl(doc, PW - 300, 11, sub, 7.5, W.navLink);
}

// =============================================================================
// WIREFRAME 1 — Home Page
// =============================================================================
function wfHome(doc, ox, oy, ow, oh) {
  let y = oy;
  // Navbar
  y = navbar(doc, ox, y, ow, 'H21', ['Find a Missionary', 'Churches', 'How It Works'],
    [{ label: 'Log In', filled: false }, { label: 'Sign Up', filled: true }]);
  // Hero
  doc.rect(ox, y, ow, 160).fill('#1E293B');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18)
     .text('Support Missionaries\nChanging the World', ox + 30, y + 30, { width: ow - 60 });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(8.5)
     .text('Harvest 21 connects donors with missionaries serving in unreached regions.', ox + 30, y + 85, { width: 260 });
  btn(doc, ox + 30, y + 115, 130, 26, 'Explore Missionaries', 'blue');
  btn(doc, ox + 172, y + 115, 100, 26, 'Learn More', 'outline');
  imgPh(doc, ox + ow - 220, y + 20, 210, 130, 'Hero Image');
  y += 162;

  // Section: Featured Missionaries
  divline(doc, ox, y, ow);
  y += 12;
  lbl(doc, ox + 14, y, 'FEATURED MISSIONARIES', 7, W.textSub, true);
  y += 16;
  const cw = (ow - 40) / 3;
  const missions = [['James & Ruth K.', 'Kenya, East Africa'], ['David M.', 'Philippines'], ['Sarah & Tom L.', 'Brazil, South America']];
  missions.forEach((m, i) => {
    const cx = ox + 14 + i * (cw + 6);
    doc.rect(cx, y, cw, 118).fillAndStroke(W.card, W.div);
    imgPh(doc, cx, y, cw, 70, 'Photo');
    lbl(doc, cx + 6, y + 76, m[0], 7.5, W.textDark, true);
    lbl(doc, cx + 6, y + 88, m[1], 6.5, W.textSub);
    btn(doc, cx + 6, y + 100, cw - 12, 14, 'View Profile', 'outline');
  });
  y += 126;

  // Section: Browse by Region
  y += 8;
  divline(doc, ox, y, ow);
  y += 12;
  lbl(doc, ox + 14, y, 'BROWSE BY REGION', 7, W.textSub, true);
  y += 12;
  const regions = ['Africa', 'Asia', 'Americas', 'Europe', 'Middle East', 'Pacific'];
  let rx = ox + 14;
  regions.forEach(r => {
    const tw = doc.widthOfString(r, { size: 7 }) + 14;
    btn(doc, rx, y, tw, 20, r, 'light');
    rx += tw + 5;
  });
  y += 28;
  const cardW = (ow - 44) / 4;
  for (let i = 0; i < 4; i++) {
    const cx = ox + 14 + i * (cardW + 5);
    doc.rect(cx, y, cardW, 100).fillAndStroke(W.card, W.div);
    imgPh(doc, cx, y, cardW, 56, '');
    lbl(doc, cx + 5, y + 61, 'Missionary Name', 7, W.textDark, true);
    lbl(doc, cx + 5, y + 72, 'Country, Region', 6, W.textSub);
    tph(doc, cx + 5, y + 85, cardW - 10, 4);
    tph(doc, cx + 5, y + 92, (cardW - 10) * 0.7, 4);
  }
  y += 108;

  // Footer
  doc.rect(ox, y, ow, 40).fill('#0F172A');
  lbl(doc, ox + 14, y + 8, 'Harvest 21', 8, W.navText, true);
  lbl(doc, ox + 14, y + 22, 'Connecting donors with missionaries worldwide', 6.5, W.navLink);
  const fLinks = ['About', 'Privacy', 'Terms', 'Contact'];
  let flx = ox + ow - 14;
  fLinks.reverse().forEach(fl => {
    const tw = doc.widthOfString(fl, { size: 6.5 });
    flx -= tw + 12;
    lbl(doc, flx, y + 14, fl, 6.5, W.navLink);
  });
}

// =============================================================================
// WIREFRAME 2 — Login / Auth Page
// =============================================================================
function wfLogin(doc, ox, oy, ow, oh) {
  // Full bg
  doc.rect(ox, oy, ow, oh).fill('#F1F5F9');
  // Centered card
  const cw = 260, ch = 330;
  const cx = ox + (ow - cw) / 2, cy = oy + 80;
  doc.rect(cx, cy, cw, ch).fillAndStroke(W.card, W.div);
  // Logo
  lbl(doc, cx + cw / 2 - 15, cy + 20, 'H21', 18, W.btnDark, true);
  lbl(doc, cx + 10, cy + 52, 'Welcome back', 11, W.textDark, true);
  lbl(doc, cx + 10, cy + 67, 'Sign in to your account', 7.5, W.textSub);
  let fy = cy + 90;
  fy = fieldGroup(doc, cx + 14, fy, cw - 28, 'Email Address', 'you@example.com');
  fy = fieldGroup(doc, cx + 14, fy, cw - 28, 'Password', '••••••••');
  // Forgot password
  lbl(doc, cx + cw - 14 - 70, fy - 4, 'Forgot password?', 6.5, W.blue);
  fy += 4;
  btn(doc, cx + 14, fy, cw - 28, 26, 'Sign In', 'blue');
  fy += 34;
  divline(doc, cx + 14, fy, cw - 28);
  fy += 10;
  lbl(doc, cx + 14, fy, "Don't have an account?", 7, W.textSub);
  lbl(doc, cx + 14 + doc.widthOfString("Don't have an account? ", { size: 7 }), fy, 'Sign up', 7, W.blue, true);
  fy += 18;
  // Social sign-in note
  lbl(doc, cx + 10, fy, 'Or sign in with:', 6.5, W.textSub);
  fy += 14;
  btn(doc, cx + 14, fy, cw - 28, 22, 'Continue with Google', 'outline');
  fy += 30;
  // Bottom note
  lbl(doc, cx + 10, fy, '© 2025 Harvest 21 — All rights reserved', 6, W.textSub);

  // Sign-up variant preview (right side small)
  const pw = 190, ph = 280;
  const px = ox + ow - pw - 16, py = oy + oh - ph - 16;
  doc.rect(px - 3, py - 3, pw + 6, ph + 6).fill(W.pageBg);
  doc.rect(px, py, pw, ph).fillAndStroke(W.card, W.div);
  doc.rect(px, py, pw, 16).fill(W.btnDark);
  lbl(doc, px + 4, py + 5, 'SIGN UP (Supporter)', 5.5, W.navLink, true);
  let sy = py + 22;
  lbl(doc, px + 10, sy, 'Create an account', 8.5, W.textDark, true); sy += 14;
  lbl(doc, px + 10, sy, 'Support missionaries you care about', 6, W.textSub); sy += 14;
  ['First Name', 'Last Name', 'Email Address', 'Password'].forEach(f => {
    lbl(doc, px + 10, sy, f, 6, W.text, true); sy += 8;
    inp(doc, px + 10, sy, pw - 20, '', 18); sy += 22;
  });
  btn(doc, px + 10, sy, pw - 20, 22, 'Create Account', 'blue');
}

// =============================================================================
// WIREFRAME 3 — Donate Page
// =============================================================================
function wfDonate(doc, ox, oy, ow, oh) {
  let y = oy;
  y = navbar(doc, ox, y, ow, 'H21', ['Find a Missionary'],
    [{ label: 'My Account', filled: false }]);

  // Missionary header strip
  doc.rect(ox, y, ow, 52).fill('#F8FAFC');
  divline(doc, ox, y + 52, ow);
  imgPh(doc, ox + 14, y + 8, 36, 36, '');
  lbl(doc, ox + 58, y + 12, 'James & Ruth Kimani', 11, W.textDark, true);
  lbl(doc, ox + 58, y + 27, '📍 Kenya, East Africa', 7.5, W.textSub);
  badge(doc, ox + ow - 100, y + 18, 'Verified Missionary', W.green);
  y += 60;

  // Two-column form layout
  const leftW = Math.floor(ow * 0.60), rightW = ow - leftW - 14;
  const lx = ox + 14, rx = ox + leftW + 14;
  let ly = y + 10, ry = y + 10;

  // ── Left: Donation Form ───────────────────────────────────────────────────
  lbl(doc, lx, ly, 'Complete Your Donation', 11, W.textDark, true); ly += 18;

  // Billing info
  lbl(doc, lx, ly, '1. BILLING INFORMATION', 7, W.textSub, true); ly += 12;
  divline(doc, lx, ly, leftW - 14); ly += 6;
  const hw = (leftW - 30) / 2;
  lbl(doc, lx, ly, 'First Name', 6.5, W.text, true);
  lbl(doc, lx + hw + 6, ly, 'Last Name', 6.5, W.text, true); ly += 9;
  inp(doc, lx, ly, hw, 'John', 22);
  inp(doc, lx + hw + 6, ly, hw, 'Doe', 22); ly += 28;
  ly = fieldGroup(doc, lx, ly, leftW - 14, 'Email', 'john@example.com');

  // Amount
  ly += 4;
  lbl(doc, lx, ly, '2. AMOUNT (USD)', 7, W.textSub, true); ly += 12;
  divline(doc, lx, ly, leftW - 14); ly += 8;
  lbl(doc, lx, ly, 'Give frequency:', 7, W.text, true); ly += 12;
  // Toggle
  doc.roundedRect(lx, ly, 120, 22, 4).fill(W.bg);
  doc.roundedRect(lx, ly, 58, 22, 4).fill(W.btnDark);
  lbl(doc, lx, ly + 7, 'One-time', 7, W.navText, false);
  lbl(doc, lx + 62, ly + 7, 'Monthly', 7, W.textSub, false);
  ly += 30;
  const amts = ['$25', '$50', '$100', '$250'];
  amts.forEach((a, i) => {
    const aw = (leftW - 14 - 15) / 4;
    const ax = lx + i * (aw + 5);
    doc.roundedRect(ax, ly, aw, 28, 4)
       .fillAndStroke(i === 1 ? W.btnBlue + '18' : W.card, i === 1 ? W.blue : W.inpBdr);
    lbl(doc, ax, ly + 10, a, 9, i === 1 ? W.blue : W.text, i === 1);
  });
  ly += 36;
  ly = fieldGroup(doc, lx, ly, leftW - 14, 'Other amount', '$');

  // Designation
  lbl(doc, lx, ly, '3. DESIGNATION (OPTIONAL)', 7, W.textSub, true); ly += 12;
  divline(doc, lx, ly, leftW - 14); ly += 8;
  inp(doc, lx, ly, leftW - 14, 'e.g. Kenya Church Plant, Vehicle Fund', 28); ly += 34;
  lbl(doc, lx + leftW - 14 - 60, ly - 6, 'More room to support general ministry', 5.5, W.textSub);
  lbl(doc, lx + leftW - 14 - 30, ly - 6, '0 / 50', 5.5, W.textSub);

  // Card details
  lbl(doc, lx, ly, '4. CARD DETAILS', 7, W.textSub, true); ly += 12;
  divline(doc, lx, ly, leftW - 14); ly += 8;
  doc.rect(lx, ly, leftW - 14, 38).fillAndStroke(W.bg, W.inpBdr);
  lbl(doc, lx + 8, ly + 8, 'Stripe Elements — Card Number', 7, W.textSub);
  lbl(doc, lx + 8, ly + 22, 'MM / YY', 7, W.textSub);
  lbl(doc, lx + leftW - 60, ly + 22, 'CVC', 7, W.textSub);
  ly += 46;
  btn(doc, lx, ly, leftW - 14, 30, 'Donate $50 →', 'blue'); ly += 36;
  lbl(doc, lx, ly, '🔒 Secured by Stripe · SSL encrypted · No card data stored on our servers', 6, W.textSub);

  // ── Right: Summary Card ───────────────────────────────────────────────────
  doc.rect(rx, ry, rightW, 220).fillAndStroke(W.card, W.div);
  doc.rect(rx, ry, rightW, 22).fill(W.btnDark);
  lbl(doc, rx + 8, ry + 8, 'Donation Summary', 7.5, W.navText, true);
  ry += 28;
  const sumRows = [['Missionary', 'James & Ruth Kimani'], ['Country', 'Kenya, East Africa'], ['Frequency', 'One-time'], ['Amount', '$50.00'], ['Designation', '—']];
  sumRows.forEach(([k, v]) => {
    lbl(doc, rx + 8, ry, k, 6.5, W.textSub);
    lbl(doc, rx + rightW - 8 - doc.widthOfString(v, { size: 7 }), ry, v, 7, W.text, true);
    ry += 16;
    divline(doc, rx + 6, ry, rightW - 12);
    ry += 4;
  });
  ry += 4;
  lbl(doc, rx + 8, ry, 'Platform fee (3%)', 6.5, W.textSub);
  lbl(doc, rx + rightW - 22, ry, '$1.50', 6.5, W.textSub);
  ry += 14;
  doc.rect(rx, ry, rightW, 22).fill(W.bg);
  lbl(doc, rx + 8, ry + 7, 'TOTAL CHARGED', 7, W.text, true);
  lbl(doc, rx + rightW - 34, ry + 7, '$51.50', 8, W.textDark, true);
  ry += 30;
  lbl(doc, rx + 8, ry, '💡 100% of your donation goes directly\nto the missionary after platform fees.', 6, W.textSub);
}

// =============================================================================
// WIREFRAME 4 — Missionary Profile (Public Page)
// =============================================================================
function wfProfile(doc, ox, oy, ow, oh) {
  let y = oy;
  y = navbar(doc, ox, y, ow, 'H21', ['Find a Missionary', 'Churches', 'How It Works'],
    [{ label: 'Log In', filled: false }, { label: 'Sign Up', filled: true }]);

  // Banner
  imgPh(doc, ox, y, ow, 100, 'Missionary Banner Image');
  y += 100;

  // Profile header
  doc.rect(ox, y, ow, 80).fill(W.card);
  divline(doc, ox, y + 80, ow);
  // Avatar overlapping banner
  doc.circle(ox + 50, y + 4, 38).fillAndStroke(W.imgPh, W.border);
  lbl(doc, ox + 30, y - 10, 'JK', 10, W.textSub, true);
  // Info
  lbl(doc, ox + 100, y + 10, 'James & Ruth Kimani', 14, W.textDark, true);
  lbl(doc, ox + 100, y + 28, '📍 Kenya, East Africa  ·  Church of the Nations', 7.5, W.textSub);
  badge(doc, ox + 100, y + 44, 'Active Missionary', W.green);
  badge(doc, ox + 100 + 95, y + 44, 'Africa', W.blue);
  // Buttons
  btn(doc, ox + ow - 240, y + 24, 110, 26, '❤ Follow', 'outline');
  btn(doc, ox + ow - 120, y + 24, 105, 26, '$ Donate', 'blue');
  y += 88;

  // Tabs
  const tabNames = ['About', 'Prayer Wall', 'Photos', 'Videos', 'Updates'];
  let tx = ox;
  tabNames.forEach((t, i) => { tx = tab(doc, tx, y, ow, t, i === 0); });
  doc.moveTo(ox, y + 28).lineTo(ox + ow, y + 28).lineWidth(0.5).strokeColor(W.div).stroke();
  y += 36;

  // Two-column content
  const lcw = Math.floor(ow * 0.65), rcw = ow - lcw - 10;
  let lcy = y + 8, rcy = y + 8;

  // About section
  lbl(doc, ox + 10, lcy, 'Our Story', 10, W.textDark, true); lcy += 16;
  para(doc, ox + 10, lcy, lcw - 20, 4); lcy += 40;
  para(doc, ox + 10, lcy, lcw - 20, 3); lcy += 32;
  lbl(doc, ox + 10, lcy, 'Ministry Focus', 9, W.textDark, true); lcy += 14;
  const focuses = ['Church Planting', 'Discipleship', 'Youth Ministry', 'Community Development'];
  focuses.forEach(f => {
    doc.circle(ox + 16, lcy + 4, 3).fill(W.blue);
    lbl(doc, ox + 24, lcy, f, 7.5, W.text); lcy += 14;
  });
  lcy += 6;
  lbl(doc, ox + 10, lcy, 'Prayer Requests', 9, W.textDark, true); lcy += 14;
  for (let i = 0; i < 3; i++) {
    doc.roundedRect(ox + 10, lcy, lcw - 20, 38, 4).fillAndStroke(W.bg, W.div);
    tph(doc, ox + 18, lcy + 8, (lcw - 36) * 0.8, 6);
    tph(doc, ox + 18, lcy + 18, lcw - 36, 5);
    tph(doc, ox + 18, lcy + 26, (lcw - 36) * 0.7, 5);
    lbl(doc, ox + 18, lcy + 34, '🙏 12 praying  · 3 days ago', 6, W.textSub);
    lcy += 44;
  }

  // Right sidebar
  doc.rect(ox + lcw + 10, rcy - 4, rcw, 100).fillAndStroke(W.card, W.div);
  lbl(doc, ox + lcw + 18, rcy + 2, 'Support Progress', 8, W.textDark, true); rcy += 16;
  doc.rect(ox + lcw + 18, rcy, rcw - 24, 8).fillAndStroke(W.imgPh, W.div);
  doc.rect(ox + lcw + 18, rcy, (rcw - 24) * 0.62, 8).fill(W.blue);
  rcy += 14;
  lbl(doc, ox + lcw + 18, rcy, '$3,100', 9, W.textDark, true);
  lbl(doc, ox + lcw + 18, rcy + 12, 'of $5,000 / month (62%)', 6.5, W.textSub); rcy += 26;
  lbl(doc, ox + lcw + 18, rcy, '🧑‍🤝‍🧑 42 donors supporting', 7, W.textSub); rcy += 14;
  btn(doc, ox + lcw + 18, rcy, rcw - 24, 24, 'Donate Now', 'blue'); rcy += 32;

  doc.rect(ox + lcw + 10, rcy, rcw, 70).fillAndStroke(W.card, W.div);
  lbl(doc, ox + lcw + 18, rcy + 8, 'Contact', 8, W.textDark, true); rcy += 22;
  lbl(doc, ox + lcw + 18, rcy, '✉ james.kimani@harvest21.org', 7, W.textSub); rcy += 12;
  lbl(doc, ox + lcw + 18, rcy, '🌐 harvest21.org/jkimani', 7, W.textSub); rcy += 12;
  btn(doc, ox + lcw + 18, rcy, rcw - 24, 20, 'Send Message', 'outline');
}

// =============================================================================
// WIREFRAME 5 — Missionaries List
// =============================================================================
function wfMissionaryList(doc, ox, oy, ow, oh) {
  let y = oy;
  y = navbar(doc, ox, y, ow, 'H21', ['Find a Missionary', 'Churches', 'How It Works'],
    [{ label: 'Log In', filled: false }, { label: 'Sign Up', filled: true }]);

  // Page title bar
  doc.rect(ox, y, ow, 50).fill('#F8FAFC');
  divline(doc, ox, y + 50, ow);
  lbl(doc, ox + 14, y + 12, 'Missionaries in Africa', 14, W.textDark, true);
  lbl(doc, ox + 14, y + 30, 'Showing 48 missionaries serving across the African continent', 7.5, W.textSub);
  y += 58;

  // Search + filter bar
  doc.rect(ox, y, ow, 42).fill(W.card);
  divline(doc, ox, y + 42, ow);
  inp(doc, ox + 14, y + 10, 240, '🔍  Search missionaries…', 22);
  const filters = ['All Regions', 'Church', 'Agency', 'Status'];
  let fx = ox + 265;
  filters.forEach(f => {
    const tw = doc.widthOfString(f, { size: 7 }) + 20;
    doc.roundedRect(fx, y + 10, tw, 22, 4).fillAndStroke(W.card, W.inpBdr);
    lbl(doc, fx + 4, y + 17, f + ' ▾', 7, W.text);
    fx += tw + 6;
  });
  btn(doc, ox + ow - 100, y + 10, 85, 22, 'Apply Filters', 'blue');
  y += 50;

  // Region tabs
  const regs = ['All', 'East Africa', 'West Africa', 'Southern Africa', 'North Africa'];
  let rtx = ox + 14;
  regs.forEach((r, i) => { rtx = tab(doc, rtx, y, ow, r, i === 1); });
  divline(doc, ox, y + 28, ow);
  y += 36;

  // Grid of missionary cards
  const cols = 4, cw2 = (ow - 30) / cols;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = ox + 14 + col * (cw2 + 4);
      const cy = y + row * 115;
      doc.rect(cx, cy, cw2, 110).fillAndStroke(W.card, W.div);
      imgPh(doc, cx, cy, cw2, 58, 'Photo');
      lbl(doc, cx + 6, cy + 63, 'Missionary Name', 7.5, W.textDark, true);
      lbl(doc, cx + 6, cy + 74, 'Country · Region', 6.5, W.textSub);
      badge(doc, cx + 6, cy + 87, 'Church Planting', W.blue);
      btn(doc, cx + 6, cy + 100, cw2 - 12, 6, '▶ View Profile', 'outline');
    }
  }
  y += 3 * 115 + 6;

  // Pagination
  doc.rect(ox, y, ow, 32).fill(W.bg);
  divline(doc, ox, y, ow);
  lbl(doc, ox + 14, y + 12, 'Showing 1–12 of 48 missionaries', 7, W.textSub);
  btn(doc, ox + ow - 80, y + 8, 35, 16, '← Prev', 'outline');
  btn(doc, ox + ow - 40, y + 8, 30, 16, 'Next →', 'blue');
}

// =============================================================================
// WIREFRAME 6 — Settings Page
// =============================================================================
function wfSettings(doc, ox, oy, ow, oh) {
  let y = oy;
  y = navbar(doc, ox, y, ow, 'H21', [],
    [{ label: 'James K.', filled: false }, { label: 'Log Out', filled: false }]);

  // Sidebar + Content layout
  const sbW = 160, contW = ow - sbW - 1;
  const sbX = ox, contX = ox + sbW + 1;
  doc.rect(sbX, y, sbW, oh - (y - oy), W.sidebar).fill(W.sidebar);
  doc.rect(contX - 0.5, y, 0.5, oh - (y - oy)).fill(W.div);

  // Sidebar header
  doc.rect(sbX, y, sbW, 60).fill(W.bg);
  divline(doc, sbX, y + 60, sbW);
  avatar(doc, sbX + 12, y + 10, 20, 'JK');
  lbl(doc, sbX + 38, y + 14, 'James Kimani', 8, W.textDark, true);
  lbl(doc, sbX + 38, y + 26, 'Missionary', 7, W.textSub);
  badge(doc, sbX + 38, y + 38, 'Active', W.green);
  y += 68;

  // Sidebar nav items
  const sideItems = [
    { label: 'Profile & Photo', active: false },
    { label: 'Page Details', active: true },
    { label: 'Media & Content', active: false },
    { label: 'Widgets & PDFs', active: false },
    { label: '– – –', active: false, divider: true },
    { label: 'My Donations', active: false },
    { label: 'Donation Options', active: false },
    { label: 'Payout Setup', active: false },
    { label: '– – –', active: false, divider: true },
    { label: 'Following', active: false },
    { label: 'Messages', active: false },
    { label: 'Security', active: false },
  ];
  let siy = y;
  sideItems.forEach(item => {
    if (item.divider) { divline(doc, sbX + 10, siy + 10, sbW - 20); siy += 20; return; }
    sidebarItem(doc, sbX, siy, sbW, item.label, item.active);
    siy += 24;
  });

  // Content area: Page Details
  let cy2 = contX + 16;
  let cY = y - 60 + 16;
  lbl(doc, cy2, cY, 'Page Details', 13, W.textDark, true); cY += 20;
  lbl(doc, cy2, cY, 'Customize how your public profile page appears to donors and followers.', 7.5, W.textSub); cY += 16;
  divline(doc, cy2, cY, contW - 32); cY += 12;

  // Form fields
  lbl(doc, cy2, cY, 'BASIC INFORMATION', 7, W.textSub, true); cY += 12;
  const fw = contW - 32;
  const hw2 = (fw - 8) / 2;
  ['Display Name', 'Title / Ministry Role'].forEach((f, i) => {
    const fx = cy2 + i * (hw2 + 8);
    lbl(doc, fx, cY, f, 6.5, W.text, true);
    inp(doc, fx, cY + 9, hw2, '', 22);
  });
  cY += 38;
  lbl(doc, cy2, cY, 'Country / Region', 6.5, W.text, true);
  inp(doc, cy2, cY + 9, fw, '', 22); cY += 38;
  lbl(doc, cy2, cY, 'Short Bio (shown under name)', 6.5, W.text, true);
  doc.roundedRect(cy2, cY + 9, fw, 50, 3).fillAndStroke(W.inp, W.inpBdr);
  para(doc, cy2 + 6, cY + 18, fw - 12, 3); cY += 68;
  divline(doc, cy2, cY, fw); cY += 10;

  lbl(doc, cy2, cY, 'DONATION SETTINGS', 7, W.textSub, true); cY += 12;
  ['Enable Donate Button', 'Allow Monthly Recurring', 'Show Support Progress'].forEach((f) => {
    doc.roundedRect(cy2, cY + 1, 14, 14, 2).fillAndStroke(W.inp, W.inpBdr);
    doc.fillColor(W.blue).font('Helvetica-Bold').fontSize(9).text('✓', cy2 + 1, cY + 3, { lineBreak: false });
    lbl(doc, cy2 + 18, cY + 4, f, 7.5, W.text); cY += 20;
  });
  cY += 6;
  btn(doc, cy2, cY, 120, 26, 'Save Changes', 'blue');
  btn(doc, cy2 + 128, cY, 100, 26, 'Preview Page', 'outline');
  cY += 34;
  lbl(doc, cy2, cY, '🔴 Submit for Review', 7.5, W.red, true);
  lbl(doc, cy2 + 110, cY, '— Publish your page after admin approval', 7, W.textSub);
}

// =============================================================================
// WIREFRAME 7 — Admin Dashboard
// =============================================================================
function wfAdminDash(doc, ox, oy, ow, oh) {
  let y = oy;
  // Admin nav (dark with admin badge)
  doc.rect(ox, y, ow, 36).fill(W.navBg);
  lbl(doc, ox + 10, y + 8, 'H21', 11, W.navText, true);
  badge(doc, ox + 48, y + 10, 'ADMIN', W.red);
  const aLinks = ['Dashboard', 'Missionaries', 'Churches', 'Agencies', 'Donors', 'Transactions', 'Users'];
  let alx = ox + 100;
  aLinks.forEach(l => {
    const tw = doc.widthOfString(l, { size: 6.5 });
    doc.fillColor(l === 'Dashboard' ? W.navText : W.navLink).font(l === 'Dashboard' ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5)
       .text(l, alx, y + 14, { lineBreak: false });
    alx += tw + 14;
  });
  lbl(doc, ox + ow - 80, y + 14, 'Admin User ▾', 6.5, W.navLink);
  y += 36;

  // Page title
  doc.rect(ox, y, ow, 36).fill(W.card);
  divline(doc, ox, y + 36, ow);
  lbl(doc, ox + 14, y + 10, 'Admin Dashboard', 12, W.textDark, true);
  lbl(doc, ox + 14, y + 26, 'Harvest 21 platform overview', 7, W.textSub);
  y += 44;

  // Stat cards
  const stats = [
    { n: '247', l: 'Total Missionaries', c: W.blue },
    { n: '1,842', l: 'Registered Donors', c: W.green },
    { n: '$48,320', l: 'Total Donations (YTD)', c: W.orange },
    { n: '12', l: 'Pending Reviews', c: W.red },
  ];
  const sw = (ow - 14 - stats.length * 4) / stats.length;
  stats.forEach((s, i) => {
    statCard(doc, ox + 14 + i * (sw + 4), y, sw, 50, s.n, s.l, s.c);
  });
  y += 60;

  // Two-column: recent + activity
  const lcw2 = Math.floor(ow * 0.58), rcw2 = ow - lcw2 - 20;
  let lY = y + 8, rY = y + 8;

  // Recent missionaries table
  doc.rect(ox + 14, lY - 6, lcw2 - 14, 220).fillAndStroke(W.card, W.div);
  lbl(doc, ox + 22, lY + 2, 'Recent Missionaries', 9, W.textDark, true);
  btn(doc, ox + lcw2 - 76, lY, 66, 18, '+ Add New', 'blue');
  lY += 24;
  const cols3 = [{ label: 'Name', w: 130 }, { label: 'Region', w: 80 }, { label: 'Church', w: 100 }, { label: 'Status', w: 80 }];
  tblHead(doc, ox + 22, lY, cols3); lY += 20;
  const rows = [
    ['James Kimani', 'Africa', 'Church of Nations', { badge: true, label: 'Active', color: W.green }],
    ['Maria Santos', 'Americas', 'Faith Community', { badge: true, label: 'Active', color: W.green }],
    ['Chen Wei', 'Asia', 'Hope Church', { badge: true, label: 'Pending', color: W.orange }],
    ['Anna Müller', 'Europe', 'City Mission', { badge: true, label: 'Active', color: W.green }],
    ['Sam Osei', 'Africa', 'New Life', { badge: true, label: 'Invited', color: W.blue }],
  ];
  rows.forEach((r, i) => { tblRow(doc, ox + 22, lY + i * 18, cols3, r, i % 2 === 0); });
  lY += rows.length * 18 + 10;
  lbl(doc, ox + 22, lY, 'View all missionaries →', 7, W.blue);

  // Right: quick stats + activity
  doc.rect(ox + lcw2 + 14, rY - 6, rcw2, 105).fillAndStroke(W.card, W.div);
  lbl(doc, ox + lcw2 + 22, rY + 2, 'Pending Actions', 9, W.textDark, true); rY += 20;
  const pending = [['Page reviews', '5'], ['Activation emails', '3'], ['Unreviewed reports', '2'], ['Stripe issues', '1']];
  pending.forEach(([k, v]) => {
    lbl(doc, ox + lcw2 + 22, rY, k, 7, W.text);
    doc.circle(ox + lcw2 + rcw2 - 12, rY + 4, 8).fill(W.red);
    lbl(doc, ox + lcw2 + rcw2 - 16, rY + 1, v, 7, W.navText, true);
    rY += 16;
  });
  rY += 6;

  doc.rect(ox + lcw2 + 14, rY, rcw2, 105).fillAndStroke(W.card, W.div);
  lbl(doc, ox + lcw2 + 22, rY + 8, 'Recent Donations', 9, W.textDark, true); rY += 24;
  for (let i = 0; i < 4; i++) {
    tph(doc, ox + lcw2 + 22, rY, rcw2 * 0.55, 7);
    tph(doc, ox + lcw2 + 22 + rcw2 * 0.6, rY, rcw2 * 0.28, 7);
    rY += 14;
    divline(doc, ox + lcw2 + 22, rY, rcw2 - 16);
    rY += 4;
  }
  lbl(doc, ox + lcw2 + 22, rY + 4, 'View all transactions →', 7, W.blue);
}

// =============================================================================
// WIREFRAME 8 — Admin Transactions
// =============================================================================
function wfTransactions(doc, ox, oy, ow, oh) {
  let y = oy;
  doc.rect(ox, y, ow, 36).fill(W.navBg);
  lbl(doc, ox + 10, y + 8, 'H21', 11, W.navText, true);
  badge(doc, ox + 48, y + 10, 'ADMIN', W.red);
  const aLinks = ['Dashboard', 'Missionaries', 'Churches', 'Transactions', 'Users'];
  let alx = ox + 100;
  aLinks.forEach(l => {
    doc.fillColor(l === 'Transactions' ? W.navText : W.navLink)
       .font(l === 'Transactions' ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5)
       .text(l, alx, y + 14, { lineBreak: false });
    alx += doc.widthOfString(l, { size: 6.5 }) + 14;
  });
  y += 36;

  // Header
  doc.rect(ox, y, ow, 36).fill(W.card);
  divline(doc, ox, y + 36, ow);
  lbl(doc, ox + 14, y + 8, 'Transactions', 13, W.textDark, true);
  lbl(doc, ox + 14, y + 24, 'All donations received through the H21 platform', 7, W.textSub);
  y += 44;

  // Stats bar
  const tStats = [{ n: '$48,320', l: 'Total' }, { n: '1,247', l: 'Count' }, { n: '$38.73', l: 'Avg.' }, { n: '142', l: 'Recurring' }];
  const tsw = (ow - 14) / 4;
  tStats.forEach((s, i) => {
    const sx = ox + 14 + i * (tsw - 2);
    doc.rect(sx, y, tsw - 6, 40).fill(i === 0 ? W.blue + '15' : W.bg);
    lbl(doc, sx + 8, y + 6, s.n, 12, i === 0 ? W.blue : W.textDark, true);
    lbl(doc, sx + 8, y + 22, s.l, 6.5, W.textSub);
  });
  y += 50;

  // Filter bar
  doc.rect(ox, y, ow, 38).fill(W.card);
  divline(doc, ox, y + 38, ow);
  inp(doc, ox + 14, y + 8, 200, '🔍  Search donor or missionary…', 22);
  const fOpts = ['All Types', 'Date Range', 'Status'];
  let ffx = ox + 222;
  fOpts.forEach(f => {
    const tw = doc.widthOfString(f, { size: 7 }) + 20;
    doc.roundedRect(ffx, y + 8, tw, 22, 4).fillAndStroke(W.card, W.inpBdr);
    lbl(doc, ffx + 4, y + 15, f + ' ▾', 7, W.text);
    ffx += tw + 6;
  });
  btn(doc, ox + ow - 100, y + 8, 85, 22, '⬇ Export CSV', 'outline');
  y += 46;

  // Table
  const cols4 = [
    { label: 'Date', w: 70 },
    { label: 'Donor', w: 120 },
    { label: 'Missionary', w: 120 },
    { label: 'Amount', w: 65 },
    { label: 'Type', w: 70 },
    { label: 'Designation', w: 100 },
    { label: 'Status', w: 75 },
  ];
  tblHead(doc, ox + 14, y, cols4); y += 20;
  const txRows = [
    ['Mar 20, 2025', 'John D.', 'James Kimani', '$100.00', { badge: true, label: 'Monthly', color: W.violet }, 'Church Plant', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 19, 2025', 'Sarah M.', 'Maria Santos', '$50.00', { badge: true, label: 'One-time', color: W.blue }, '—', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 18, 2025', 'Mike R.', 'Chen Wei', '$250.00', { badge: true, label: 'One-time', color: W.blue }, 'Vehicle Fund', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 17, 2025', 'Lisa T.', 'Anna Müller', '$25.00', { badge: true, label: 'Monthly', color: W.violet }, '—', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 15, 2025', 'David K.', 'Sam Osei', '$75.00', { badge: true, label: 'One-time', color: W.blue }, 'Medical', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 12, 2025', 'Emily W.', 'James Kimani', '$500.00', { badge: true, label: 'One-time', color: W.blue }, 'School Build', { badge: true, label: 'Refunded', color: W.red }],
    ['Mar 10, 2025', 'Robert B.', 'Maria Santos', '$150.00', { badge: true, label: 'Monthly', color: W.violet }, '—', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 8, 2025', 'Jane H.', 'Chen Wei', '$30.00', { badge: true, label: 'One-time', color: W.blue }, 'Education', { badge: true, label: 'Pending', color: W.orange }],
    ['Mar 5, 2025', 'Paul N.', 'Sam Osei', '$200.00', { badge: true, label: 'One-time', color: W.blue }, '—', { badge: true, label: 'Completed', color: W.green }],
    ['Mar 1, 2025', 'Karen S.', 'Anna Müller', '$60.00', { badge: true, label: 'Monthly', color: W.violet }, 'Outreach', { badge: true, label: 'Completed', color: W.green }],
  ];
  txRows.forEach((r, i) => { tblRow(doc, ox + 14, y + i * 17, cols4, r, i % 2 === 0); });
  y += txRows.length * 17;
  divline(doc, ox + 14, y, cols4.reduce((s, c) => s + c.w, 0));
  y += 10;
  lbl(doc, ox + 14, y, 'Showing 1–10 of 1,247 transactions', 7, W.textSub);
  btn(doc, ox + ow - 80, y - 4, 32, 18, '← Prev', 'outline');
  btn(doc, ox + ow - 42, y - 4, 28, 18, 'Next →', 'blue');
}

// =============================================================================
// WIREFRAME 9 — Messages Page
// =============================================================================
function wfMessages(doc, ox, oy, ow, oh) {
  let y = oy;
  y = navbar(doc, ox, y, ow, 'H21', [],
    [{ label: 'James K.', filled: false }]);

  // Two panel layout
  const panelL = 200, panelR = ow - panelL - 1;
  const panelY = y;
  const panelH = oh - (y - oy);

  // Left: Conversation list
  doc.rect(ox, panelY, panelL, panelH).fill(W.sidebar);
  doc.moveTo(ox + panelL, panelY).lineTo(ox + panelL, panelY + panelH).lineWidth(0.5).strokeColor(W.div).stroke();

  // Search
  inp(doc, ox + 8, panelY + 8, panelL - 16, '🔍  Search…', 22);
  y = panelY + 38;

  lbl(doc, ox + 8, y, 'MESSAGES', 6, W.textSub, true); y += 12;

  const convos = [
    { name: 'Sarah M.', msg: 'Thank you for your support!', time: '2m', unread: true },
    { name: 'Admin', msg: 'Your page has been approved', time: '1h', unread: true },
    { name: 'David K.', msg: 'Can you share more about...', time: '3h', unread: false },
    { name: 'Lisa T.', msg: 'How is the church plant going?', time: '1d', unread: false },
    { name: 'Mike R.', msg: 'Praying for your ministry!', time: '2d', unread: false },
    { name: 'John D.', msg: "I'd love to partner with you...", time: '3d', unread: false },
    { name: 'Emily W.', msg: 'When is the next update?', time: '1w', unread: false },
  ];
  convos.forEach((c, i) => {
    const cy3 = y + i * 42;
    if (i === 0) doc.rect(ox, cy3, panelL, 42).fill(W.blue + '12');
    divline(doc, ox, cy3, panelL);
    // Avatar
    doc.circle(ox + 16, cy3 + 20, 12).fill(W.imgPh);
    lbl(doc, ox + 8, cy3 + 16, c.name.substring(0, 2).toUpperCase(), 6, W.textSub, true);
    // Name + time
    lbl(doc, ox + 32, cy3 + 8, c.name, 7.5, i === 0 ? W.blue : W.textDark, true);
    lbl(doc, ox + panelL - 24, cy3 + 8, c.time, 5.5, W.textSub);
    // Preview
    const msgTw = panelL - 44;
    const msgLabel = c.msg.length > 28 ? c.msg.substring(0, 28) + '…' : c.msg;
    lbl(doc, ox + 32, cy3 + 22, msgLabel, 6, c.unread ? W.text : W.textSub, c.unread);
    if (c.unread) doc.circle(ox + panelL - 8, cy3 + 22, 4).fill(W.blue);
  });

  // Right: Message thread
  const rx2 = ox + panelL + 1;
  const threadH = oh - (panelY - oy);

  // Thread header
  doc.rect(rx2, panelY, panelR, 50).fill(W.card);
  divline(doc, rx2, panelY + 50, panelR);
  doc.circle(rx2 + 20, panelY + 24, 14).fill(W.imgPh);
  lbl(doc, rx2 + 14, panelY + 18, 'SA', 7, W.textSub, true);
  lbl(doc, rx2 + 40, panelY + 12, 'Sarah M.', 9, W.textDark, true);
  lbl(doc, rx2 + 40, panelY + 26, 'Last seen 2 minutes ago', 6.5, W.textSub);

  // Messages
  const msgY = panelY + 56;
  const msgs = [
    { from: 'Sarah', msg: 'Hi James! I wanted to say how much I appreciate your ministry updates.', time: '10:22 AM' },
    { from: 'me', msg: 'Thank you so much, Sarah! It means a lot to know people are following along.', time: '10:25 AM' },
    { from: 'Sarah', msg: 'I shared your latest update with my church group and they loved it!', time: '10:28 AM' },
    { from: 'Sarah', msg: 'We are praying for the church plant in Nairobi. How many people attended last Sunday?', time: '10:29 AM' },
    { from: 'me', msg: 'Around 45 people! Growing steadily. God is good!', time: '10:35 AM' },
  ];
  let mY = msgY;
  msgs.forEach(m => {
    const isMe = m.from === 'me';
    const mw = Math.min(panelR * 0.65, 280);
    const mx3 = isMe ? rx2 + panelR - mw - 10 : rx2 + 10;
    const bubble_h = m.msg.length > 55 ? 40 : 30;
    doc.roundedRect(mx3, mY, mw, bubble_h, 10)
       .fill(isMe ? W.blue : W.imgPh);
    doc.fillColor(isMe ? W.navText : W.textDark).font('Helvetica').fontSize(6.5)
       .text(m.msg, mx3 + 8, mY + 8, { width: mw - 16 });
    lbl(doc, mx3, mY + bubble_h + 2, m.time, 5.5, W.textSub);
    mY += bubble_h + 16;
  });

  // Input area
  const inputAreaY = panelY + threadH - 48;
  doc.rect(rx2, inputAreaY, panelR, 48).fill(W.card);
  divline(doc, rx2, inputAreaY, panelR);
  inp(doc, rx2 + 10, inputAreaY + 10, panelR - 80, 'Type a message…', 26);
  btn(doc, rx2 + panelR - 64, inputAreaY + 10, 54, 26, 'Send →', 'blue');
}

// =============================================================================
// WIREFRAME 10 — Admin Missionary Detail
// =============================================================================
function wfAdminMissDetail(doc, ox, oy, ow, oh) {
  let y = oy;
  doc.rect(ox, y, ow, 36).fill(W.navBg);
  lbl(doc, ox + 10, y + 8, 'H21', 11, W.navText, true);
  badge(doc, ox + 48, y + 10, 'ADMIN', W.red);
  const aLinks = ['Dashboard', 'Missionaries', 'Transactions'];
  let alx = ox + 100;
  aLinks.forEach(l => {
    doc.fillColor(l === 'Missionaries' ? W.navText : W.navLink)
       .font(l === 'Missionaries' ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5)
       .text(l, alx, y + 14, { lineBreak: false });
    alx += doc.widthOfString(l, { size: 6.5 }) + 14;
  });
  y += 36;

  // Breadcrumb
  doc.rect(ox, y, ow, 28).fill(W.card);
  divline(doc, ox, y + 28, ow);
  lbl(doc, ox + 14, y + 10, '← Missionaries  /  James Kimani', 7, W.textSub);
  y += 36;

  // Profile header
  doc.rect(ox, y, ow, 72).fill(W.bg);
  divline(doc, ox, y + 72, ow);
  imgPh(doc, ox + 14, y + 8, 54, 54, 'Photo');
  lbl(doc, ox + 76, y + 12, 'James & Ruth Kimani', 13, W.textDark, true);
  lbl(doc, ox + 76, y + 28, '📍 Kenya, East Africa  ·  Church of the Nations', 7, W.textSub);
  badge(doc, ox + 76, y + 44, 'Active', W.green);
  badge(doc, ox + 76 + 50, y + 44, 'Page Published', W.blue);
  badge(doc, ox + 76 + 122, y + 44, 'Stripe Connected', W.violet);
  btn(doc, ox + ow - 240, y + 22, 110, 22, 'Resend Invite Email', 'outline');
  btn(doc, ox + ow - 120, y + 22, 105, 22, 'View Public Page ↗', 'blue');
  y += 80;

  // Tabs
  const adminTabs = ['Details & Settings', 'Donations', 'Media & Widgets', 'Page Preview'];
  let atx = ox;
  adminTabs.forEach((t, i) => { atx = tab(doc, atx, y, ow, t, i === 1); });
  divline(doc, ox, y + 28, ow);
  y += 36;

  // Donations tab content
  const sw2 = (ow - 14 * 3) / 3;
  const donStats = [{ n: '$3,120', l: 'Total Received', c: W.green }, { n: '28', l: 'Donations', c: W.blue }, { n: '$8.80', l: 'Avg/Donor', c: W.orange }];
  donStats.forEach((s, i) => {
    statCard(doc, ox + 14 + i * (sw2 + 14), y, sw2, 44, s.n, s.l, s.c);
  });
  y += 54;

  // Donations table
  lbl(doc, ox + 14, y, 'Donation History', 9, W.textDark, true); y += 14;
  const dCols = [{ label: 'Date', w: 75 }, { label: 'Donor', w: 120 }, { label: 'Amount', w: 60 }, { label: 'Type', w: 80 }, { label: 'Designation', w: 100 }, { label: 'Status', w: 80 }];
  tblHead(doc, ox + 14, y, dCols); y += 20;
  const dRows = [
    ['Mar 20, 2025', 'John Doe', '$100.00', { badge: true, label: 'Monthly', color: W.violet }, 'Church Plant', { badge: true, label: 'Paid', color: W.green }],
    ['Mar 15, 2025', 'Sarah Miller', '$50.00', { badge: true, label: 'One-time', color: W.blue }, '—', { badge: true, label: 'Paid', color: W.green }],
    ['Mar 10, 2025', 'Michael R.', '$250.00', { badge: true, label: 'One-time', color: W.blue }, 'Vehicle Fund', { badge: true, label: 'Paid', color: W.green }],
    ['Mar 1, 2025', 'Karen S.', '$100.00', { badge: true, label: 'Monthly', color: W.violet }, '—', { badge: true, label: 'Paid', color: W.green }],
    ['Feb 20, 2025', 'David K.', '$30.00', { badge: true, label: 'One-time', color: W.blue }, 'Education', { badge: true, label: 'Paid', color: W.green }],
    ['Feb 12, 2025', 'Lisa T.', '$500.00', { badge: true, label: 'One-time', color: W.blue }, 'School Build', { badge: true, label: 'Refunded', color: W.red }],
  ];
  dRows.forEach((r, i) => { tblRow(doc, ox + 14, y + i * 17, dCols, r, i % 2 === 0); });
  y += dRows.length * 17 + 6;
  lbl(doc, ox + 14, y, 'Showing 1–6 of 28 donations', 7, W.textSub);
}

// =============================================================================
// MAIN — Build PDF
// =============================================================================
const outPath = path.join(__dirname, 'h21-wireframes.pdf');
const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: false });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

// WF pairs: [title, wfFn, url] x 2 per page
const pages = [
  {
    label: 'Public Facing Pages',
    pairs: [
      { title: 'Home Page  /  harvest21.org/', url: 'harvest21.org', fn: wfHome },
      { title: 'Login & Sign Up  /  /login', url: 'harvest21.org/login', fn: wfLogin },
    ],
  },
  {
    label: 'Donation & Missionary Profile',
    pairs: [
      { title: 'Donate Page  /  /donate', url: 'harvest21.org/donate?page_id=42', fn: wfDonate },
      { title: 'Missionary Public Profile  /  /[page_url]', url: 'harvest21.org/jkimani', fn: wfProfile },
    ],
  },
  {
    label: 'Missionaries List & Settings',
    pairs: [
      { title: 'Missionaries List  /  /missionaries/africa', url: 'harvest21.org/missionaries/africa', fn: wfMissionaryList },
      { title: 'Settings Page  /  /settings', url: 'harvest21.org/settings', fn: wfSettings },
    ],
  },
  {
    label: 'Admin — Dashboard & Transactions',
    pairs: [
      { title: 'Admin Dashboard  /  /admin', url: 'harvest21.org/admin', fn: wfAdminDash },
      { title: 'Admin Transactions  /  /admin/transactions', url: 'harvest21.org/admin/transactions', fn: wfTransactions },
    ],
  },
  {
    label: 'Messages & Admin Missionary Detail',
    pairs: [
      { title: 'Direct Messages  /  /messages', url: 'harvest21.org/messages', fn: wfMessages },
      { title: 'Admin Missionary Detail  /  /admin/missionaries/[id]', url: 'harvest21.org/admin/missionaries/12', fn: wfAdminMissDetail },
    ],
  },
];

// Frame dimensions
const FX = [15, 605], FY = 35, FW = 570, FH = 800;

pages.forEach((pg, pi) => {
  console.log(`Generating Page ${pi + 1}: ${pg.label}…`);
  doc.addPage({ size: [PW, PH], margin: 0 });

  // Page background + header
  doc.rect(0, 0, PW, PH).fill('#DDE4EE');
  doc.rect(0, 0, PW, 30).fill('#0F172A');
  lbl(doc, 16, 9, 'H21 Platform Wireframes', 10, W.navText, true);
  lbl(doc, 200, 11, `— ${pg.label}`, 8, W.navLink);
  lbl(doc, PW - 120, 11, `Page ${pi + 1} of ${pages.length}`, 7.5, W.navLink);

  // Draw both wireframes
  pg.pairs.forEach((wf, i) => {
    const ox = FX[i], oy = FY;
    // Draw frame
    frame(doc, ox, oy, FW, FH, wf.title, wf.url);
    // Clip content and draw
    doc.save();
    doc.rect(ox + 1, oy + 29, FW - 2, FH - 30).clip();
    try {
      wf.fn(doc, ox + 1, oy + 29, FW - 2, FH - 30);
    } catch (e) {
      lbl(doc, ox + 20, oy + 50, `Error: ${e.message}`, 8, W.red);
    }
    doc.restore();
  });
});

doc.end();
stream.on('finish', () => {
  const sz = fs.statSync(outPath).size;
  console.log(`✅ Done → docs/h21-wireframes.pdf (${(sz / 1024).toFixed(1)} KB)`);
});
stream.on('error', err => { console.error('❌', err.message); process.exit(1); });
