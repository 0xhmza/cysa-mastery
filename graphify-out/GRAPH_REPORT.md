# Graph Report - cysa-mastery  (2026-10-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 287 nodes · 707 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c458f8cf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 8
- Community 9
- Community 10
- Community 11

## God Nodes (most connected - your core abstractions)
1. `esc()` - 36 edges
2. `on()` - 17 edges
3. `renderSession()` - 14 edges
4. `renderDashboard()` - 14 edges
5. `renderHome()` - 13 edges
6. `renderResults()` - 13 edges
7. `meter()` - 13 edges
8. `pct()` - 13 edges
9. `renderReview()` - 12 edges
10. `import_studyguide()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `withIdentity()` --calls--> `shuffle()`  [EXTRACTED]
  view-lab.mjs → core.mjs
- `nextSteps()` --calls--> `loadSession()`  [EXTRACTED]
  view-learn.mjs → store.mjs
- `renderProgress()` --calls--> `formatDuration()`  [EXTRACTED]
  view-misc.mjs → ui.mjs
- `field()` --calls--> `esc()`  [EXTRACTED]
  view-practice.mjs → ui.mjs
- `renderHome()` --calls--> `weakestObjectives()`  [EXTRACTED]
  view-practice.mjs → core.mjs

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (3): bank, DOMAINS, q()

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (26): graphify(), main(), book_questions(), cards(), community_questions(), import_media(), lessons(), main() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (9): cards, catalog, dist, imageRefs(), lessons, OBJECTIVES, original, questions (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (17): clusters(), correct_text(), jaccard(), load(), main(), prefer(), tokens(), doc_index() (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (7): attempt(), catalog, dist, guide, objectiveIds, objectives, readyFor()

### Community 5 - "Community 5"
Cohesion: 0.49
Nodes (9): on(), safeExhibit(), mark(), renderCase(), renderCases(), renderLab(), renderList(), renderPbq() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (11): build_corpus(), centroids(), classify(), cosine(), load(), main(), passages(), question_text() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (10): description, name, private, scripts, graph, import, start, test (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (26): canShuffleOptions(), isCorrect(), MASTERED_RULE, missedCount(), pickQuestions(), prepareQuestion(), shuffle(), STORAGE_KEY (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (36): domainStats(), dueCards(), masteredProgress(), misconceptions(), newCards(), objectiveEvidence(), scheduleReview(), strongProgress() (+28 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (30): bindShell(), boot(), cleanups, createContext(), loadData(), loadJson(), main, openShortcuts() (+22 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `esc()` connect `Community 10` to `Community 9`, `Community 11`, `Community 5`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `import_studyguide()` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06493506493506493 - nodes in this community are weakly interconnected._
- **Why does `on()` connect `Community 5` to `Community 9`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._