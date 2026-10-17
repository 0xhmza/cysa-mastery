# Graph Report - cysa-mastery  (2026-10-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 193 nodes · 448 edges · 9 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 10
- Community 12
- Community 13
- Community 15

## God Nodes (most connected - your core abstractions)
1. `esc()` - 28 edges
2. `on()` - 15 edges
3. `renderResults()` - 13 edges
4. `renderSession()` - 12 edges
5. `renderHome()` - 11 edges
6. `renderDashboard()` - 11 edges
7. `pct()` - 10 edges
8. `renderProgress()` - 10 edges
9. `renderReview()` - 10 edges
10. `main()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `withIdentity()` --calls--> `shuffle()`  [EXTRACTED]
  view-lab.mjs → core.mjs
- `nextSteps()` --calls--> `loadSession()`  [EXTRACTED]
  view-learn.mjs → store.mjs
- `renderProgress()` --calls--> `formatDuration()`  [EXTRACTED]
  view-misc.mjs → ui.mjs
- `field()` --calls--> `esc()`  [EXTRACTED]
  view-practice.mjs → ui.mjs
- `renderHome()` --calls--> `esc()`  [EXTRACTED]
  view-practice.mjs → ui.mjs

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
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
Cohesion: 0.20
Nodes (9): description, name, private, scripts, import, start, test, type (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (20): isCorrect(), pickQuestions(), prepareQuestion(), shuffle(), clearSession(), loadSession(), saveSession(), formatDuration() (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (24): updateChrome(), canShuffleOptions(), dayKey(), domainStats(), dueCards(), misconceptions(), newCards(), objectiveEvidence() (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.42
Nodes (10): esc(), on(), safeExhibit(), mark(), renderCase(), renderCases(), renderLab(), renderList() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (26): bindShell(), boot(), cleanups, createContext(), loadData(), loadJson(), main, parseHash() (+18 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `esc()` connect `Community 13` to `Community 10`, `Community 12`, `Community 15`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Why does `on()` connect `Community 13` to `Community 10`, `Community 12`, `Community 15`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09486166007905138 - nodes in this community are weakly interconnected._
- **Why does `renderReview()` connect `Community 12` to `Community 13`, `Community 15`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._