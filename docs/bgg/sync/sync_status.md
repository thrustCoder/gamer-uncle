# BGG Game Sync Status

**Total games in Cosmos DB:** ~7,398  
**Last updated:** 2026-04-26

## Sync Batches

| Batch | ID Range | Type | Status | Started | Position | Games Added |
|-------|----------|------|--------|---------|----------|-------------|
| 1 | 1 – 500 | Sequential | ✅ Complete | Pre-Feb 2026 | 500/500 | ~3,626 |
| 2 | 200,000 – 300,000 | High-Signal (chunked) | ✅ Complete | 2026-03-01 | 300,000/300,000 | ~3,772 |
| 3 | 500 – 100,000 | High-Signal | 🟠 In Progress | 2026-04-26 | ~500 (started) | — |
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
- **Batch 2 completed** on 2026-04-26 at 03:26 UTC. Final run (278,865→300,000) upserted 429 games across 22 chunks in ~8.5 hours.
- Batch 2 history: Started 2026-03-01 with `Limit: 500` (reached at ~218k). Resumed 2026-03-09 with `Limit: 7000`. Resumed 2026-04-22 from 258,865 (failed at 278,865 due to orchestrator timeout after 20 chunks, 412 games). Final resume 2026-04-25 from 278,865.
- **ContinueAsNew fix**: Deployed. `MaxChunksPerCycle=15` resets replay history every 15 chunks to prevent orchestrator timeout.
- **Limit removed**: The per-batch upsert limit was removed from the code on 2026-04-22. Quality filters (`MinVotes`, `MinAverage`, `MinBayes`) serve as the natural cap.
- Processing rate: ~2,500 IDs/hour (observed Apr 25–26; faster than earlier ~650 IDs/hr due to existing-game skips)
- Games that fail quality filters (< 50 votes, < 5.0 avg rating) or are expansions are skipped