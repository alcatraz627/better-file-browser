# Scraper and checks: directions

Current state only. State as of 2026-10-22, evening.

| | Meaning |
| --- | --- |
| When | ⏩ now · ⏭ next · ⏸ later |
| State | 🔴 needs you · 🟠 waiting · 🟢 ready · 💤 parked |

## Buckets

| # | Bucket | When | State | Rule |
| --- | --- | --- | --- | --- |
| 1 | Hotfixes | ⏩ | 🔴 | Ship first |
| 2 | Coverage | ⏭ | 🟢 | After hotfixes |
| 3 | Data quality | ⏸ | 💤 | Parked |

## 1. Hotfixes

| Item | Why it is here | Next step |
| --- | --- | --- |
| H1 | Crash on empty page | 🔴 confirm the fix on staging |
| H2 | Slow login | 🟢 profile the login call |

## 2. Coverage

- 🟢 Add the checkout flow.
- 🟠 Wait for the new test account.

## 3. Data quality

| Finding | Seen |
| --- | --- |
| Prices without currency | 4 times |
| Duplicate products | twice |
