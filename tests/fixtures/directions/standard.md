---
reader: the owner choosing what comes next
---

# Garden planner: directions

_Last updated: 2026-10-20_

## How to read this

- Marks: 🔴 needs you · 🟠 waiting · 🟢 ready · 💤 parked · ✅ done
- When: ⏩ now · ⏭ next · ⏸ later

## Where things stand today

- Seeds import works for three suppliers.
- The watering schedule waits on a sensor choice.

## The shape

| Direction | When | State |
| --- | --- | --- |
| 🧭 Seeds | ⏩ | 🟢 |
| 🧭 Watering | ⏭ | 🔴 |

## Waiting on you

| id | ask | what I need from you | if you say nothing |
| --- | --- | --- | --- |
| W1 | Pick the moisture sensor | A yes on model B, or another model | I order model B on Friday |
| W2 | Approve the supplier list | Strike any supplier you do not trust | All five stay in |

## 🧭 Seeds

### 🎯 Import every supplier

✅ Accepted when: code complete, exercised by the agent on all five feeds, reviewed by the bot.

| id | state | task |
| --- | --- | --- |
| S1 | ✅ done | Parse the first three feeds |
| S2 | 🟢 ready | Parse the fourth feed ⏩ |
| S3 | 🟢 ready | Parse the fifth feed ⏭ |
| S4 | 💤 parked | Images for every seed |

## 🧭 Watering

### 🎯 A schedule from the sensors

✅ Accepted when: tested on deploy for a week.

| id | state | task |
| --- | --- | --- |
| A1 | 🔴 needs you | Sensor choice, see W1 |
| A2 | 🟠 waiting | Sensor delivery |
| A3 | 🟢 ready | Schedule maths with fake readings ⏩ |

## Sources

- S1: the parser tests.
