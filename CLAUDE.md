## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `python tools/graph.py` to rebuild the graph (AST-only, no API cost). Do not run `graphify update .` here: it skips `dist/` and would drop the web app from the graph.
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Token hygiene

- Never Read `dist/data/*.json` (multi-MB), `dist/media`, `dist/trainers` or PDFs. Inspect them with a short `node -e` / `python -c` script that prints counts or one record.
- Content is generated: edit `content/enrichment.json` or `tools/import_content.py`, then run `npm run import`. Do not hand-edit `dist/data`.
- Rebuild the graph with `npm run graph` after code changes (AST only, no API cost). If `graphify` is not on PATH use `python -X utf8 -m graphify ...`.
- Tests: `npm test` (node:test, no dependencies).
