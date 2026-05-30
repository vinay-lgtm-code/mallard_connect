# Forecast accuracy — data model

**Status:** data model only. The accuracy report UI is parked. This document describes
the columns that already exist so a future report can be built without re-deriving the
schema.

## The question we want to answer later

When an adviser sets a `confidence` (0–100) on a lead, how often are they right? A lead
that sat at 90% confidence and then converted was a good call. A lead at 90% that was
then lost was an overconfident call. Tracking this per adviser tells a manager (Della)
whose pipeline forecast to trust.

The problem: `confidence` is mutable and lives on the lead. Once a lead converts or is
lost, advisers stop touching it, but `confidence` can still be edited, and there is no
record of what the confidence *was at the moment the deal closed*. Without a frozen
snapshot, you cannot score the forecast after the fact.

## How the snapshot is captured

Two columns on `leads` hold the frozen values:

| Column                  | Type   | Meaning                                                        |
|-------------------------|--------|----------------------------------------------------------------|
| `confidence_at_close`   | `int`  | The `confidence` value at the instant `status` became closed.  |
| `closed_outcome`        | `text` | `'converted'` or `'lost'` — the closing `status`.              |

They are populated by a `BEFORE UPDATE` trigger, not by application code. See
`supabase/migrations/00006_forecast_accuracy.sql`:

```sql
CREATE OR REPLACE FUNCTION capture_confidence_at_close() RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.status IN ('converted','lost') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.confidence_at_close := NEW.confidence;
    NEW.closed_outcome := NEW.status;
  END IF;
  RETURN NEW;
END; $func$ LANGUAGE plpgsql;
```

Key properties:

- **Snapshots on the transition into a closed status.** The
  `OLD.status IS DISTINCT FROM NEW.status` guard means the snapshot is written only when
  `status` actually *changes* to `converted` or `lost`. A plain edit of a lead that is
  already `converted` (without changing `status`) does not re-snapshot. Note the edges:
  a `converted -> lost` (or `lost -> converted`) flip is a status change ending in a
  closed value, so it *does* re-snapshot with the new outcome and the current confidence.
  And the trigger never clears the columns, so reopening a closed lead back to `active`
  leaves the last snapshot in place. A future report should therefore treat
  `closed_outcome` together with the live `status` if it cares about reopened leads
  (in practice closed leads are not reopened in this product).
- **`confidence_at_close` mirrors live `confidence` exactly.** The trigger copies
  `NEW.confidence` verbatim, so if `confidence` was never set the snapshot is `null` too.
  There is no fill-in default.
- **Trigger-owned, not app-owned.** No API route or hook writes these columns. They are a
  side effect of the normal status change the adviser already makes. Nothing extra to wire
  into the convert / mark-lost flows.
- **Null before the first close.** A lead that has never been `converted` or `lost` has
  `confidence_at_close = null` and `closed_outcome = null`.

## Application types

The columns surface through the generic snake→camel mapper, so they appear on the `Lead`
type as:

```ts
// src/types/index.ts
export type ClosedOutcome = "converted" | "lost";

export interface Lead {
  // ...
  confidence: number | null;        // live, mutable
  confidenceAtClose: number | null; // frozen snapshot, set by DB trigger
  closedOutcome: ClosedOutcome | null;
}
```

No mapper change was needed. `rowToApp` / `appToRow` in `src/lib/supabase/mappers.ts`
iterate every key and convert case generically, so `confidence_at_close` ↔
`confidenceAtClose` and `closed_outcome` ↔ `closedOutcome` carry through automatically.
A future report reads them straight off the `Lead` objects the existing hooks already
return.

## How a future accuracy report would read these

The report only looks at *closed* leads (`closed_outcome is not null`) and compares the
frozen confidence against the actual outcome. A converted deal "should" have had high
confidence; a lost deal "should" have had low confidence.

A practical per-adviser query (Supabase / Postgres):

```sql
select
  assigned_to                                            as adviser_id,
  count(*)                                               as closed_leads,
  count(*) filter (where closed_outcome = 'converted')   as won,
  count(*) filter (where closed_outcome = 'lost')        as lost,
  -- average confidence the adviser had on deals that actually converted
  round(avg(confidence_at_close)
        filter (where closed_outcome = 'converted'))     as avg_conf_on_won,
  -- average confidence on deals that were actually lost (want this LOW)
  round(avg(confidence_at_close)
        filter (where closed_outcome = 'lost'))           as avg_conf_on_lost
from leads
where tenant_id = $1
  and closed_outcome is not null
  and confidence_at_close is not null
group by assigned_to;
```

Interpretation:

- A well-calibrated adviser shows a wide gap: high `avg_conf_on_won`, low
  `avg_conf_on_lost`. They knew which deals were real.
- A small gap (or worse, `avg_conf_on_lost` ≥ `avg_conf_on_won`) means the confidence
  number carries no signal for that adviser, so the manager should discount their forecast.

A richer version buckets `confidence_at_close` (e.g. 0–25 / 26–50 / 51–75 / 76–100) and
plots the actual conversion rate per bucket — a classic calibration curve. Perfect
calibration is the diagonal: the 80% bucket converts ~80% of the time.

## Scope notes

- This is data-model groundwork only. There is no report page, no chart, no nav entry.
- Demo data (`src/lib/mock-data/*.ts`) sets `confidenceAtClose` / `closedOutcome` on the
  already-closed sample leads so the future report has something to render against without
  a live database. Active leads carry `null` for both, matching the trigger's behaviour.
- All reads stay tenant-scoped via the existing `tenant_id` filter on `leads`; the report
  query above keeps the `tenant_id = $1` predicate.
