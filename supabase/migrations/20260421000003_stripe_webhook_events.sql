create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb
);

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

create index if not exists donation_receipts_receipt_number_uniq
  on public.donation_receipts (receipt_number)
  where receipt_number is not null;
