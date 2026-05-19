'use strict';
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');

// ─── Page & layout ────────────────────────────────────────────────────────────
const PW = 595, PH = 842;   // A4 portrait
const ML = 40, MR = 40, MT = 40;
const CW = PW - ML - MR;    // 515

// Column widths for the attribute table
const CX = {
  name:    ML,
  type:    ML + 140,
  null:    ML + 225,
  key:     ML + 257,
  def:     ML + 293,
  desc:    ML + 363,
};
const CWW = { name:140, type:85, null:32, key:36, def:70, desc:CW-(363-ML) };

const ROW_H    = 13;
const HDR_H    = 15;
const SEC_H    = 20;   // section (table name) banner
const FONT     = { title:18, h1:11, h2:9, body:8, small:7, tblhdr:7.5, cell:7 };

// Domain colours (header band per table)
const DOMAIN = {
  'auth.users':                      '#1E3A5F',
  users:                             '#1D4ED8',
  user_roles:                        '#1D4ED8',
  supporter_profiles:                '#1D4ED8',
  missionaries:                      '#065F46',
  agencies:                          '#065F46',
  churches:                          '#065F46',
  colleges:                          '#065F46',
  donors:                            '#1D4ED8',
  pages:                             '#5B21B6',
  page_approvals:                    '#5B21B6',
  page_media:                        '#5B21B6',
  page_widgets:                      '#5B21B6',
  page_donations:                    '#991B1B',
  donation_receipts:                 '#991B1B',
  prayers:                           '#92400E',
  prayer_reactions:                  '#92400E',
  prayer_updates:                    '#92400E',
  missionary_followers:              '#9D174D',
  church_followers:                  '#9D174D',
  missionary_missionary_followers:   '#9D174D',
  missionary_churches:               '#9D174D',
  notifications:                     '#9D174D',
  conversations:                     '#0C4A6E',
  conversation_members:              '#0C4A6E',
  messages:                          '#0C4A6E',
  message_reports:                   '#0C4A6E',
  homepage_banners:                  '#1F2937',
  homepage_settings:                 '#1F2937',
  footer_content:                    '#1F2937',
};

// ─── Schema: full data dictionary ─────────────────────────────────────────────
// Each column: { name, type, null, key, default, desc }
const SCHEMA = [
  {
    table: 'auth.users',
    domain: 'Auth & Identity',
    desc: 'Supabase managed authentication table. Stores all authenticated user credentials and session data. This is an external Supabase table and should not be modified directly. All other user-facing tables reference this via user_id (UUID).',
    cols: [
      { name:'id',               type:'uuid',        null:'N', key:'PK',  def:'gen_random_uuid()', desc:'Unique user identifier (UUID), primary key for auth system.' },
      { name:'email',            type:'text',        null:'Y', key:'',    def:'',                  desc:'User\'s email address used for authentication.' },
      { name:'created_at',       type:'timestamptz', null:'Y', key:'',    def:'now()',              desc:'Timestamp when the auth account was created.' },
      { name:'email_confirmed_at',type:'timestamptz',null:'Y', key:'',    def:'',                  desc:'Timestamp of email verification confirmation.' },
      { name:'raw_app_meta_data',type:'jsonb',       null:'Y', key:'',    def:'',                  desc:'Provider and providers list (e.g. email, google).' },
    ]
  },
  {
    table: 'users',
    domain: 'Auth & Identity',
    desc: 'Application-level user profile table. Extends auth.users with role, status, and display information. Every person who logs in should have a corresponding record here. The role field controls access permissions across the platform.',
    cols: [
      { name:'id',           type:'bigint',      null:'N', key:'PK', def:'identity',  desc:'Auto-incrementing surrogate primary key.' },
      { name:'user_id',      type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Links app profile to auth account.' },
      { name:'role',         type:'smallint',    null:'Y', key:'FK', def:'',          desc:'References user_roles.id. Controls platform access level.' },
      { name:'status',       type:'varchar',     null:'Y', key:'',   def:'Pending',   desc:'Account status: Pending, Active, Suspended, Inactive.' },
      { name:'first_name',   type:'varchar',     null:'Y', key:'',   def:'',          desc:'User\'s first name for display purposes.' },
      { name:'last_name',    type:'varchar',     null:'Y', key:'',   def:'',          desc:'User\'s last name for display purposes.' },
      { name:'email',        type:'text',        null:'N', key:'',   def:'',          desc:'Email address (copied from auth for quick lookup).' },
      { name:'last_activity',type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp of the user\'s most recent platform activity.' },
      { name:'created_at',   type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp when the user profile was created.' },
    ]
  },
  {
    table: 'user_roles',
    domain: 'Auth & Identity',
    desc: 'Lookup table defining available user roles on the platform. Role IDs are referenced by users.role. Example values: 1 = Admin, 2 = Staff, 3 = Missionary, 4 = Donor, 5 = Church, 6 = Agency.',
    cols: [
      { name:'id',   type:'bigint',  null:'N', key:'PK', def:'identity', desc:'Unique role identifier. Referenced by users.role.' },
      { name:'role', type:'varchar', null:'Y', key:'',   def:'',         desc:'Human-readable role label (e.g. Admin, Missionary, Donor).' },
    ]
  },
  {
    table: 'supporter_profiles',
    domain: 'Auth & Identity',
    desc: 'Profile records specifically for supporter-type users (donors/followers who are not missionaries). Created when a supporter completes their profile. Stores contact information required for engagement and communication.',
    cols: [
      { name:'id',                   type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key.' },
      { name:'user_id',              type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. One-to-one with auth account.' },
      { name:'first_name',           type:'text',        null:'N', key:'',   def:'',          desc:'Supporter\'s first name. Required field.' },
      { name:'last_name',            type:'text',        null:'N', key:'',   def:'',          desc:'Supporter\'s last name. Required field.' },
      { name:'email',                type:'text',        null:'N', key:'',   def:'',          desc:'Supporter\'s email address. Must be valid email format.' },
      { name:'country_of_residence', type:'text',        null:'N', key:'',   def:'',          desc:'Country where the supporter currently resides.' },
      { name:'phone_number',         type:'text',        null:'Y', key:'',   def:'',          desc:'Optional phone number for contact purposes.' },
      { name:'created_at',           type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp when the profile was created.' },
      { name:'updated_at',           type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp of the last profile update.' },
    ]
  },
  {
    table: 'missionaries',
    domain: 'Organizations',
    desc: 'Central entity for missionary profiles. Each missionary has a user account and belongs to one or more organizations (agency, sending church, mission field church, college). Contains mission field information, Stripe Connect details for payouts, and messaging preferences.',
    cols: [
      { name:'id',                      type:'bigint',      null:'N', key:'PK', def:'identity',     desc:'Auto-incrementing surrogate primary key.' },
      { name:'user_id',                 type:'uuid',        null:'Y', key:'FK', def:'',              desc:'References auth.users.id. Links missionary to login account.' },
      { name:'agency_id',               type:'bigint',      null:'Y', key:'FK', def:'',              desc:'References agencies.id. Mission agency the missionary belongs to.' },
      { name:'sending_church_id',       type:'bigint',      null:'Y', key:'FK', def:'',              desc:'References churches.id. Home/sending church of the missionary.' },
      { name:'mission_field_church_id', type:'bigint',      null:'Y', key:'FK', def:'',              desc:'References churches.id. Church on the mission field (if applicable).' },
      { name:'college_id',              type:'bigint',      null:'Y', key:'FK', def:'',              desc:'References colleges.id. Bible college or seminary attended.' },
      { name:'first_name',              type:'varchar',     null:'N', key:'',   def:'',              desc:'Missionary\'s first name. Required.' },
      { name:'last_name',               type:'varchar',     null:'N', key:'',   def:'',              desc:'Missionary\'s last name. Required.' },
      { name:'email',                   type:'text',        null:'Y', key:'UQ', def:'',              desc:'Contact email. Unique across all missionaries.' },
      { name:'phone_number',            type:'varchar',     null:'Y', key:'',   def:'',              desc:'Contact phone number.' },
      { name:'country_of_residence',    type:'varchar',     null:'Y', key:'',   def:'',              desc:'Country where the missionary currently lives.' },
      { name:'destination_country',     type:'varchar',     null:'Y', key:'',   def:'',              desc:'Country or region of missionary service.' },
      { name:'mission_status',          type:'varchar',     null:'Y', key:'',   def:'',              desc:'Current status: On-Field, Furlough, or Deputation.' },
      { name:'biography',               type:'text',        null:'Y', key:'',   def:'',              desc:'Personal biography/testimony displayed on the profile page.' },
      { name:'open_to_visits',          type:'boolean',     null:'Y', key:'',   def:'false',         desc:'Whether the missionary accepts in-person visits from supporters.' },
      { name:'allow_direct_messages',   type:'boolean',     null:'Y', key:'',   def:'true',          desc:'Whether the missionary accepts direct messages from supporters.' },
      { name:'stripe_account_id',       type:'text',        null:'Y', key:'',   def:'',              desc:'Stripe Connect account ID for direct payouts to the missionary.' },
      { name:'payout_status',           type:'text',        null:'Y', key:'',   def:'not_started',   desc:'Stripe payout onboarding status: not_started, pending, enabled, restricted, incomplete.' },
      { name:'payout_setup_completed_at',type:'timestamptz',null:'Y', key:'',   def:'',              desc:'Timestamp when Stripe Connect onboarding was completed.' },
      { name:'created_at',              type:'timestamptz', null:'Y', key:'',   def:'now()',          desc:'Timestamp when the missionary record was created.' },
    ]
  },
  {
    table: 'agencies',
    domain: 'Organizations',
    desc: 'Mission agencies that oversee and support missionaries. An agency can be associated with multiple missionaries. The contact_user_id identifies the agency administrator who manages the agency account on the platform.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key.' },
      { name:'contact_user_id', type:'uuid',        null:'Y', key:'FK', def:'',         desc:'References auth.users.id. Primary admin contact for the agency.' },
      { name:'name',            type:'varchar',     null:'N', key:'',   def:'',         desc:'Official agency name. Required.' },
      { name:'email',           type:'text',        null:'Y', key:'',   def:'',         desc:'Agency contact email address.' },
      { name:'phone_number',    type:'varchar',     null:'Y', key:'',   def:'',         desc:'Agency main phone number.' },
      { name:'address',         type:'text',        null:'Y', key:'',   def:'',         desc:'Street address of the agency headquarters.' },
      { name:'city',            type:'varchar',     null:'Y', key:'',   def:'',         desc:'City of the agency headquarters.' },
      { name:'state',           type:'varchar',     null:'Y', key:'',   def:'',         desc:'State or province of the agency.' },
      { name:'country',         type:'varchar',     null:'Y', key:'',   def:'',         desc:'Country of the agency headquarters.' },
      { name:'website',         type:'text',        null:'Y', key:'',   def:'',         desc:'Agency website URL.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',    desc:'Timestamp when the agency was added to the platform.' },
    ]
  },
  {
    table: 'churches',
    domain: 'Organizations',
    desc: 'Church organizations that partner with missionaries as sending or supporting churches. A church can send multiple missionaries and can follow missionary activity. Churches can have their own landing pages on the platform.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key.' },
      { name:'contact_user_id', type:'uuid',        null:'Y', key:'FK', def:'',         desc:'References auth.users.id. Primary admin contact for the church.' },
      { name:'name',            type:'varchar',     null:'N', key:'',   def:'',         desc:'Official church name. Required.' },
      { name:'phone_number',    type:'varchar',     null:'Y', key:'',   def:'',         desc:'Church main phone number.' },
      { name:'address',         type:'text',        null:'Y', key:'',   def:'',         desc:'Street address of the church.' },
      { name:'city',            type:'varchar',     null:'Y', key:'',   def:'',         desc:'City where the church is located.' },
      { name:'state',           type:'varchar',     null:'Y', key:'',   def:'',         desc:'State or province where the church is located.' },
      { name:'country',         type:'varchar',     null:'Y', key:'',   def:'',         desc:'Country where the church is located.' },
      { name:'website',         type:'text',        null:'Y', key:'',   def:'',         desc:'Church website URL.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',    desc:'Timestamp when the church was added to the platform.' },
    ]
  },
  {
    table: 'colleges',
    domain: 'Organizations',
    desc: 'Bible colleges and seminaries associated with missionaries\' training. A missionary may list their college as part of their profile. Colleges can be managed by an admin contact user.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key.' },
      { name:'contact_user_id', type:'uuid',        null:'Y', key:'FK', def:'',         desc:'References auth.users.id. Admin contact for the college.' },
      { name:'name',            type:'varchar',     null:'N', key:'',   def:'',         desc:'Official college name. Required.' },
      { name:'email',           type:'text',        null:'Y', key:'',   def:'',         desc:'College contact email.' },
      { name:'phone_number',    type:'varchar',     null:'Y', key:'',   def:'',         desc:'College main phone number.' },
      { name:'address',         type:'text',        null:'Y', key:'',   def:'',         desc:'Street address of the college.' },
      { name:'city',            type:'varchar',     null:'Y', key:'',   def:'',         desc:'City where the college is located.' },
      { name:'country',         type:'varchar',     null:'Y', key:'',   def:'',         desc:'Country where the college is located.' },
      { name:'website',         type:'text',        null:'Y', key:'',   def:'',         desc:'College website URL.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',    desc:'Timestamp when the college was added to the platform.' },
    ]
  },
  {
    table: 'donors',
    domain: 'Auth & Identity',
    desc: 'Donor profile records for individuals who make financial contributions. Linked to auth.users for authenticated donors. Anonymous donations may create a donor record without a user_id. Tracks Stripe customer data and total donated amount for reporting.',
    cols: [
      { name:'id',                 type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'user_id',            type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Null for guest/anonymous donors.' },
      { name:'first_name',         type:'text',        null:'N', key:'',   def:'',          desc:'Donor\'s first name. Required.' },
      { name:'last_name',          type:'text',        null:'N', key:'',   def:'',          desc:'Donor\'s last name. Required.' },
      { name:'email',              type:'text',        null:'Y', key:'UQ', def:'',          desc:'Donor email. Unique constraint — one donor profile per email.' },
      { name:'phone_number',       type:'text',        null:'Y', key:'',   def:'',          desc:'Donor\'s phone number for contact.' },
      { name:'country',            type:'text',        null:'Y', key:'',   def:'',          desc:'Donor\'s country of residence.' },
      { name:'city',               type:'text',        null:'Y', key:'',   def:'',          desc:'Donor\'s city of residence.' },
      { name:'address',            type:'text',        null:'Y', key:'',   def:'',          desc:'Donor\'s mailing address.' },
      { name:'postal_code',        type:'text',        null:'Y', key:'',   def:'',          desc:'Donor\'s postal / zip code.' },
      { name:'organization_name',  type:'text',        null:'Y', key:'',   def:'',          desc:'Organization name if donating on behalf of a group or church.' },
      { name:'stripe_customer_id', type:'text',        null:'Y', key:'',   def:'',          desc:'Stripe customer ID for managing payment methods and subscriptions.' },
      { name:'donation_preference',type:'text',        null:'Y', key:'',   def:'',          desc:'Donor\'s preferred giving frequency (one_time, monthly, etc.).' },
      { name:'total_donated',      type:'numeric(12,2)',null:'Y', key:'',  def:'0',          desc:'Cumulative total donated amount across all transactions (USD).' },
      { name:'is_active',          type:'boolean',     null:'Y', key:'',   def:'true',       desc:'Whether the donor profile is currently active.' },
      { name:'updated_at',         type:'timestamptz', null:'Y', key:'',   def:'now()',      desc:'Timestamp of last profile update.' },
      { name:'created_at',         type:'timestamptz', null:'Y', key:'',   def:'now()',      desc:'Timestamp when the donor profile was created.' },
    ]
  },
  {
    table: 'pages',
    domain: 'Pages',
    desc: 'Public-facing profile pages for all organization types (missionary, church, agency, college, donor). Uses a polymorphic relationship: organization_type identifies the entity type and organization_id points to the corresponding table\'s primary key. Each entity type can have at most one page (enforced by unique constraint). Controls the donation mode per page.',
    cols: [
      { name:'id',                    type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'organization_type',     type:'text',        null:'N', key:'',   def:'',          desc:'Entity type: missionary | church | college | agency | donor.' },
      { name:'organization_id',       type:'bigint',      null:'N', key:'',   def:'',          desc:'ID of the entity in the corresponding organization table (polymorphic FK).' },
      { name:'page_url',              type:'text',        null:'Y', key:'UQ', def:'',          desc:'URL-friendly slug for the public profile page. Globally unique.' },
      { name:'profile_photo_url',     type:'text',        null:'Y', key:'',   def:'',          desc:'Storage URL for the profile/avatar photo.' },
      { name:'banner_photo_url',      type:'text',        null:'Y', key:'',   def:'',          desc:'Storage URL for the header banner image.' },
      { name:'short_quote',           type:'text',        null:'Y', key:'',   def:'',          desc:'A short tagline or scripture verse displayed prominently.' },
      { name:'about_text',            type:'text',        null:'Y', key:'',   def:'',          desc:'Full about/biography text for the profile page.' },
      { name:'intro_text',            type:'text',        null:'Y', key:'',   def:'',          desc:'Short introductory text shown on preview cards.' },
      { name:'is_published',          type:'boolean',     null:'Y', key:'',   def:'false',     desc:'Whether the page is publicly visible. Must be approved to publish.' },
      { name:'donation_mode',         type:'text',        null:'Y', key:'',   def:'',          desc:'Controls donations: harvest21 (platform), external (redirect URL), off (disabled).' },
      { name:'external_donation_url', type:'text',        null:'Y', key:'',   def:'',          desc:'External donation URL used when donation_mode = external.' },
      { name:'published_at',          type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp when the page was first published.' },
      { name:'created_at',            type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the page record was created.' },
      { name:'updated_at',            type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of the last page update.' },
    ]
  },
  {
    table: 'page_approvals',
    domain: 'Pages',
    desc: 'Tracks the approval workflow for publishing profile pages. A page must go through agency approval before being published. Status progresses from Pending → Agency Approved → Published. Admins can also Unpublish a page.',
    cols: [
      { name:'id',          type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'page_id',     type:'bigint',      null:'N', key:'FK', def:'',          desc:'References pages.id. Cascades on delete.' },
      { name:'requested_by',type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. User who submitted the page for approval.' },
      { name:'approved_by', type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Admin/agency who approved or rejected.' },
      { name:'status',      type:'text',        null:'Y', key:'',   def:'Pending',   desc:'Workflow status: Pending | Agency Approved | Published | Unpublished.' },
      { name:'reviewed_at', type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp when the approval decision was made.' },
      { name:'created_at',  type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the approval request was submitted.' },
    ]
  },
  {
    table: 'page_media',
    domain: 'Pages',
    desc: 'Media assets (images and videos) associated with a profile page. Supports multiple media items per page displayed in a gallery. Media is only visible to public when the parent page is published.',
    cols: [
      { name:'id',            type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'page_id',       type:'bigint',      null:'N', key:'FK', def:'',          desc:'References pages.id. Cascades on delete.' },
      { name:'media_type',    type:'text',        null:'Y', key:'',   def:'',          desc:'Asset type: image or video.' },
      { name:'media_url',     type:'text',        null:'N', key:'',   def:'',          desc:'Storage or CDN URL of the media asset.' },
      { name:'description',   type:'text',        null:'Y', key:'',   def:'',          desc:'Caption or description for the media item.' },
      { name:'thumbnail_url', type:'text',        null:'Y', key:'',   def:'',          desc:'URL of the video thumbnail image (for video type).' },
      { name:'views',         type:'integer',     null:'Y', key:'',   def:'',          desc:'View count for this media item.' },
      { name:'reactions',     type:'integer',     null:'Y', key:'',   def:'',          desc:'Reaction/like count for this media item.' },
      { name:'created_at',    type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the media was uploaded.' },
      { name:'updated_at',    type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp of the last media metadata update.' },
    ]
  },
  {
    table: 'page_widgets',
    domain: 'Pages',
    desc: 'Configurable content widgets displayed on a profile page. Widgets can display custom content sections such as prayer requests, ministry updates, or fundraising goals. Widget configuration is stored as JSONB for flexibility.',
    cols: [
      { name:'id',           type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'page_id',      type:'bigint',      null:'N', key:'FK', def:'',          desc:'References pages.id. Cascades on delete.' },
      { name:'widget_type',  type:'text',        null:'Y', key:'',   def:'',          desc:'Widget category identifier (e.g. prayer_list, update_feed, goal_tracker).' },
      { name:'widget_title', type:'text',        null:'Y', key:'',   def:'',          desc:'Display title shown above the widget on the profile page.' },
      { name:'widget_data',  type:'jsonb',       null:'Y', key:'',   def:'',          desc:'Flexible JSON configuration and content data for the widget.' },
      { name:'created_at',   type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the widget was added to the page.' },
    ]
  },
  {
    table: 'page_donations',
    domain: 'Donations',
    desc: 'Records every donation transaction made through the platform. Supports both one-time and recurring donations via Stripe. Contains denormalized donor name and email fields (donor_first_name, donor_last_name, donor_email) captured at transaction time to preserve billing intent regardless of profile changes. The optional designation field allows donors to earmark gifts for specific projects.',
    cols: [
      { name:'id',                       type:'bigint',       null:'N', key:'PK', def:'identity',   desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'donor_id',                 type:'bigint',       null:'Y', key:'FK', def:'',            desc:'References donors.id. Null for anonymous donations. Cascades to null on donor delete.' },
      { name:'page_id',                  type:'bigint',       null:'N', key:'FK', def:'',            desc:'References pages.id. The missionary/org page that received the donation.' },
      { name:'user_id',                  type:'uuid',         null:'Y', key:'FK', def:'',            desc:'References auth.users.id. Authenticated user who made the donation (nullable for guests).' },
      { name:'amount',                   type:'numeric(12,2)',null:'N', key:'',   def:'',            desc:'Donation amount in the specified currency (e.g. 25.00).' },
      { name:'currency',                 type:'text',         null:'Y', key:'',   def:'USD',         desc:'ISO 4217 currency code. Defaults to USD.' },
      { name:'transaction_ref',          type:'text',         null:'Y', key:'',   def:'',            desc:'Legacy or external transaction reference number.' },
      { name:'status',                   type:'text',         null:'Y', key:'',   def:'Pending',     desc:'Transaction status: Pending | Complete | Failed | Refunded | Disputed.' },
      { name:'type',                     type:'text',         null:'Y', key:'',   def:'one_time',    desc:'Donation type: one_time (single charge) or recurring (subscription).' },
      { name:'stripe_payment_intent_id', type:'text',         null:'Y', key:'',   def:'',            desc:'Stripe PaymentIntent ID for one-time donations. Used for webhook reconciliation.' },
      { name:'stripe_subscription_id',   type:'text',         null:'Y', key:'',   def:'',            desc:'Stripe Subscription ID for recurring donations.' },
      { name:'stripe_invoice_id',        type:'text',         null:'Y', key:'',   def:'',            desc:'Stripe Invoice ID associated with a recurring donation cycle.' },
      { name:'designation',              type:'text',         null:'Y', key:'',   def:'',            desc:'Optional donor-specified label for the gift (max 50 chars). E.g. "Kenya Church Plant".' },
      { name:'donor_first_name',         type:'text',         null:'Y', key:'',   def:'',            desc:'First name from billing form at donation time (denormalized snapshot).' },
      { name:'donor_last_name',          type:'text',         null:'Y', key:'',   def:'',            desc:'Last name from billing form at donation time (denormalized snapshot).' },
      { name:'donor_email',              type:'text',         null:'Y', key:'',   def:'',            desc:'Email from billing form at donation time (denormalized snapshot).' },
      { name:'created_at',               type:'timestamptz',  null:'Y', key:'',   def:'now()',       desc:'Timestamp when the donation record was created.' },
    ]
  },
  {
    table: 'donation_receipts',
    domain: 'Donations',
    desc: 'Official receipt records generated for each completed donation. Each receipt has a unique receipt number for accounting. Tracks delivery status of the emailed receipt to the donor. Linked to both the donation transaction and the donor profile.',
    cols: [
      { name:'id',               type:'bigint',       null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'page_donation_id', type:'bigint',       null:'N', key:'FK', def:'',          desc:'References page_donations.id. The transaction this receipt covers.' },
      { name:'donor_id',         type:'bigint',       null:'Y', key:'FK', def:'',          desc:'References donors.id. The donor who receives this receipt.' },
      { name:'amount',           type:'numeric',      null:'N', key:'',   def:'',          desc:'Amount shown on the receipt (matches donation amount).' },
      { name:'currency',         type:'text',         null:'N', key:'',   def:'USD',       desc:'Currency code for the receipt amount.' },
      { name:'receipt_number',   type:'text',         null:'N', key:'UQ', def:'',          desc:'Unique human-readable receipt number for accounting reference.' },
      { name:'issued_at',        type:'timestamptz',  null:'N', key:'',   def:'now()',     desc:'Timestamp when the receipt was formally issued.' },
      { name:'sent_at',          type:'timestamptz',  null:'Y', key:'',   def:'',          desc:'Timestamp when the receipt email was sent to the donor.' },
      { name:'delivery_status',  type:'text',         null:'Y', key:'',   def:'pending',   desc:'Email delivery status: pending | sent | delivered | failed.' },
      { name:'created_at',       type:'timestamptz',  null:'N', key:'',   def:'now()',     desc:'Timestamp when the receipt record was created.' },
    ]
  },
  {
    table: 'prayers',
    domain: 'Prayers',
    desc: 'Prayer requests created by users and associated with profile pages. Supports public and private visibility. Tracks amen (reaction) counts and update counts. Soft-deleted via deleted_at rather than hard deletes to preserve referential integrity.',
    cols: [
      { name:'id',           type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing primary key.' },
      { name:'user_id',      type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. Author of the prayer request.' },
      { name:'page_id',      type:'bigint',      null:'Y', key:'FK', def:'',          desc:'References pages.id. Page this prayer is associated with (optional).' },
      { name:'title',        type:'text',        null:'Y', key:'',   def:'',          desc:'Optional short title/subject for the prayer request.' },
      { name:'body',         type:'text',        null:'N', key:'',   def:'',          desc:'Main prayer request text. Required.' },
      { name:'is_published', type:'boolean',     null:'N', key:'',   def:'true',      desc:'Whether the prayer is visible to others (unpublished = draft).' },
      { name:'visibility',   type:'text',        null:'N', key:'',   def:'public',    desc:'Audience: public (anyone) | private (author only) | supporters (followers only).' },
      { name:'amen_count',   type:'integer',     null:'N', key:'',   def:'0',         desc:'Count of amen reactions. Maintained by trigger bump_amen_count.' },
      { name:'update_count', type:'integer',     null:'N', key:'',   def:'0',         desc:'Count of prayer updates/answers. Maintained by trigger bump_update_count.' },
      { name:'share_count',  type:'integer',     null:'N', key:'',   def:'0',         desc:'Number of times this prayer has been shared externally.' },
      { name:'deleted_at',   type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Soft delete timestamp. Non-null means the record is logically deleted.' },
      { name:'created_at',   type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp when the prayer was created.' },
      { name:'updated_at',   type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp of last update. Maintained by set_updated_at trigger.' },
    ]
  },
  {
    table: 'prayer_reactions',
    domain: 'Prayers',
    desc: 'Records "Amen" reactions from users on prayer requests. One reaction per user per prayer (enforced by unique constraint). When a reaction is inserted or deleted, the bump_amen_count trigger updates prayers.amen_count automatically.',
    cols: [
      { name:'id',         type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing primary key.' },
      { name:'user_id',    type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. User who reacted. Cascades on delete.' },
      { name:'prayer_id',  type:'bigint',      null:'N', key:'FK', def:'',          desc:'References prayers.id. Prayer that received the reaction. Cascades on delete.' },
      { name:'type',       type:'text',        null:'N', key:'',   def:'amen',      desc:'Reaction type. Currently only "amen" is supported.' },
      { name:'created_at', type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp when the reaction was created.' },
    ]
  },
  {
    table: 'prayer_updates',
    domain: 'Prayers',
    desc: 'Text updates/answers posted by the prayer author on a prayer request. Allows the original author to share how God answered or updated the situation. The bump_update_count trigger keeps prayers.update_count in sync.',
    cols: [
      { name:'id',         type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing primary key.' },
      { name:'user_id',    type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. Author posting the update. Cascades on delete.' },
      { name:'prayer_id',  type:'bigint',      null:'N', key:'FK', def:'',          desc:'References prayers.id. Parent prayer request. Cascades on delete.' },
      { name:'body',       type:'text',        null:'N', key:'',   def:'',          desc:'Content of the prayer update or answered prayer testimony.' },
      { name:'created_at', type:'timestamptz', null:'N', key:'',   def:'now()',     desc:'Timestamp when the update was posted.' },
    ]
  },
  {
    table: 'missionary_followers',
    domain: 'Social / Follow',
    desc: 'Tracks follow requests and approved follower relationships between supporters and missionaries. A user sends a follow request (status: pending) and the missionary approves or rejects it. Once accepted, the supporter can view supporter-only content and send direct messages. The optional note field allows the requester to introduce themselves.',
    cols: [
      { name:'id',            type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'missionary_id', type:'bigint',      null:'N', key:'FK', def:'',          desc:'References missionaries.id. The missionary being followed. Cascades on delete.' },
      { name:'user_id',       type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. The user sending the follow request.' },
      { name:'status',        type:'text',        null:'N', key:'',   def:'pending',   desc:'Follow status: pending | accepted | rejected. Unique per pair.' },
      { name:'note',          type:'text',        null:'Y', key:'',   def:'',          desc:'Optional introduction note from the requester (max 100 chars).' },
      { name:'requested_at',  type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the follow request was submitted.' },
      { name:'reviewed_at',   type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp when the missionary reviewed the request.' },
      { name:'reviewed_by',   type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Who approved/rejected (usually the missionary).' },
      { name:'created_at',    type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the record was created.' },
    ]
  },
  {
    table: 'church_followers',
    domain: 'Social / Follow',
    desc: 'Tracks follow relationships between users and church organizations. Works similarly to missionary_followers with an approval workflow. Allows churches to approve who can see supporter-only content on their page.',
    cols: [
      { name:'id',           type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'church_id',    type:'bigint',      null:'N', key:'FK', def:'',          desc:'References churches.id. The church being followed. Cascades on delete.' },
      { name:'user_id',      type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. The user sending the follow request.' },
      { name:'status',       type:'text',        null:'N', key:'',   def:'pending',   desc:'Follow status: pending | accepted | rejected.' },
      { name:'note',         type:'text',        null:'Y', key:'',   def:'',          desc:'Optional introduction note from the requester (max 100 chars).' },
      { name:'requested_at', type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the follow request was submitted.' },
      { name:'reviewed_at',  type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp when the church admin reviewed the request.' },
      { name:'reviewed_by',  type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Who reviewed the request.' },
      { name:'created_at',   type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the record was created.' },
    ]
  },
  {
    table: 'missionary_missionary_followers',
    domain: 'Social / Follow',
    desc: 'Tracks peer follow relationships between missionaries (missionary-to-missionary following). Allows missionaries to follow each other\'s ministry updates. Uses the same approval workflow as missionary_followers. The note field allows the requesting missionary to introduce themselves.',
    cols: [
      { name:'id',                     type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'followed_missionary_id', type:'bigint',      null:'N', key:'FK', def:'',          desc:'References missionaries.id. The missionary whose content is being followed.' },
      { name:'follower_missionary_id', type:'bigint',      null:'N', key:'FK', def:'',          desc:'References missionaries.id. The missionary doing the following.' },
      { name:'status',                 type:'text',        null:'N', key:'',   def:'pending',   desc:'Follow status: pending | accepted | rejected.' },
      { name:'note',                   type:'text',        null:'Y', key:'',   def:'',          desc:'Optional introduction note from the requester (max 100 chars).' },
      { name:'reviewed_at',            type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp when the target missionary reviewed the request.' },
      { name:'reviewed_by',            type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Who reviewed the request.' },
      { name:'created_at',             type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the record was created.' },
    ]
  },
  {
    table: 'missionary_churches',
    domain: 'Social / Follow',
    desc: 'Many-to-many pivot table linking missionaries to churches with a typed relationship. A missionary can have multiple church relationships (sending, supporting, partner). A church can support multiple missionaries. Used to build the missionary\'s church network displayed on their profile.',
    cols: [
      { name:'id',                type:'bigint',      null:'N', key:'PK', def:'identity',    desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'missionary_id',     type:'bigint',      null:'N', key:'FK', def:'',             desc:'References missionaries.id. Cascades on delete.' },
      { name:'church_id',         type:'bigint',      null:'N', key:'FK', def:'',             desc:'References churches.id. Cascades on delete.' },
      { name:'relationship_type', type:'text',        null:'Y', key:'',   def:'supporting',  desc:'Nature of the relationship: sending | supporting | partner.' },
      { name:'is_active',         type:'boolean',     null:'Y', key:'',   def:'true',         desc:'Whether this church-missionary relationship is currently active.' },
      { name:'created_at',        type:'timestamptz', null:'Y', key:'',   def:'now()',        desc:'Timestamp when the relationship was established.' },
    ]
  },
  {
    table: 'notifications',
    domain: 'Social / Follow',
    desc: 'In-app notification records delivered to users. Generated automatically when follow requests are received, approved, or when other platform events occur. Supports soft notification clearing via is_read flag. Can reference a related entity (e.g. a follow request ID) for deep linking.',
    cols: [
      { name:'id',                  type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'user_id',             type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. Recipient of the notification.' },
      { name:'type',                type:'text',        null:'N', key:'',   def:'',          desc:'Notification category (e.g. follow_request, follow_approved, donation_received).' },
      { name:'title',               type:'text',        null:'N', key:'',   def:'',          desc:'Short notification title displayed in the notification list.' },
      { name:'message',             type:'text',        null:'Y', key:'',   def:'',          desc:'Longer notification body text.' },
      { name:'is_read',             type:'boolean',     null:'Y', key:'',   def:'false',     desc:'Whether the user has read/dismissed this notification.' },
      { name:'related_entity_type', type:'text',        null:'Y', key:'',   def:'',          desc:'Type of entity this notification refers to (e.g. missionary_followers).' },
      { name:'related_entity_id',   type:'bigint',      null:'Y', key:'',   def:'',          desc:'ID of the related entity for deep linking from the notification.' },
      { name:'created_at',          type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the notification was generated.' },
    ]
  },
  {
    table: 'conversations',
    domain: 'Direct Messaging',
    desc: 'Direct message thread between one missionary and one supporter. Each unique missionary–supporter pair can have only one conversation (enforced by unique constraint). Stores a preview of the last message for efficient list rendering without loading messages.',
    cols: [
      { name:'id',                   type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'missionary_id',        type:'bigint',      null:'N', key:'FK', def:'',          desc:'References missionaries.id. One of the two participants. Cascades on delete.' },
      { name:'supporter_id',         type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. The supporter participant. Cascades on delete.' },
      { name:'last_message_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of the most recent message. Used for sorting conversation list.' },
      { name:'last_message_preview', type:'text',        null:'Y', key:'',   def:'',          desc:'Truncated preview of the most recent message content.' },
      { name:'last_message_sender_id',type:'uuid',       null:'Y', key:'',   def:'',          desc:'auth.users.id of who sent the last message.' },
      { name:'created_at',           type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the conversation was started.' },
      { name:'updated_at',           type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of the last conversation update.' },
    ]
  },
  {
    table: 'conversation_members',
    domain: 'Direct Messaging',
    desc: 'Tracks participants in each conversation and their unread message count. Each conversation has exactly two members (the missionary and the supporter). Provides efficient access control and per-user unread badge counts without scanning the messages table.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'conversation_id', type:'bigint',      null:'N', key:'FK', def:'',          desc:'References conversations.id. Cascades on delete.' },
      { name:'user_id',         type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. A participant in the conversation. Cascades on delete.' },
      { name:'unread_count',    type:'integer',     null:'Y', key:'',   def:'0',         desc:'Number of unread messages for this participant. Used for badge display.' },
      { name:'last_read_at',    type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of when this participant last read the conversation.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the membership was created.' },
    ]
  },
  {
    table: 'messages',
    domain: 'Direct Messaging',
    desc: 'Individual message records within a conversation. Messages are limited to 5,000 characters. Real-time delivery is enabled via Supabase Realtime subscriptions on this table. The is_read flag tracks individual message read status.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'conversation_id', type:'bigint',      null:'N', key:'FK', def:'',          desc:'References conversations.id. Cascades on delete.' },
      { name:'sender_id',       type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. User who sent the message. Cascades on delete.' },
      { name:'content',         type:'text',        null:'N', key:'',   def:'',          desc:'Message body text. Must be 1–5,000 characters (CHECK constraint).' },
      { name:'is_read',         type:'boolean',     null:'Y', key:'',   def:'false',     desc:'Whether the recipient has read this specific message.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the message was sent.' },
      { name:'updated_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of last message edit (if editing is supported).' },
    ]
  },
  {
    table: 'message_reports',
    domain: 'Direct Messaging',
    desc: 'Abuse reports submitted by users for inappropriate messages or conversations. Supports moderation workflows where admins can review and resolve reports. Can reference either a specific message or the entire conversation.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'conversation_id', type:'bigint',      null:'N', key:'FK', def:'',          desc:'References conversations.id. The conversation containing the reported content.' },
      { name:'message_id',      type:'bigint',      null:'Y', key:'FK', def:'',          desc:'References messages.id. Specific message reported (null if reporting whole conversation).' },
      { name:'reported_by',     type:'uuid',        null:'N', key:'FK', def:'',          desc:'References auth.users.id. User who filed the report.' },
      { name:'report_type',     type:'text',        null:'N', key:'',   def:'',          desc:'Report category: message (specific message) or conversation (entire thread).' },
      { name:'reason',          type:'text',        null:'Y', key:'',   def:'',          desc:'Detailed reason or description provided by the reporter.' },
      { name:'status',          type:'text',        null:'Y', key:'',   def:'pending',   desc:'Review status: pending | reviewed | resolved.' },
      { name:'reviewed_by',     type:'uuid',        null:'Y', key:'FK', def:'',          desc:'References auth.users.id. Admin who reviewed the report.' },
      { name:'reviewed_at',     type:'timestamptz', null:'Y', key:'',   def:'',          desc:'Timestamp when the admin reviewed the report.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the report was submitted.' },
    ]
  },
  {
    table: 'homepage_banners',
    domain: 'Homepage & Footer',
    desc: 'Carousel and static banner images displayed on the public homepage. Each banner has a mission field location, descriptive text, and image URL. The display_order field controls the sequence of carousel slides. Managed by admins through the homepage settings panel.',
    cols: [
      { name:'id',              type:'bigint',      null:'N', key:'PK', def:'identity',  desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'banner_type',     type:'text',        null:'Y', key:'',   def:'carousel',  desc:'Display type: carousel | static | video.' },
      { name:'is_active',       type:'boolean',     null:'Y', key:'',   def:'true',      desc:'Whether this banner is currently shown on the homepage.' },
      { name:'display_order',   type:'integer',     null:'N', key:'',   def:'',          desc:'Sort order for carousel display. Lower numbers appear first.' },
      { name:'location',        type:'text',        null:'N', key:'',   def:'',          desc:'Mission field location label displayed on the banner (e.g. "Chile").' },
      { name:'description',     type:'text',        null:'N', key:'',   def:'',          desc:'Short description text overlaid or shown beneath the banner image.' },
      { name:'image_url',       type:'text',        null:'N', key:'',   def:'',          desc:'Path or URL to the banner image file.' },
      { name:'scroll_duration', type:'integer',     null:'Y', key:'',   def:'5000',      desc:'Auto-scroll duration in milliseconds for carousel mode.' },
      { name:'created_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the banner was added.' },
      { name:'updated_at',      type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of last banner update.' },
    ]
  },
  {
    table: 'homepage_settings',
    domain: 'Homepage & Footer',
    desc: 'Singleton configuration table for homepage carousel behaviour. Only one row is expected. Controls global carousel settings such as auto-scroll timing, navigation arrows, and pagination dots. Managed through the admin homepage settings panel.',
    cols: [
      { name:'id',                    type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS). Expect single row.' },
      { name:'banner_type',           type:'text',        null:'Y', key:'',   def:'carousel',  desc:'Global banner display type: carousel | static | video.' },
      { name:'auto_scroll',           type:'boolean',     null:'Y', key:'',   def:'true',      desc:'Whether the carousel auto-advances between slides.' },
      { name:'scroll_timing',         type:'integer',     null:'Y', key:'',   def:'5000',      desc:'Auto-advance interval in milliseconds.' },
      { name:'show_navigation_arrows',type:'boolean',     null:'Y', key:'',   def:'true',      desc:'Whether left/right navigation arrows are displayed.' },
      { name:'show_pagination_dots',  type:'boolean',     null:'Y', key:'',   def:'true',      desc:'Whether slide indicator dots are displayed below the carousel.' },
      { name:'created_at',            type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the settings record was created.' },
      { name:'updated_at',            type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of last settings update.' },
    ]
  },
  {
    table: 'footer_content',
    domain: 'Homepage & Footer',
    desc: 'Stores editable text content for all footer navigation pages (About Us, Statement of Faith, FAQ, Privacy Policy, etc.). Each page_type is unique, meaning one content block exists per footer page. Content is managed by admins through the site settings panel.',
    cols: [
      { name:'id',         type:'bigint',      null:'N', key:'PK', def:'identity', desc:'Auto-incrementing surrogate primary key (GENERATED ALWAYS).' },
      { name:'page_type',  type:'text',        null:'N', key:'UQ', def:'',          desc:'Footer page identifier (unique): about_us | statement_of_faith | donate | faq | contact_us | privacy_policy | terms_of_use.' },
      { name:'title',      type:'text',        null:'N', key:'',   def:'',          desc:'Page heading displayed at the top of the footer content page.' },
      { name:'content',    type:'text',        null:'N', key:'',   def:'',          desc:'Full page body content in plain text or markdown format.' },
      { name:'created_at', type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp when the content was first created.' },
      { name:'updated_at', type:'timestamptz', null:'Y', key:'',   def:'now()',     desc:'Timestamp of the last content edit.' },
    ]
  },
];

// ─── Rendering helpers ────────────────────────────────────────────────────────
let doc, pageNum = 0, tocEntries = [];

function newPage() {
  if (pageNum > 0) doc.addPage();
  pageNum++;
  // Header stripe
  doc.rect(0, 0, PW, 28).fill('#0F172A');
  doc.fillColor('#F1F5F9').font('Helvetica-Bold').fontSize(8)
     .text('Harvest 21  —  Database Data Dictionary', ML, 10);
  doc.fillColor('#64748B').font('Helvetica').fontSize(7)
     .text(`Page ${pageNum}`, PW-MR-40, 11, { width:40, align:'right' });
  return 36; // y cursor after header
}

function checkRoom(y, needed) {
  if (y + needed > PH - 30) { return newPage(); }
  return y;
}

// Draw the column table header row
function drawColHeader(y) {
  doc.rect(ML, y, CW, HDR_H).fill('#1E293B');
  const labels = { name:'Column Name', type:'Data Type', null:'Null', key:'Key', def:'Default', desc:'Description' };
  Object.entries(CX).forEach(([k, x]) => {
    doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(FONT.tblhdr)
       .text(labels[k], x + 2, y + 4, { width: CWW[k] - 4, lineBreak: false });
  });
  return y + HDR_H;
}

// Draw one attribute row
function drawColRow(col, y, shade) {
  doc.rect(ML, y, CW, ROW_H).fill(shade ? '#F8FAFC' : '#FFFFFF');

  const keyColor = col.key==='PK' ? '#92400E' : col.key==='FK' ? '#4338CA' : col.key==='UQ' ? '#065F46' : '#374151';
  const nameFont = col.key==='PK' ? 'Helvetica-Bold' : col.key==='FK' ? 'Helvetica-Oblique' : 'Helvetica';

  const cells = [
    { x: CX.name, w: CWW.name, text: col.name,    font: nameFont,    color: col.key==='PK'?'#92400E':'#1E293B' },
    { x: CX.type, w: CWW.type, text: col.type,    font:'Helvetica',  color:'#475569' },
    { x: CX.null, w: CWW.null, text: col.null,    font:'Helvetica',  color: col.null==='N'?'#991B1B':'#4B5563' },
    { x: CX.key,  w: CWW.key,  text: col.key,     font:'Helvetica-Bold', color: keyColor },
    { x: CX.def,  w: CWW.def,  text: col.def,     font:'Helvetica',  color:'#6B7280' },
    { x: CX.desc, w: CWW.desc, text: col.desc,    font:'Helvetica',  color:'#334155' },
  ];

  cells.forEach(c => {
    doc.fillColor(c.color).font(c.font).fontSize(FONT.cell)
       .text(c.text, c.x + 2, y + 3, { width: c.w - 4, lineBreak: false });
  });

  // row border
  doc.rect(ML, y, CW, ROW_H).lineWidth(0.2).stroke('#E2E8F0');
  return y + ROW_H;
}

// ─── Generate ─────────────────────────────────────────────────────────────────
function generate() {
  doc = new PDFDocument({ size:'A4', margin:0, autoFirstPage:true });
  const out    = path.join(__dirname, 'h21-data-dictionary.pdf');
  const stream = fs.createWriteStream(out);
  doc.pipe(stream);

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  pageNum = 1;
  doc.rect(0, 0, PW, PH).fill('#0F172A');
  doc.rect(0, PH*0.52, PW, PH*0.48).fill('#1E293B');

  // Big title
  doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(28)
     .text('Harvest 21', ML, 180, { align:'center', width: CW });
  doc.fillColor('#7DD3FC').font('Helvetica-Bold').fontSize(20)
     .text('Database Data Dictionary', ML, 218, { align:'center', width: CW });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(11)
     .text('Complete table & column reference for the Harvest 21 platform database', ML, 260, { align:'center', width: CW });

  // Horizontal divider
  doc.rect(ML+40, 295, CW-80, 1).fill('#334155');

  // Stats
  const totalCols = SCHEMA.reduce((s, t) => s + t.cols.length, 0);
  const stats = [
    { label:'Tables', value: String(SCHEMA.length) },
    { label:'Total Columns', value: String(totalCols) },
    { label:'Domains', value:'8' },
    { label:'DB Engine', value:'PostgreSQL 15' },
  ];
  const statW = CW / stats.length;
  stats.forEach((s, i) => {
    const sx = ML + i * statW + statW/2 - 40;
    doc.fillColor('#7DD3FC').font('Helvetica-Bold').fontSize(22)
       .text(s.value, sx, 320, { width:80, align:'center' });
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(9)
       .text(s.label, sx, 348, { width:80, align:'center' });
  });

  // Meta
  doc.fillColor('#475569').font('Helvetica').fontSize(9)
     .text('Backend: Supabase (PostgreSQL)   ·   Auth: Supabase Auth   ·   Payments: Stripe', ML, 450, { align:'center', width:CW });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`, ML, 468, { align:'center', width:CW });

  // Domain colour key on cover
  const domains = [
    { c:'#1D4ED8', l:'Auth & Identity' }, { c:'#065F46', l:'Organizations' },
    { c:'#5B21B6', l:'Pages' },           { c:'#991B1B', l:'Donations' },
    { c:'#92400E', l:'Prayers' },         { c:'#9D174D', l:'Social / Follow' },
    { c:'#0C4A6E', l:'Messaging' },       { c:'#1F2937', l:'Homepage & Footer' },
  ];
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8)
     .text('DOMAINS', ML, 510, { align:'center', width:CW });
  const dw = 130, drows = [[0,1],[2,3],[4,5],[6,7]];
  drows.forEach((pair, ri) => {
    pair.forEach((di, ci) => {
      const d = domains[di];
      const dx = ML + 60 + ci * (dw + 20);
      const dy = 525 + ri * 18;
      doc.rect(dx, dy, 10, 10).fill(d.c);
      doc.fillColor('#94A3B8').font('Helvetica').fontSize(8.5)
         .text(d.l, dx+14, dy+1, { lineBreak:false });
    });
  });

  doc.fillColor('#334155').font('Helvetica').fontSize(7)
     .text('Harvest 21 — Confidential Internal Reference Document', ML, PH-30, { align:'center', width:CW });

  // ── TABLE OF CONTENTS ────────────────────────────────────────────────────────
  doc.addPage();
  pageNum = 2;
  doc.rect(0, 0, PW, 28).fill('#0F172A');
  doc.fillColor('#F1F5F9').font('Helvetica-Bold').fontSize(8)
     .text('Harvest 21  —  Database Data Dictionary', ML, 10);
  doc.fillColor('#64748B').font('Helvetica').fontSize(7).text('Page 2', PW-MR-40, 11, { width:40, align:'right' });

  let y = 42;
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(15)
     .text('Table of Contents', ML, y);
  y += 24;

  let lastDomain = '';
  SCHEMA.forEach((tbl, idx) => {
    if (tbl.domain !== lastDomain) {
      y = checkRoom(y, 20);
      doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(9)
         .text(tbl.domain.toUpperCase(), ML, y);
      doc.moveTo(ML, y+11).lineTo(PW-MR, y+11).lineWidth(0.3).stroke('#CBD5E1');
      y += 14;
      lastDomain = tbl.domain;
    }
    // store toc entry (approximate page, filled in later) 
    tocEntries.push({ name: tbl.table, domain: tbl.domain, idx });

    // dots leader
    const tw = doc.widthOfString(tbl.table, { font:'Helvetica', size:8.5 });
    doc.fillColor('#1E293B').font('Helvetica').fontSize(8.5)
       .text(tbl.table, ML+10, y, { lineBreak:false });
    // dots
    const dotsStart = ML+10+tw+4, dotsEnd = PW-MR-28;
    let dx = dotsStart;
    doc.fillColor('#CBD5E1').font('Helvetica').fontSize(8);
    while (dx < dotsEnd) { doc.text('·', dx, y+1, { lineBreak:false }); dx += 5; }

    // page placeholder
    doc.fillColor('#64748B').font('Helvetica').fontSize(8)
       .text('—', PW-MR-22, y, { width:22, align:'right', lineBreak:false });

    y += 13;
  });

  // ── BODY: one section per table ──────────────────────────────────────────────
  let currentDomain = '';
  SCHEMA.forEach(tbl => {
    // Start new domain? Add a domain divider page
    if (tbl.domain !== currentDomain) {
      doc.addPage();
      pageNum++;
      doc.rect(0, 0, PW, PH).fill(DOMAIN[tbl.table] || '#1E293B');
      doc.rect(0, PH*0.65, PW, PH*0.35).fill('rgba(0,0,0,0.25)');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24)
         .text(tbl.domain, ML, PH*0.38, { align:'center', width:CW });
      doc.fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(10)
         .text('Data Dictionary Section', ML, PH*0.38+34, { align:'center', width:CW });
      currentDomain = tbl.domain;
    }

    // Start table section on new page
    y = newPage();

    // Table name banner
    doc.rect(ML, y, CW, SEC_H).fill(DOMAIN[tbl.table] || '#1E293B');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12)
       .text(tbl.table, ML+8, y+4, { lineBreak:false });
    doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(7)
       .text(`Domain: ${tbl.domain}`, PW-MR-130, y+7, { width:130, align:'right', lineBreak:false });
    y += SEC_H + 6;

    // Description
    doc.fillColor('#374151').font('Helvetica').fontSize(FONT.body)
       .text(tbl.desc, ML, y, { width:CW, align:'justify' });
    y += doc.heightOfString(tbl.desc, { width:CW, fontSize:FONT.body }) + 10;

    // Column table
    y = checkRoom(y, HDR_H + tbl.cols.length * ROW_H + 4);
    // Section sub-title
    doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(FONT.h2)
       .text('Columns', ML, y);
    y += 13;

    // Column header
    y = drawColHeader(y);

    tbl.cols.forEach((col, i) => {
      y = checkRoom(y, ROW_H + 2);
      y = drawColRow(col, y, i % 2 === 1);
    });

    // Bottom border of table
    doc.moveTo(ML, y).lineTo(ML+CW, y).lineWidth(0.5).stroke('#94A3B8');
    y += 14;

    // Indexes / constraints note
    const notes = buildNotes(tbl);
    if (notes.length) {
      y = checkRoom(y, 14 + notes.length * 11);
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(FONT.h2)
         .text('Constraints & Indexes', ML, y);
      y += 11;
      notes.forEach(n => {
        doc.fillColor('#475569').font('Helvetica').fontSize(FONT.small)
           .text(`• ${n}`, ML+6, y, { width:CW-6 });
        y += doc.heightOfString(n, { fontSize:FONT.small, width:CW-6 }) + 3;
      });
    }
  });

  doc.end();
  stream.on('finish', () => console.log('✅  Data dictionary →', out));
  stream.on('error',  e => { console.error('❌', e); process.exit(1); });
}

function buildNotes(tbl) {
  const notes = [];
  const pk = tbl.cols.filter(c => c.key==='PK');
  const fks = tbl.cols.filter(c => c.key==='FK');
  const uqs = tbl.cols.filter(c => c.key==='UQ');
  if (pk.length)  notes.push(`PRIMARY KEY: ${pk.map(c=>c.name).join(', ')}`);
  fks.forEach(c  => notes.push(`FOREIGN KEY: ${c.name} — ${c.desc.match(/References ([^\.]+\.[^\.]+)/)?.[1] || 'see description'}`));
  uqs.forEach(c  => notes.push(`UNIQUE: ${c.name}`));
  notes.push('ROW LEVEL SECURITY (RLS) is enabled on this table.');
  return notes;
}

generate();
