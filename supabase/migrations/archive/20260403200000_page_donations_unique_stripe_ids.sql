-- Deduplicate page_donations (keeps best row per stripe_payment_intent_id / stripe_invoice_id), then add unique indexes.
-- Winner: has invoice id, recurring type, then lowest id.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_payment_intent_id
      ORDER BY
        (stripe_invoice_id IS NOT NULL AND btrim(stripe_invoice_id) <> '') DESC,
        CASE WHEN type = 'recurring' THEN 1 ELSE 0 END DESC,
        id ASC
    ) AS rn
  FROM public.page_donations
  WHERE stripe_payment_intent_id IS NOT NULL
),
losers AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM public.donation_receipts dr
WHERE dr.page_donation_id IN (SELECT id FROM losers);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_payment_intent_id
      ORDER BY
        (stripe_invoice_id IS NOT NULL AND btrim(stripe_invoice_id) <> '') DESC,
        CASE WHEN type = 'recurring' THEN 1 ELSE 0 END DESC,
        id ASC
    ) AS rn
  FROM public.page_donations
  WHERE stripe_payment_intent_id IS NOT NULL
),
losers AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM public.page_donations pd
WHERE pd.id IN (SELECT id FROM losers);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_invoice_id
      ORDER BY
        (stripe_payment_intent_id IS NOT NULL AND btrim(stripe_payment_intent_id) <> '') DESC,
        id ASC
    ) AS rn
  FROM public.page_donations
  WHERE stripe_invoice_id IS NOT NULL AND btrim(stripe_invoice_id) <> ''
),
losers AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM public.donation_receipts dr
WHERE dr.page_donation_id IN (SELECT id FROM losers);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_invoice_id
      ORDER BY
        (stripe_payment_intent_id IS NOT NULL AND btrim(stripe_payment_intent_id) <> '') DESC,
        id ASC
    ) AS rn
  FROM public.page_donations
  WHERE stripe_invoice_id IS NOT NULL AND btrim(stripe_invoice_id) <> ''
),
losers AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM public.page_donations pd
WHERE pd.id IN (SELECT id FROM losers);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_page_donations_stripe_payment_intent_id
  ON public.page_donations (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_page_donations_stripe_invoice_id
  ON public.page_donations (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
