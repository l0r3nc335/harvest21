'use strict';
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W  = 1192;
const PAGE_H  = 842;
const TABLE_W = 210;
const HEADER_H = 22;
const ROW_H    = 13;
const TABLE_GAP = 7;
const COL_GAP   = 18;
const PAGE_MX   = 20;
const CONTENT_Y = 46;

const FS = { header: 8.5, col: 7, type: 6, group: 8.5, title: 14, subtitle: 7.5 };

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  identity:  '#1D4ED8',
  orgs:      '#047857',
  pages:     '#6D28D9',
  donations: '#B91C1C',
  prayers:   '#B45309',
  social:    '#BE185D',
  messaging: '#0E7490',
  homepage:  '#374151',
  pk_bg: '#FEFCE8', fk_bg: '#EEF2FF', alt_bg: '#F9FAFB',
  border: '#D1D5DB', text: '#111827', type_c: '#9CA3AF',
  pk_ind: '#92400E', fk_ind: '#4338CA',
};

// ─── Full schema ──────────────────────────────────────────────────────────────
const PAGE1_GROUPS = [
  {
    label: 'Auth & Identity', color: C.identity,
    tables: [
      { name: 'auth.users', subtitle: '(Supabase Auth — external)',
        columns: [
          { n:'id',         t:'uuid',        pk:true },
          { n:'email',      t:'text' },
          { n:'created_at', t:'timestamptz' },
        ]},
      { name: 'users',
        columns: [
          { n:'id',            t:'bigint',      pk:true },
          { n:'user_id',       t:'uuid',        fk:true, nl:true },
          { n:'role',          t:'smallint',    fk:true, nl:true },
          { n:'status',        t:'varchar',     nl:true },
          { n:'first_name',    t:'varchar',     nl:true },
          { n:'last_name',     t:'varchar',     nl:true },
          { n:'email',         t:'text' },
          { n:'last_activity', t:'timestamptz', nl:true },
          { n:'created_at',    t:'timestamptz' },
        ]},
      { name: 'user_roles',
        columns: [
          { n:'id',   t:'bigint', pk:true },
          { n:'role', t:'varchar', nl:true },
        ]},
      { name: 'supporter_profiles',
        columns: [
          { n:'id',                   t:'bigint', pk:true },
          { n:'user_id',              t:'uuid',   fk:true },
          { n:'first_name',           t:'text' },
          { n:'last_name',            t:'text' },
          { n:'email',                t:'text' },
          { n:'country_of_residence', t:'text' },
          { n:'phone_number',         t:'text', nl:true },
          { n:'created_at',           t:'timestamptz' },
          { n:'updated_at',           t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Organizations', color: C.orgs,
    tables: [
      { name: 'missionaries',
        columns: [
          { n:'id',                      t:'bigint', pk:true },
          { n:'user_id',                 t:'uuid',   fk:true, nl:true },
          { n:'agency_id',               t:'bigint', fk:true, nl:true },
          { n:'sending_church_id',       t:'bigint', fk:true, nl:true },
          { n:'mission_field_church_id', t:'bigint', fk:true, nl:true },
          { n:'college_id',              t:'bigint', fk:true, nl:true },
          { n:'first_name',              t:'varchar' },
          { n:'last_name',               t:'varchar' },
          { n:'email',                   t:'text',   nl:true },
          { n:'destination_country',     t:'varchar', nl:true },
          { n:'mission_status',          t:'varchar', nl:true },
          { n:'biography',               t:'text',   nl:true },
          { n:'stripe_account_id',       t:'text',   nl:true },
          { n:'payout_status',           t:'text',   nl:true },
          { n:'allow_direct_messages',   t:'boolean' },
          { n:'open_to_visits',          t:'boolean' },
          { n:'created_at',              t:'timestamptz' },
        ]},
      { name: 'agencies',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'contact_user_id', t:'uuid',   fk:true, nl:true },
          { n:'name',            t:'varchar' },
          { n:'email',           t:'text',   nl:true },
          { n:'phone_number',    t:'varchar', nl:true },
          { n:'address',         t:'text',   nl:true },
          { n:'city',            t:'varchar', nl:true },
          { n:'country',         t:'varchar', nl:true },
          { n:'state',           t:'varchar', nl:true },
          { n:'website',         t:'text',   nl:true },
          { n:'created_at',      t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'More Organizations', color: C.orgs,
    tables: [
      { name: 'churches',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'contact_user_id', t:'uuid',   fk:true, nl:true },
          { n:'name',            t:'varchar' },
          { n:'phone_number',    t:'varchar', nl:true },
          { n:'address',         t:'text',   nl:true },
          { n:'city',            t:'varchar', nl:true },
          { n:'country',         t:'varchar', nl:true },
          { n:'state',           t:'varchar', nl:true },
          { n:'website',         t:'text',   nl:true },
          { n:'created_at',      t:'timestamptz' },
        ]},
      { name: 'colleges',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'contact_user_id', t:'uuid',   fk:true, nl:true },
          { n:'name',            t:'varchar' },
          { n:'email',           t:'text',   nl:true },
          { n:'phone_number',    t:'varchar', nl:true },
          { n:'address',         t:'text',   nl:true },
          { n:'city',            t:'varchar', nl:true },
          { n:'country',         t:'varchar', nl:true },
          { n:'website',         t:'text',   nl:true },
          { n:'created_at',      t:'timestamptz' },
        ]},
      { name: 'donors',
        columns: [
          { n:'id',                 t:'bigint',      pk:true },
          { n:'user_id',            t:'uuid',         fk:true, nl:true },
          { n:'first_name',         t:'text' },
          { n:'last_name',          t:'text' },
          { n:'email',              t:'text',         nl:true },
          { n:'phone_number',       t:'text',         nl:true },
          { n:'city',               t:'text',         nl:true },
          { n:'country',            t:'text',         nl:true },
          { n:'stripe_customer_id', t:'text',         nl:true },
          { n:'total_donated',      t:'numeric(12,2)' },
          { n:'is_active',          t:'boolean' },
          { n:'updated_at',         t:'timestamptz' },
          { n:'created_at',         t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Pages', color: C.pages,
    tables: [
      { name: 'pages',
        columns: [
          { n:'id',                    t:'bigint', pk:true },
          { n:'organization_type',     t:'text' },
          { n:'organization_id',       t:'bigint' },
          { n:'page_url',              t:'text',   nl:true },
          { n:'profile_photo_url',     t:'text',   nl:true },
          { n:'banner_photo_url',      t:'text',   nl:true },
          { n:'about_text',            t:'text',   nl:true },
          { n:'is_published',          t:'boolean' },
          { n:'donation_mode',         t:'text',   nl:true },
          { n:'external_donation_url', t:'text',   nl:true },
          { n:'published_at',          t:'timestamptz', nl:true },
          { n:'created_at',            t:'timestamptz' },
          { n:'updated_at',            t:'timestamptz' },
        ]},
      { name: 'page_approvals',
        columns: [
          { n:'id',           t:'bigint', pk:true },
          { n:'page_id',      t:'bigint', fk:true },
          { n:'requested_by', t:'uuid',   fk:true, nl:true },
          { n:'approved_by',  t:'uuid',   fk:true, nl:true },
          { n:'status',       t:'text' },
          { n:'reviewed_at',  t:'timestamptz', nl:true },
          { n:'created_at',   t:'timestamptz' },
        ]},
      { name: 'page_media',
        columns: [
          { n:'id',            t:'bigint', pk:true },
          { n:'page_id',       t:'bigint', fk:true },
          { n:'media_type',    t:'text',   nl:true },
          { n:'media_url',     t:'text' },
          { n:'description',   t:'text',   nl:true },
          { n:'thumbnail_url', t:'text',   nl:true },
          { n:'views',         t:'integer', nl:true },
          { n:'reactions',     t:'integer', nl:true },
          { n:'created_at',    t:'timestamptz' },
        ]},
      { name: 'page_widgets',
        columns: [
          { n:'id',           t:'bigint', pk:true },
          { n:'page_id',      t:'bigint', fk:true },
          { n:'widget_type',  t:'text',   nl:true },
          { n:'widget_title', t:'text',   nl:true },
          { n:'widget_data',  t:'jsonb',  nl:true },
          { n:'created_at',   t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Donations', color: C.donations,
    tables: [
      { name: 'page_donations',
        columns: [
          { n:'id',                      t:'bigint',      pk:true },
          { n:'donor_id',                t:'bigint',      fk:true, nl:true },
          { n:'page_id',                 t:'bigint',      fk:true },
          { n:'user_id',                 t:'uuid',         fk:true, nl:true },
          { n:'amount',                  t:'numeric(12,2)' },
          { n:'currency',                t:'text' },
          { n:'status',                  t:'text' },
          { n:'type',                    t:'text',         nl:true },
          { n:'designation',             t:'text',         nl:true },
          { n:'donor_first_name',        t:'text',         nl:true },
          { n:'donor_last_name',         t:'text',         nl:true },
          { n:'donor_email',             t:'text',         nl:true },
          { n:'stripe_payment_intent_id',t:'text',         nl:true },
          { n:'stripe_subscription_id',  t:'text',         nl:true },
          { n:'stripe_invoice_id',       t:'text',         nl:true },
          { n:'transaction_ref',         t:'text',         nl:true },
          { n:'created_at',              t:'timestamptz' },
        ]},
      { name: 'donation_receipts',
        columns: [
          { n:'id',               t:'bigint', pk:true },
          { n:'page_donation_id', t:'bigint', fk:true },
          { n:'donor_id',         t:'bigint', fk:true, nl:true },
          { n:'amount',           t:'numeric' },
          { n:'currency',         t:'text' },
          { n:'receipt_number',   t:'text' },
          { n:'issued_at',        t:'timestamptz' },
          { n:'sent_at',          t:'timestamptz', nl:true },
          { n:'delivery_status',  t:'text' },
          { n:'created_at',       t:'timestamptz' },
        ]},
    ]
  },
];

const PAGE2_GROUPS = [
  {
    label: 'Prayers', color: C.prayers,
    tables: [
      { name: 'prayers',
        columns: [
          { n:'id',           t:'bigint', pk:true },
          { n:'user_id',      t:'uuid',   fk:true },
          { n:'page_id',      t:'bigint', fk:true, nl:true },
          { n:'title',        t:'text',   nl:true },
          { n:'body',         t:'text' },
          { n:'visibility',   t:'text' },
          { n:'is_published', t:'boolean' },
          { n:'amen_count',   t:'integer' },
          { n:'update_count', t:'integer' },
          { n:'share_count',  t:'integer' },
          { n:'deleted_at',   t:'timestamptz', nl:true },
          { n:'created_at',   t:'timestamptz' },
          { n:'updated_at',   t:'timestamptz' },
        ]},
      { name: 'prayer_reactions',
        columns: [
          { n:'id',         t:'bigint', pk:true },
          { n:'user_id',    t:'uuid',   fk:true },
          { n:'prayer_id',  t:'bigint', fk:true },
          { n:'type',       t:'text' },
          { n:'created_at', t:'timestamptz' },
        ]},
      { name: 'prayer_updates',
        columns: [
          { n:'id',         t:'bigint', pk:true },
          { n:'user_id',    t:'uuid',   fk:true },
          { n:'prayer_id',  t:'bigint', fk:true },
          { n:'body',       t:'text' },
          { n:'created_at', t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Follow System', color: C.social,
    tables: [
      { name: 'missionary_followers',
        columns: [
          { n:'id',            t:'bigint', pk:true },
          { n:'missionary_id', t:'bigint', fk:true },
          { n:'user_id',       t:'uuid',   fk:true },
          { n:'status',        t:'text' },
          { n:'note',          t:'text', nl:true },
          { n:'requested_at',  t:'timestamptz' },
          { n:'reviewed_at',   t:'timestamptz', nl:true },
          { n:'created_at',    t:'timestamptz' },
        ]},
      { name: 'church_followers',
        columns: [
          { n:'id',           t:'bigint', pk:true },
          { n:'church_id',    t:'bigint', fk:true },
          { n:'user_id',      t:'uuid',   fk:true },
          { n:'status',       t:'text' },
          { n:'note',         t:'text', nl:true },
          { n:'requested_at', t:'timestamptz' },
          { n:'created_at',   t:'timestamptz' },
        ]},
      { name: 'missionary_missionary_followers',
        columns: [
          { n:'id',                     t:'bigint', pk:true },
          { n:'followed_missionary_id', t:'bigint', fk:true },
          { n:'follower_missionary_id', t:'bigint', fk:true },
          { n:'status',                 t:'text' },
          { n:'note',                   t:'text', nl:true },
          { n:'created_at',             t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Connections & Alerts', color: C.social,
    tables: [
      { name: 'missionary_churches',
        columns: [
          { n:'id',                t:'bigint', pk:true },
          { n:'missionary_id',     t:'bigint', fk:true },
          { n:'church_id',         t:'bigint', fk:true },
          { n:'relationship_type', t:'text' },
          { n:'is_active',         t:'boolean' },
          { n:'created_at',        t:'timestamptz' },
        ]},
      { name: 'notifications',
        columns: [
          { n:'id',                  t:'bigint', pk:true },
          { n:'user_id',             t:'uuid',   fk:true },
          { n:'type',                t:'text' },
          { n:'title',               t:'text' },
          { n:'message',             t:'text',   nl:true },
          { n:'is_read',             t:'boolean' },
          { n:'related_entity_type', t:'text',   nl:true },
          { n:'related_entity_id',   t:'bigint', nl:true },
          { n:'created_at',          t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Direct Messaging', color: C.messaging,
    tables: [
      { name: 'conversations',
        columns: [
          { n:'id',                   t:'bigint', pk:true },
          { n:'missionary_id',        t:'bigint', fk:true },
          { n:'supporter_id',         t:'uuid',   fk:true },
          { n:'last_message_at',      t:'timestamptz' },
          { n:'last_message_preview', t:'text',   nl:true },
          { n:'created_at',           t:'timestamptz' },
          { n:'updated_at',           t:'timestamptz' },
        ]},
      { name: 'conversation_members',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'conversation_id', t:'bigint', fk:true },
          { n:'user_id',         t:'uuid',   fk:true },
          { n:'unread_count',    t:'integer' },
          { n:'last_read_at',    t:'timestamptz' },
          { n:'created_at',      t:'timestamptz' },
        ]},
      { name: 'messages',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'conversation_id', t:'bigint', fk:true },
          { n:'sender_id',       t:'uuid',   fk:true },
          { n:'content',         t:'text' },
          { n:'is_read',         t:'boolean' },
          { n:'created_at',      t:'timestamptz' },
          { n:'updated_at',      t:'timestamptz' },
        ]},
      { name: 'message_reports',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'conversation_id', t:'bigint', fk:true },
          { n:'message_id',      t:'bigint', fk:true, nl:true },
          { n:'reported_by',     t:'uuid',   fk:true },
          { n:'reviewed_by',     t:'uuid',   fk:true, nl:true },
          { n:'report_type',     t:'text' },
          { n:'reason',          t:'text',   nl:true },
          { n:'status',          t:'text' },
          { n:'created_at',      t:'timestamptz' },
        ]},
    ]
  },
  {
    label: 'Homepage & Footer', color: C.homepage,
    tables: [
      { name: 'homepage_banners',
        columns: [
          { n:'id',              t:'bigint', pk:true },
          { n:'banner_type',     t:'text' },
          { n:'is_active',       t:'boolean' },
          { n:'display_order',   t:'integer' },
          { n:'location',        t:'text' },
          { n:'description',     t:'text' },
          { n:'image_url',       t:'text' },
          { n:'scroll_duration', t:'integer', nl:true },
          { n:'created_at',      t:'timestamptz' },
        ]},
      { name: 'homepage_settings',
        columns: [
          { n:'id',                   t:'bigint', pk:true },
          { n:'banner_type',          t:'text' },
          { n:'auto_scroll',          t:'boolean' },
          { n:'scroll_timing',        t:'integer' },
          { n:'show_nav_arrows',      t:'boolean' },
          { n:'show_pagination_dots', t:'boolean' },
          { n:'created_at',           t:'timestamptz' },
        ]},
      { name: 'footer_content',
        columns: [
          { n:'id',         t:'bigint', pk:true },
          { n:'page_type',  t:'text' },
          { n:'title',      t:'text' },
          { n:'content',    t:'text' },
          { n:'created_at', t:'timestamptz' },
          { n:'updated_at', t:'timestamptz' },
        ]},
    ]
  },
];

const RELATIONSHIPS = [
  ['users',                          'user_id',                   'auth.users',             'id'],
  ['users',                          'role',                      'user_roles',             'id'],
  ['supporter_profiles',             'user_id',                   'auth.users',             'id'],
  ['missionaries',                   'user_id',                   'auth.users',             'id'],
  ['missionaries',                   'agency_id',                 'agencies',               'id'],
  ['missionaries',                   'sending_church_id',         'churches',               'id'],
  ['missionaries',                   'mission_field_church_id',   'churches',               'id'],
  ['missionaries',                   'college_id',                'colleges',               'id'],
  ['agencies',                       'contact_user_id',           'auth.users',             'id'],
  ['churches',                       'contact_user_id',           'auth.users',             'id'],
  ['colleges',                       'contact_user_id',           'auth.users',             'id'],
  ['donors',                         'user_id',                   'auth.users',             'id'],
  ['pages',                          'organization_id (polymorphic)', 'missionaries/churches/agencies/colleges/donors', 'id'],
  ['page_approvals',                 'page_id',                   'pages',                  'id'],
  ['page_approvals',                 'requested_by',              'auth.users',             'id'],
  ['page_approvals',                 'approved_by',               'auth.users',             'id'],
  ['page_media',                     'page_id',                   'pages',                  'id'],
  ['page_widgets',                   'page_id',                   'pages',                  'id'],
  ['page_donations',                 'donor_id',                  'donors',                 'id'],
  ['page_donations',                 'page_id',                   'pages',                  'id'],
  ['page_donations',                 'user_id',                   'auth.users',             'id'],
  ['donation_receipts',              'page_donation_id',          'page_donations',         'id'],
  ['donation_receipts',              'donor_id',                  'donors',                 'id'],
  ['prayers',                        'user_id',                   'auth.users',             'id'],
  ['prayers',                        'page_id',                   'pages',                  'id'],
  ['prayer_reactions',               'user_id',                   'auth.users',             'id'],
  ['prayer_reactions',               'prayer_id',                 'prayers',                'id'],
  ['prayer_updates',                 'user_id',                   'auth.users',             'id'],
  ['prayer_updates',                 'prayer_id',                 'prayers',                'id'],
  ['missionary_followers',           'missionary_id',             'missionaries',           'id'],
  ['missionary_followers',           'user_id',                   'auth.users',             'id'],
  ['church_followers',               'church_id',                 'churches',               'id'],
  ['church_followers',               'user_id',                   'auth.users',             'id'],
  ['missionary_missionary_followers','followed_missionary_id',    'missionaries',           'id'],
  ['missionary_missionary_followers','follower_missionary_id',    'missionaries',           'id'],
  ['missionary_churches',            'missionary_id',             'missionaries',           'id'],
  ['missionary_churches',            'church_id',                 'churches',               'id'],
  ['notifications',                  'user_id',                   'auth.users',             'id'],
  ['conversations',                  'missionary_id',             'missionaries',           'id'],
  ['conversations',                  'supporter_id',              'auth.users',             'id'],
  ['conversation_members',           'conversation_id',           'conversations',          'id'],
  ['conversation_members',           'user_id',                   'auth.users',             'id'],
  ['messages',                       'conversation_id',           'conversations',          'id'],
  ['messages',                       'sender_id',                 'auth.users',             'id'],
  ['message_reports',                'conversation_id',           'conversations',          'id'],
  ['message_reports',                'message_id',                'messages',               'id'],
  ['message_reports',                'reported_by',               'auth.users',             'id'],
  ['message_reports',                'reviewed_by',               'auth.users',             'id'],
];

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function tableH(table) {
  return HEADER_H + table.columns.length * ROW_H + 1;
}

function drawTable(doc, x, y, table, color) {
  const w = TABLE_W;
  const h = tableH(table);

  // Header
  doc.rect(x, y, w, HEADER_H).fill(color);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(FS.header)
     .text(table.name, x + 5, y + 4, { width: w - 10, lineBreak: false });
  if (table.subtitle) {
    doc.fillColor('rgba(255,255,255,0.75)').font('Helvetica').fontSize(5.5)
       .text(table.subtitle, x + 5, y + 14, { width: w - 10, lineBreak: false });
  }

  // Rows
  table.columns.forEach((col, i) => {
    const ry  = y + HEADER_H + i * ROW_H;
    const bg  = col.pk ? C.pk_bg : col.fk ? C.fk_bg : (i % 2 ? C.alt_bg : '#fff');
    doc.rect(x, ry, w, ROW_H).fill(bg);

    // PK / FK badge
    if (col.pk || col.fk) {
      const tag  = col.pk ? 'PK' : 'FK';
      const tclr = col.pk ? C.pk_ind : C.fk_ind;
      doc.fillColor(tclr).font('Helvetica-Bold').fontSize(5)
         .text(tag, x + 2, ry + 4, { lineBreak: false });
    }

    // Name
    const nx   = (col.pk || col.fk) ? x + 18 : x + 5;
    const nclr = col.pk ? C.pk_ind : C.text;
    const nfnt = col.pk ? 'Helvetica-Bold' : 'Helvetica';
    doc.fillColor(nclr).font(nfnt).fontSize(FS.col)
       .text(col.n, nx, ry + 3, { width: 118, lineBreak: false });

    // Type
    const tStr = col.t + (col.nl ? '?' : '');
    doc.fillColor(C.type_c).font('Helvetica').fontSize(FS.type)
       .text(tStr, x + 138, ry + 4, { width: 66, lineBreak: false, align: 'right' });
  });

  // Outer border
  doc.rect(x, y, w, h).lineWidth(0.5).stroke(C.border);
  // Header bottom
  doc.moveTo(x, y + HEADER_H).lineTo(x + w, y + HEADER_H)
     .lineWidth(0.5).stroke(C.border);
  // Row dividers
  for (let i = 1; i < table.columns.length; i++) {
    const ry = y + HEADER_H + i * ROW_H;
    doc.moveTo(x, ry).lineTo(x + w, ry)
       .lineWidth(0.25).stroke('#E5E7EB');
  }
}

function drawGroup(doc, x, yStart, group) {
  // Group label strip
  doc.rect(x - 2, yStart, TABLE_W + 4, 15)
     .fill(group.color + '20');
  doc.fillColor(group.color).font('Helvetica-Bold').fontSize(FS.group)
     .text(group.label.toUpperCase(), x + 2, yStart + 3, { width: TABLE_W, lineBreak: false });

  let y = yStart + 18;
  for (const table of group.tables) {
    drawTable(doc, x, y, table, group.color);
    y += tableH(table) + TABLE_GAP;
  }
}

function drawPageHeader(doc, subtitle) {
  doc.rect(0, 0, PAGE_W, 38).fill('#1E3A5F');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(FS.title)
     .text('Harvest 21 — Database Entity Relationship Diagram', PAGE_MX, 8);
  doc.fillColor('#93C5FD').font('Helvetica').fontSize(FS.subtitle)
     .text(subtitle, PAGE_MX, 25);
  const dateStr = `Generated: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`;
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(FS.subtitle)
     .text(dateStr, PAGE_W - PAGE_MX - 230, 25, { width: 230, align: 'right' });
}

function drawLegend(doc, x, y) {
  doc.rect(x, y, 170, 52).fill('#F8FAFC').lineWidth(0.5).stroke(C.border);
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(6.5)
     .text('LEGEND', x + 6, y + 5);
  const items = [
    { bg: C.pk_bg, label: 'PK  Primary Key',   clr: C.pk_ind },
    { bg: C.fk_bg, label: 'FK  Foreign Key',   clr: C.fk_ind },
    { bg: C.alt_bg,label: '?   Nullable field', clr: C.type_c },
  ];
  items.forEach((it, i) => {
    const iy = y + 16 + i * 11;
    doc.rect(x + 6, iy, 8, 7).fill(it.bg).lineWidth(0.3).stroke(C.border);
    doc.fillColor(it.clr).font('Helvetica').fontSize(6.5)
       .text(it.label, x + 18, iy + 1, { lineBreak: false });
  });
}

function drawRelationshipsPage(doc) {
  doc.addPage({ size: 'A4', layout: 'portrait', margin: 0 });

  doc.rect(0, 0, 595, 38).fill('#1E3A5F');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(14)
     .text('Harvest 21 — Foreign Key Relationships Reference', 20, 12);

  const COL_X = [20, 170, 310, 440];
  const HDR   = ['Table', 'FK Column', 'References', 'Target'];
  const ROW   = 11;
  let y = 50;

  // Table header row
  doc.rect(15, y, 565, 14).fill('#374151');
  HDR.forEach((h, i) => {
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7)
       .text(h, COL_X[i], y + 4, { lineBreak: false });
  });
  y += 14;

  RELATIONSHIPS.forEach((rel, idx) => {
    if (y > 770) { return; } // safety – all rows fit on A4
    const bg = idx % 2 ? '#F9FAFB' : '#fff';
    doc.rect(15, y, 565, ROW).fill(bg);
    const vals  = [rel[0], rel[1], rel[2], rel[3]];
    const clrs  = [C.text, C.fk_ind, C.text, C.text];
    const widths= [145, 135, 125, 120];
    vals.forEach((v, j) => {
      doc.fillColor(clrs[j]).font('Helvetica').fontSize(6.5)
         .text(v, COL_X[j], y + 2, { lineBreak: false, width: widths[j] });
    });
    y += ROW;
  });

  // Border around whole table
  doc.rect(15, 64, 565, RELATIONSHIPS.length * ROW + 14)
     .lineWidth(0.5).stroke(C.border);

  // Footer notes
  y += 16;
  doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(6.5).text(
    'Note: page_donations stores denormalized donor fields (donor_first_name, donor_last_name, donor_email) to ensure billing data is preserved with each transaction.',
    20, y, { width: 555 }
  );
  y += 18;
  doc.text(
    'The pages table uses a polymorphic pattern: organization_type (missionary | church | agency | college | donor) combined with organization_id references the corresponding entity table.',
    20, y, { width: 555 }
  );
  y += 18;
  doc.fillColor('#1D4ED8').font('Helvetica-Bold').fontSize(6.5)
     .text('Domain colour key:', 20, y);
  const domains = [
    { clr: C.identity,  label: 'Identity & Auth' },
    { clr: C.orgs,      label: 'Organizations' },
    { clr: C.pages,     label: 'Pages' },
    { clr: C.donations, label: 'Donations' },
    { clr: C.prayers,   label: 'Prayers' },
    { clr: C.social,    label: 'Social / Follow' },
    { clr: C.messaging, label: 'Messaging' },
    { clr: C.homepage,  label: 'Homepage / Footer' },
  ];
  y += 10;
  domains.forEach((d, i) => {
    const dx = 20 + i * 68;
    doc.rect(dx, y, 8, 7).fill(d.clr);
    doc.fillColor(C.text).font('Helvetica').fontSize(6)
       .text(d.label, dx + 11, y + 1, { lineBreak: false });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function generate() {
  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: true });

  const outDir  = path.join(__dirname, 'docs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'h21-database-erd.pdf');
  const stream  = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const colX = [0,1,2,3,4].map(i => PAGE_MX + i * (TABLE_W + COL_GAP));

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  drawPageHeader(doc, 'Page 1 of 3  —  Core Schema: Identity · Organizations · Pages · Donations');
  PAGE1_GROUPS.forEach((g, i) => drawGroup(doc, colX[i], CONTENT_Y, g));
  drawLegend(doc, PAGE_W - PAGE_MX - 172, CONTENT_Y);

  // ── Page 2 ──────────────────────────────────────────────────────────────────
  doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
  drawPageHeader(doc, 'Page 2 of 3  —  Extended Schema: Prayers · Social · Messaging · Homepage');
  PAGE2_GROUPS.forEach((g, i) => drawGroup(doc, colX[i], CONTENT_Y, g));
  drawLegend(doc, PAGE_W - PAGE_MX - 172, CONTENT_Y);

  // ── Page 3 (A4 portrait — relationships) ────────────────────────────────────
  drawRelationshipsPage(doc);

  doc.end();
  stream.on('finish', () => console.log('✅  ERD saved →', outPath));
  stream.on('error',  (e) => { console.error('❌  Write error:', e); process.exit(1); });
}

generate();
