# BGG Game Sync Status

**Total games in Cosmos DB:** ~6,699  
**Last updated:** 2026-04-22

## Sync Batches

| Batch | ID Range | Type | Status | Started | Position | Games Added |
|-------|----------|------|--------|---------|----------|-------------|
| 1 | 1 – 500 | Sequential | ✅ Complete | Pre-Feb 2026 | 500/500 | ~3,626 |
| 2 | 200,000 – 300,000 | High-Signal (chunked) | 🟠 In Progress | 2026-03-01 | ~265,865 (resumed) | ~3,073 |
| 3 | 500 – 100,000 | High-Signal | ⏳ Pending | — | — | — |
| 4 | 100,000 – 200,000 | High-Signal | ⏳ Pending | — | — | — |
| 5 | 300,000 – 400,000 | High-Signal | ⏳ Pending | — | — | — |
| 6 | 400,000 – 500,000 | High-Signal | ⏳ Pending | — | — | — |

### Status Legend
- ✅ Complete
- 🟠 In Progress
- ⏳ Pending

### Sync Parameters
- **MinAverage:** 5.0
- **MinBayes:** 5.0
- **MinVotes:** 50
- **Limit per batch:** None (removed 2026-04-22)

### Notes
- Batch 2 originally started with `Limit: 500` which was reached at ~218k IDs. Resumed on 2026-03-09 with `Limit: 7000` to complete the full range. Latest resume on 2026-04-22 from ID 258,865.
- **Limit removed**: The per-batch upsert limit was removed from the code on 2026-04-22. Quality filters (`MinVotes`, `MinAverage`, `MinBayes`) serve as the natural cap. Hit rate in the 200k–300k range is ~2%, so the 7K limit was never at risk of being reached for higher ID ranges. Lower ID ranges (Batch 3: 500–100k) would have exceeded it.
- Processing rate: ~650 IDs/hour (~15,600 IDs/day)
- Estimated time per 100k range: ~6.5 days
- Games that fail quality filters (< 50 votes, < 5.0 avg rating) or are expansions are skipped