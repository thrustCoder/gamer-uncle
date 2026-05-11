# BGG Game Sync Status

**Total games in Cosmos DB:** ~14,238  
**Last updated:** 2026-05-10 ✅ All batches complete

## Sync Batches

| Batch | ID Range | Type | Status | Started | Games Added |
|-------|----------|------|--------|---------|-------------|
| 1 | 1 – 500 | Sequential | ✅ Complete | Pre-Feb 2026 | ~3,626 |
| 1b | 1 – 500 | High-Signal (re-run) | ✅ Complete | 2026-05-02 | 64 |
| 2 | 200,000 – 300,000 | High-Signal (chunked) | ✅ Complete | 2026-03-01 | ~3,772 |
| 3 | 500 – 100,000 | High-Signal | ✅ Complete | 2026-04-26 | 2,078 |
| 4 | 100,000 – 200,000 | High-Signal | ✅ Complete | 2026-05-02 | 1,991 |
| 5 | 300,000 – 400,000 | High-Signal | ✅ Complete | 2026-05-04 | 1,919 |
| 6 | 400,000 – 500,000 | High-Signal | ✅ Complete | 2026-05-06 | 788 |

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
- **Batch 6 completed** on 2026-05-08 at 19:58 UTC. 400,000→500,000, 788 games upserted across 100 chunks with no failures. Final batch — full BGG ID range 1–500,000 now synced.
- **Batch 5 completed** on 2026-05-06 at 22:45 UTC. 300,000→400,000, 1,919 games upserted across 101 chunks with no failures.
- **Batch 4 completed** on 2026-05-05 at 03:03 UTC. 100,000→200,000, 1,991 games upserted (1,466 before failure + 525 on resume). Failed at chunk 77 with transient NullRef; resumed from 177,000 and completed cleanly.
- **Batch 4 failed at chunk 77** (2026-05-04 07:03 UTC) with a transient NullReferenceException in Durable Functions replay middleware. Resumed from ID 177,000 (instance `d968618f3a284625bfd84af239193e6a`). 1,466 games upserted before failure.
- **Batch 3 completed** on 2026-04-28 at 11:41 UTC. All 100 chunks processed (500→100,000), 2,078 games upserted. ContinueAsNew fired every 15 chunks across 7 cycles with no timeout issues.
- **Batch 2 completed** on 2026-04-26 at 03:26 UTC. Final run (278,865→300,000) upserted 429 games across 22 chunks in ~8.5 hours.
- Batch 2 history: Started 2026-03-01 with `Limit: 500` (reached at ~218k). Resumed 2026-03-09 with `Limit: 7000`. Resumed 2026-04-22 from 258,865 (failed at 278,865 due to orchestrator timeout after 20 chunks, 412 games). Final resume 2026-04-25 from 278,865.
- **ContinueAsNew fix**: Deployed. `MaxChunksPerCycle=15` resets replay history every 15 chunks to prevent orchestrator timeout.
- **Limit removed**: The per-batch upsert limit was removed from the code on 2026-04-22. Quality filters (`MinVotes`, `MinAverage`, `MinBayes`) serve as the natural cap.
- Processing rate: ~2,500 IDs/hour (observed Apr 25–26; faster than earlier ~650 IDs/hr due to existing-game skips)
- Games that fail quality filters (< 50 votes, < 5.0 avg rating) or are expansions are skipped