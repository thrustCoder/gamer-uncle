# BGG Game Sync Status

**Total games in Cosmos DB:** ~6,969  
**Last updated:** 2026-04-25

## Sync Batches

| Batch | ID Range | Type | Status | Started | Position | Games Added |
|-------|----------|------|--------|---------|----------|-------------|
| 1 | 1 – 500 | Sequential | ✅ Complete | Pre-Feb 2026 | 500/500 | ~3,626 |
| 2 | 200,000 – 300,000 | High-Signal (chunked) | 🟠 In Progress | 2026-03-01 | ~278,865 (resumed) | ~3,343 |
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
- Batch 2 originally started with `Limit: 500` which was reached at ~218k IDs. Resumed on 2026-03-09 with `Limit: 7000` to complete the full range. Latest resume on 2026-04-25 from ID 278,865.
- **Apr 22 run failed**: Orchestrator timed out at chunk 278,865 after processing 20 chunks (258,865→278,864, 412 games upserted). Root cause: Durable Functions 5-minute timeout exceeded due to replay history growth.
- **ContinueAsNew fix**: Added `ContinueAsNew` pattern with `MaxChunksPerCycle=15` to reset replay history periodically. Pending deployment.
- **Limit removed**: The per-batch upsert limit was removed from the code on 2026-04-22. Quality filters (`MinVotes`, `MinAverage`, `MinBayes`) serve as the natural cap.
- Processing rate: ~650 IDs/hour (~15,600 IDs/day)
- Estimated time per 100k range: ~6.5 days
- Games that fail quality filters (< 50 votes, < 5.0 avg rating) or are expansions are skipped