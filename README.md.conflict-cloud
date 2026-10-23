# CySA Mastery

A private, personal learning workspace for **CompTIA CySA+ CS0-004 (V4)**. It combines concise original guides, imported curriculum, 1,451 practice questions, 2,339 flashcards on a real review schedule, analyst exercises and skill trainers, and shows honest evidence of progress instead of a predicted score.

> **Keep this repository and any deployment private.** It includes material from a commercial practice book that is licensed for private personal study only. See [NOTICE.md](NOTICE.md).

## Run it

Requires Python 3 (for the local server) and Node 20+ (for tests). There are no npm dependencies and no build step.

```bash
npm start      # serves dist/ at http://localhost:8114
npm test       # 42 tests: core logic, UI helpers, dataset integrity
```

Open `http://localhost:8114`. Opening `index.html` directly from disk will not work because the app loads JSON with `fetch`. `tools/serve.py` is used instead of `python -m http.server` because Python on Windows can serve JavaScript as `text/plain`, which blocks ES modules.

## What it does

| Area | Behaviour |
| --- | --- |
| Overview | One “Up next” action (resume, due cards, high-confidence misses, weak or unstarted objectives), today’s goal, streak, and a clickable 15-objective map showing progress toward Strong |
| Learning path | The 15 official objectives. Each has a “Path to Strong” checklist saying exactly what is missing, a short original guide (what to know, how to decide, common traps), imported readings with read tracking, and autosaved notes |
| Practice | One-click quick starts (adaptive, missed, bookmarked, original scenarios) and custom filtered sets. Pick an answer, then check it by saying how sure you are (one click or keys 1–3). Explanations, ✓/✗ marks, a link back to the objective guide after a miss, a running score, resumable sessions |
| Full-length sets | Book Practice Test 1 and 2 (85 questions each), and a weighted mixed mock (85 questions, 29/22/20/14 across domains). 165 minutes, no feedback until the end, question navigator, flagging. The clock pauses when you leave the page and auto-submits at zero |
| Spaced review | Again/Hard/Good/Easy scheduling with interval previews, a daily new-card limit, session progress, filters that apply instantly, long answers collapsed until you ask |
| Analyst lab | 3 original multi-step cases, 30 performance-based exercises, and 20 scripted lab simulations (clearly labelled as simulations) |
| Skill trainers | The 13 standalone HTML trainers from the CySA-004 repo, plus 11 reference graphics |
| Progress | Per-objective evidence, domain accuracy, misconceptions (sure and wrong), full-length history, notes, JSON backup and restore |
| Library | Official objectives PDF, course notes, sources and licences, and a list of the corrections applied |

Press `?` anywhere for the keyboard shortcuts.

### How progress is judged

Objective status comes from what you did, never from a predicted score:

- **New**: nothing yet. **Learning**: guide read. **Practicing**: at least one tagged answer.
- **Strong**: guide read, at least 8 distinct tagged questions, and at least 80% on the most recent 10 answers.
- Question tags have a visible trust level. **Original** and **reviewed** mappings were checked. **Indicative** tags came from the source author and are counted but reported separately. **Domain only** questions (all practice-book questions) carry no objective evidence.

CompTIA's 100–900 scaled score cannot be derived from a practice percentage, so none is shown.

### Where your progress lives

Progress, notes and bookmarks are stored in this browser's `localStorage` and never leave it. Clearing site data, using another browser, or changing device loses it. Use **Settings > Export progress** to back up and **Import** to restore. Imports are validated and sanitised.

## Architecture

```
dist/                   the deployable site (static, buildless, ES modules)
  index.html            shell and navigation
  app.js                bootstrap, hash router, shared context, teardown of timers and listeners
  core.mjs              pure logic: selection, shuffling, evidence, scheduling, streaks, import validation
  store.mjs             localStorage persistence with failure handling
  ui.mjs                escaping, sanitised exhibits, chips, helpers
  view-learn.mjs        overview, learning path, objective pages
  view-practice.mjs     setup, sessions, exams, results
  view-review.mjs       flashcards
  view-lab.mjs          cases, PBQs, scripted labs
  view-misc.mjs         trainers, progress, library, settings
  data/                 generated JSON (questions, lessons, cards, original, pbqs, labs, catalog)
  media/ trainers/ library/ licenses/   generated assets
content/enrichment.json hand-authored original guides, questions and cases (compact source)
tools/import_content.py deterministic importer: sanitises HTML, exports media, applies corrections
tools/serve.py          local static server with explicit MIME types
tests/                  node --test suites
docs/                   repository assessment
```

`core.mjs` has no DOM access so it can be tested directly. State shape (`cysa-mastery.v1`): attempts (with `objective` for trusted mappings and `hint` for indicative ones), reviews, lesson and objective read flags, case results, bookmarks, exam history, activity log, notes.

### Regenerating the data

`dist/data` and the media are generated by `tools/import_content.py` from sources that are **not** in this repository (the book EPUB, the two upstream forks, the Anki package and the audit extracts). They are committed so the site is self-contained. To regenerate you need those inputs next to the project folder, `beautifulsoup4`, and `zstandard` for the modern Anki package:

```bash
python -X utf8 tools/import_content.py
```

The importer fails if counts, answer labels or objective ids stop matching. Edit `content/enrichment.json` to change original content and re-run it.

## Content provenance

| Content | Origin | Terms |
| --- | --- | --- |
| Application code, original guides, 45 original questions, 3 cases | This project | No licence granted; private repository. The owner chooses a licence before any sharing |
| 51 readings, 400 questions, 400 flashcards, 30 PBQs, 20 labs | [cysa-plus](https://github.com/0xhmza/cysa-plus) (Rizwan Virani) | MIT code, **CC BY-NC-SA 4.0** curriculum: attribution, non-commercial, share-alike |
| 13 trainers, 11 graphics, 1,939 Anki notes | [CySA-004](https://github.com/0xhmza/CySA-004) (Scotty) | MIT notice; embedded excerpts and media may keep their own rights |
| 1,006 practice questions and 150 images | *CompTIA CySA+ Practice Tests, 4th edition* (Chapple and Seidl, Wiley) | Copyright Wiley. Private personal study only |

Corrections applied to imported content (detection-metric definitions, CVSS version wording, remapped objective tags, removed readiness score, labelled simulations) are listed in the in-app library and in [docs/repository_assessment.md](docs/repository_assessment.md).

## Known limitations

- Content accuracy was inventoried in full but **sampled**, not verified item by item. Treat explanations as study aids and check against the official objectives.
- Tag-based statistics depend on mapping quality. Practice-book questions contribute to domain statistics only.
- Lab simulations return scripted output. There is no live shell, scanner or SIEM.
- Flashcard scheduling is a simplified SM-2 style algorithm, not Anki's.
- Progress is per browser and per device; there is no sync.
- The official CS0-004 launch date could not be confirmed from a primary source, so it is not shown.
- No guarantee of passing the exam is made or implied.
