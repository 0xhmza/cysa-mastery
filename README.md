# CySA Mastery

A private, personal learning workspace for **CompTIA CySA+ CS0-004 (V4)**. It combines the full study guide, concise original objective guides with deep dives, 1,791 practice questions, 2,328 flashcards on a real review schedule, analyst exercises and skill trainers, and shows honest evidence of progress instead of a predicted score.

> **Keep this repository and any deployment private.** It includes material from commercial books that is licensed for private personal study only. See [NOTICE.md](NOTICE.md).

## Run it

Requires Python 3 (for the local server) and Node 20+ (for tests). There are no npm dependencies and no build step.

```bash
npm start      # serves dist/ at http://localhost:8114
npm test       # 60 tests: core logic, mastery rules, UI helpers, dataset integrity
```

Open `http://localhost:8114`. Opening `index.html` directly from disk will not work because the app loads JSON with `fetch`. `tools/serve.py` is used instead of `python -m http.server` because Python on Windows can serve JavaScript as `text/plain`, which blocks ES modules.

## What it does

| Area | Behaviour |
| --- | --- |
| Overview | One “Up next” action, a daily-goal ring, an exam-date plan (questions, guides and cards per day), and a clickable 15-objective map showing progress toward Strong and Mastered |
| Learning path | The 15 official objectives. Each has a “Path to Strong / Mastered” checklist, a short original guide with **deep dives** on the topics the official list calls out, the study-guide sections that cover it, imported readings, and autosaved notes |
| Study guide | All 12 chapters of the Chapple and Seidl study guide with Exam Essentials, per-section read tracking, figures, and a practice set per chapter |
| Practice | Quick starts (**Fix my weak spots**, adaptive, missed, bookmarked, original scenarios), custom sets, confidence-based checking (one click or keys 1–3), explanations, a link back to the guide after a miss, resumable sessions |
| Full-length sets | Book Practice Test 1 and 2 (85 questions each) and a weighted mock (85 questions, 29/22/20/14 across domains). 165 minutes, no feedback until the end, question map, flagging, a pace readout against the 1:56-per-question average. The clock pauses when you leave and auto-submits at zero |
| Spaced review | Again/Hard/Good/Easy scheduling with interval previews, a daily new-card limit, session progress, instant filters, long answers collapsed until you ask |
| Analyst lab | 3 original multi-step cases, 30 performance-based exercises, and 20 scripted lab simulations (clearly labelled) |
| Skill trainers | The 13 standalone HTML trainers from the CySA-004 repo, plus 11 reference graphics |
| Progress | Per-objective evidence, domain accuracy, misconceptions (sure and wrong), full-length history, notes, JSON backup and restore |
| Library | Official objectives, course notes, sources and licences, corrections, content audit notes and an exam-day approach |

Press `?` anywhere for the keyboard shortcuts.

### How progress is judged

Objective status comes from what you did, never from a predicted score:

- **New** → **Learning** (guide read) → **Practicing** (a tagged answer).
- **Strong**: guide read, at least 8 distinct tagged questions, and 80% or more on the most recent 10.
- **Mastered**: Strong, plus at least 20 distinct tagged questions, 90% or more on the most recent 20, and no question whose latest answer is still wrong.

Question tags have a visible trust level: **original** and **reviewed** were checked; **indicative** came from the source author; **inferred** was assigned by a text-similarity model (see below); **domain only** carries no objective evidence. The last three are counted together as indicative evidence and never shown as checked.

CompTIA's 100–900 scaled score cannot be derived from a practice percentage, so none is shown. Mastered is a stricter bar for your own practice record, not a pass guarantee.

### Where your progress lives

Progress, notes and bookmarks are stored in this browser's `localStorage` and never leave it. Clearing site data, using another browser, or changing device loses it. Use **Settings > Export progress** to back up and **Import** to restore. Imports are validated and sanitised.

## Content integrity

The data pipeline is repeatable and every stage is checked:

```bash
npm run import   # import sources, then audit duplicates, infer objectives, measure coverage
```

| Step | Tool | Result |
| --- | --- | --- |
| Import | `tools/import_content.py`, `tools/import_studyguide.py` | Sanitised HTML, exported media, corrections applied, counts asserted |
| Duplicates | `tools/audit_content.py` → `docs/content_audit.json` | 13 near-identical questions and 11 cards removed from practice; re-worded variants kept |
| Objective inference | `tools/infer_objectives.py` → `docs/objective_inference.json` | Validated leave-one-chapter-out: about 70% accurate overall, 89% at the threshold used (27 test questions, so roughly 75–95%) |
| Coverage | `tools/coverage.py` → `docs/coverage.json` | 358 official sub-topics checked against readings, cards and questions; gaps filled with original content |

Original questions are written with balanced option lengths (the community bank's correct answer is the longest option 70% of the time), and a test caps that bias.

## Architecture

```
dist/                   the deployable site (static, buildless, ES modules)
  index.html            shell, navigation, shortcuts dialog
  app.js                bootstrap, hash router, shared context, teardown of timers and listeners
  core.mjs              pure logic: selection, shuffling, evidence tiers, scheduling, study plan, import validation
  store.mjs             localStorage persistence with failure handling
  ui.mjs                escaping, sanitised exhibits, chips, meters, helpers
  view-learn.mjs        overview, learning path, objective pages
  view-guide.mjs        study guide reader and the shared read-tracking components
  view-practice.mjs     setup, sessions, exams, results
  view-review.mjs       flashcards
  view-lab.mjs          cases, PBQs, scripted labs
  view-misc.mjs         trainers, progress, library, settings
  data/                 generated JSON (questions, guide, lessons, cards, original, pbqs, labs, catalog, duplicates, inferred)
  media/ trainers/ library/ licenses/   generated assets
content/enrichment.json hand-authored original guides, questions and cases
content/gapfill.json    original deep dives and questions for thin official topics
tools/                  importers, audit, inference, coverage, local server, graph builder
tests/                  node --test suites
docs/                   repository assessment, content audit, coverage, inference metrics
```

`core.mjs` has no DOM access so it can be tested directly. State shape (`cysa-mastery.v1`): attempts (with `objective` for trusted mappings and `hint` for indicative ones), reviews, lesson and objective read flags, case results, bookmarks, exam history, activity log, notes, and a profile (name, daily goal, new cards per day, exam date).

### Regenerating the data

`dist/data` and the media are generated from sources that are **not** in this repository (the two book EPUBs, the two upstream forks, the Anki package and the audit extracts). They are committed so the site is self-contained. To regenerate you need those inputs next to the project folder, plus `beautifulsoup4` and `zstandard`:

```bash
npm run import
```

The importer fails if counts, answer labels or objective ids stop matching. Edit `content/*.json` to change original content and re-run it. After code changes, `npm run graph` rebuilds the code knowledge graph used to keep tooling cheap on tokens.

## Content provenance

| Content | Origin | Terms |
| --- | --- | --- |
| Application code, original guides, deep dives, 138 original questions, 3 cases | This project | No licence granted; private repository. The owner chooses a licence before any sharing |
| 51 readings, 400 questions, 400 flashcards, 30 PBQs, 20 labs | [cysa-plus](https://github.com/0xhmza/cysa-plus) (Rizwan Virani) | MIT code, **CC BY-NC-SA 4.0** curriculum: attribution, non-commercial, share-alike |
| 13 trainers, 11 graphics, 1,939 Anki notes | [CySA-004](https://github.com/0xhmza/CySA-004) (Scotty) | MIT notice; embedded excerpts and media may keep their own rights |
| 1,006 practice questions and 150 images | *CompTIA CySA+ Practice Tests, 4th edition* (Chapple and Seidl, Wiley) | Copyright Wiley. Private personal study only |
| 12 chapters, 240 review questions, 20 assessment questions, 139 figures | *CompTIA CySA+ Study Guide, 4th edition* (Chapple and Seidl, Wiley) | Copyright Wiley. Private personal study only |

Not integrated, on purpose: a set of CS0-003 exam files (the retired version, and numbered real-exam style dumps are not a sound study source), and the course-notes PDF, which is used only to check topic coverage.

Corrections applied to imported content are listed in the in-app library and in [docs/repository_assessment.md](docs/repository_assessment.md).

## Known limitations

- Content accuracy was inventoried in full but **sampled**, not verified item by item. Treat explanations as study aids and check against the official objectives.
- About 800 practice-book and study-guide questions still have no objective, so they inform domain statistics only. About 370 more carry an inferred objective that is roughly 70–90% reliable.
- Lab simulations return scripted output. There is no live shell, scanner or SIEM.
- Flashcard scheduling is a simplified SM-2 style algorithm, not Anki's.
- Progress is per browser and per device; there is no sync.
- The official CS0-004 launch date could not be confirmed from a primary source, so it is not shown.
- No guarantee of passing the exam is made or implied.
