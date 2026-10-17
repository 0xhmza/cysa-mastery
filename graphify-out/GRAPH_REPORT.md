# Graph Report - cysa-mastery  (2026-10-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 207 nodes · 504 edges · 9 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `781ef51f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 10
- Community 11
- Community 13
- Community 14

## God Nodes (most connected - your core abstractions)
1. `esc()` - 32 edges
2. `on()` - 15 edges
3. `renderSession()` - 14 edges
4. `renderDashboard()` - 13 edges
5. `renderResults()` - 13 edges
6. `pct()` - 12 edges
7. `renderHome()` - 12 edges
8. `renderReview()` - 12 edges
9. `meter()` - 11 edges
10. `dayKey()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `renderReview()` --calls--> `dueCards()`  [EXTRACTED]
  view-review.mjs → core.mjs
- `createContext()` --calls--> `todayCount()`  [EXTRACTED]
  app.js → core.mjs
- `renderSession()` --calls--> `meter()`  [EXTRACTED]
  view-practice.mjs → ui.mjs
- `renderReview()` --calls--> `meter()`  [EXTRACTED]
  view-review.mjs → ui.mjs
- `renderHome()` --calls--> `pct()`  [EXTRACTED]
  view-practice.mjs → ui.mjs

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (3): bank, DOMAINS, q()

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (3): graphify(), main(), Handler

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (9): cards, catalog, dist, imageRefs(), lessons, OBJECTIVES, original, questions (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (15): book_questions(), cards(), community_questions(), import_media(), lessons(), main(), original_content(), protobuf() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (10): description, name, private, scripts, graph, import, start, test (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (26): updateChrome(), canShuffleOptions(), dayKey(), domainStats(), dueCards(), misconceptions(), objectiveEvidence(), streak() (+18 more)

### Community 11 - "Community 11"
Cohesion: 0.23
Nodes (21): isCorrect(), missedCount(), pickQuestions(), prepareQuestion(), shuffle(), clearSession(), loadSession(), saveSession() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (27): bindShell(), boot(), cleanups, createContext(), loadData(), loadJson(), main, openShortcuts() (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (17): newCards(), scheduleReview(), esc(), kbd(), on(), safeExhibit(), mark(), renderCase() (+9 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `esc()` connect `Community 14` to `Community 10`, `Community 11`, `Community 13`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `on()` connect `Community 14` to `Community 10`, `Community 11`, `Community 13`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09486166007905138 - nodes in this community are weakly interconnected._
- **Why does `renderReview()` connect `Community 14` to `Community 10`, `Community 13`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._