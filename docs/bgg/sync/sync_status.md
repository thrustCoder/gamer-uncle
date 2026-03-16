# BGG Game Sync Status

**Total games in Cosmos DB:** 5,286  
**Last updated:** 2026-03-15

## Sync Batches

| Batch | ID Range | Type | Status | Started | Position | Games Added |
|-------|----------|------|--------|---------|----------|-------------|
| 1 | 1 – 500 | Sequential | ✅ Complete | Pre-Feb 2026 | 500/500 | ~3,626 |
| 2 | 200,000 – 300,000 | High-Signal | 🟠 In Progress | 2026-03-01 | ~235,296 | ~1,660 |
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
- **Limit per batch:** 7,000

### Notes
- Batch 2 originally started with `Limit: 500` which was reached at ~218k IDs. Resumed on 2026-03-09 with `Limit: 7000` to complete the full range.
- Future batches will use `Limit: 7000` to ensure full coverage.
- Processing rate: ~650 IDs/hour (~15,600 IDs/day)
- Estimated time per 100k range: ~6.5 days
- Games that fail quality filters (< 50 votes, < 5.0 avg rating) or are expansions are skipped