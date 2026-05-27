# CRCE Import UAT Report

Date: 2026-05-27
Target file: `A.CRCE_Tracking_Log_May20260526b---beebef8c-46d2-42a1-802e-a91bc86b7a27.xlsx`
Environment: local code validation against current `main`

## Scope

- Validate CRCE XLSX parsing
- Validate status mapping
- Validate Jira hyperlink extraction
- Validate due date parsing
- Check importer behavior for CRCE subtask rows

## Input Summary

- Parsed rows: `109`
- Jira hyperlinks found in `Ticket No.` cells: `54`
- Raw source statuses:
  - `Completed`: `38`
  - `Pending`: `33`
  - `Cancelled`: `4`
  - `Not Started`: `16`
  - `Pending requirement confirmation by Benne`: `4`
  - `WIP`: `14`

## Expected Parsed Status Result

- `finished`: `38`
- `planning`: `37`
- `cancelled`: `4`
- `todo`: `16`
- `in_progress`: `14`

## Bugs Found

### 1. CRCE rows were incorrectly affected by Day 2 auto-convert

Severity: High

Issue:
- `TaskListPage` applied generic Day 2 date logic to CRCE rows.
- This rewrote many CRCE row statuses to lowercase `in_progress` before import review.
- `ImportReviewPage` did not originally map every lowercase canonical value, so many rows later fell back to `todo`.

Impact:
- Imported DB status distribution became wrong.
- This was the main reason imported records skewed toward `todo` / `planning`.

Fix:
- Restrict Day 2 auto-convert to non-CRCE formats only.
- Add lowercase canonical status mappings in `ImportReviewPage`.

### 2. Free-text date was misparsed as `2001-05-26`

Severity: High

Issue:
- Value `CM later 26 May` was parsed by permissive fallback date logic into `2001-05-26`.

Impact:
- Wrong due date could be imported for CRCE task rows.

Fix:
- Remove permissive fallback date parsing.
- Keep only explicit supported formats:
  - `DD-MMM`
  - `DD MMM YYYY`
  - `DD/MM/YYYY`
  - `YYYY-MM-DD`

### 3. LogBook log category dropdown used wrong value

Severity: Medium

Issue:
- `LogBookPage` used `internal_review` as a log category option value.
- Log category schema accepts `review`, not `internal_review`.

Impact:
- Editing a log from Log Book could save an invalid category value.

Fix:
- Change dropdown value to `review`.

## Post-fix Validation

- Build: `npm run build` passed
- Parsed rows remain: `109`
- Hyperlinks remain detected: `54`
- Bad parsed dates: `0`
- Parsed status result matches expected mapping

## Code Changes

- `src/pages/TaskListPage.tsx`
- `src/pages/ImportReviewPage.tsx`
- `src/pages/LogBookPage.tsx`
- `src/lib/api.ts`
- `src/pages/CantonAiCoachPage.tsx`
- `src/pages/MyLogPage.tsx`

## Remaining Action

- Existing imported DB records are still stale from earlier bad imports.
- To complete UAT on live data:
  1. deploy latest `main`
  2. clear task data
  3. re-import the CRCE XLSX
  4. verify DB distribution against the expected parsed status result above
