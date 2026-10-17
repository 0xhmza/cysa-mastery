# Assessment of the two forked CySA+ repositories

Assessed 16 October 2026 against the official **CompTIA CySA+ CS0-004 exam objectives, version 2.0** (SHA-256 recorded in `repository_inventory.json`). The forks were cloned and left unchanged.

## How to read this report

**What was verified:** a full structural inventory of both repositories (file counts, data shapes, answer indices, tag counts, duplicates) and a manual review of a stratified sample of 75 question prompts across the 15 source objective tags, plus targeted checks of specific topics (Nmap flags, Wireshark filters, CVSS 4.0 metrics, detection metrics, impossible-travel handling).

**What was not verified:** every item for technical accuracy. Counts of objective tags are author-supplied labels and are not evidence of coverage. Nothing here predicts exam performance.

Machine-readable evidence is in this folder: `repository_inventory.json`, `cysa-plus-data.json`, `anki_notes.json`, `anki_findings.json`, `question_review_sample.json`.

## Summary

| | `cysa-plus` | `CySA-004` |
| --- | --- | --- |
| Best use | Structured reading, flashcards, scenario exercises | Drill trainers and a large Anki deck for recall |
| Content | 51 reading sections, 400 MCQs, 400 flashcards, 30 PBQs, 20 scripted labs | 13 HTML trainers, 11 reference graphics, 1,939 Anki notes |
| Licence | MIT code; CC BY-NC-SA 4.0 curriculum (Rizwan Virani) | MIT notice (copyright 2026 Scotty); embedded excerpts may keep their own rights |
| Main strength | Complete objective headings, broad reading, clear structure | Dense reference recall across all 15 objectives, practical tool drills |
| Main weakness | Answer-length bias, wrong objective tags, one metrics error, a readiness score that is not valid | Overloaded answers, a few overconfident notes, some unreliable graphics |
| Decision | Use, with corrections applied | Use, with progressive reveal and caveats |

## `cysa-plus` (commit `e3c22929f3e05fa9950e725d597e4b0908fbac6d`)

### What is good

- All 15 objectives appear in the metadata and the reading is broad. The bank is balanced at 100 MCQs per domain.
- No duplicate question prompts were found. All 400 MCQ answer indices and all PBQ field answer indices are valid.
- Performance-based items and scripted labs add decision practice that the practice book lacks.

### Findings

1. **Detection-metric definitions are wrong in domain 4.** Precision is conflated with the true-positive rate and the false-discovery proportion with the false-positive rate. Questions D4-058 and D4-086 inherit the problem. Correct definitions:
   - Precision = TP / (TP + FP)
   - False-discovery proportion = FP / (TP + FP)
   - True-positive rate (recall) = TP / (TP + FN)
   - False-positive rate = FP / (FP + TN)
   - TPR and FPR are not complements: they use different denominators.
   *Action taken:* the reading and both questions are rewritten in the imported data; original questions ORG-07 to ORG-10 and case 3 teach the denominators explicitly.
2. **Objective tags contain many errors.** Examples: D1-029 to D1-041 (tool questions) are tagged 1.4; D1-042 to D1-048 (threat intelligence) are tagged 1.5; D2-051 (CVSS) is tagged 2.1. Four of the six questions tagged AI 1.6 (D1-097 to D1-100) actually test metrics or coverage mapping; the five genuine AI questions found are D1-049, D1-050 and D1-075 to D1-077, three of them tagged 1.2.
   *Action taken:* selected domain 1 questions were remapped; uncertain ones are left at domain level; unreviewed source tags are shown as "indicative" and reported separately from reviewed mappings.
3. **Answer-length bias.** In 279 of 400 questions (69.8%) the correct option is uniquely the longest. A trivial "pick the first longest option" heuristic scores 286 of 400. This is evidence of answer-writing bias, not a pass probability.
   *Action taken:* original questions in this workspace were written with comparable option lengths and a regression test caps the bias.
4. **Implausible distractors.** Some options (coffee, fonts, electricity bills, wallpaper) make performance look better than realistic analyst judgment would support.
5. **AI coverage is thin in the question and flashcard layers.** The reading does cover AI risk and governance, but reinforcement is weak.
   *Action taken:* six original AI questions (ORG-01 to ORG-06) were added.
6. **CVSS reading mixes versions.** CVSS v3.1 Scope language appears alongside CVSS v4.0 metric groups before the distinction is explained, and an abbreviated vector is used as though it were complete.
   *Action taken:* wording corrected; original questions ORG-12 to ORG-15 cover prioritization, EPSS, the v4.0 groups and incomplete vectors.
7. **The scripted labs are simulations.** Commands return canned output (`app.js` lines 967 to 984 in the fork), and a free-text payload step completes on any non-empty input.
   *Action taken:* labs are labelled as guided simulations and the payload step is shown as not graded.
8. **The readiness estimate is not valid.** `quizEngine.js` line 1284 converts raw percent linearly to a 100 to 900 score and displays "Likely Pass". CompTIA's scaled score cannot be derived from a practice percentage.
   *Action taken:* not carried over. This workspace reports objective evidence and never a pass prediction.
9. **The exam launch date is questionable.** The fork's `exam.launched` says 2025. A date of 23 June 2026 appears in secondary sources but could not be confirmed from the official page.
   *Action taken:* no launch date is shown in the product.

## `CySA-004` (commit `1f58cd01d3243a3ed3db01c53ac6e3c1dd0216aa`)

### What is good

- 37 tracked files: 13 standalone HTML trainers (Nmap, Wireshark, CVSS 4.0, Snort, frameworks, logging, Windows and Linux file systems and processes, living-off-the-land binaries, OT and ICS, regex, tools, SOC roles), 11 WebP reference graphics, and a modern Anki package with 1,939 notes and 1,939 cards.
- The deck is broader than the trainer list. All 15 objectives have explicitly tagged notes, including 110 notes tagged 1.6 (AI). The repository should not be described as lacking AI or reporting content.
- Sampled Nmap flag definitions, Wireshark filter distinctions and CVSS 4.0 metric definitions were useful and generally sound.

### Findings

1. **Tag coverage is partial, and counts are not validated.** 1,238 notes have an explicit objective tag and 701 do not. These are author labels, not coverage measurements.
2. **Answers are overloaded.** Median answer length is 129 words and 584 answers exceed 200 words. That suits reference reading but hurts recall practice.
   *Action taken:* long answers are collapsed until the learner chooses to expand them.
3. **One note is too categorical.** The impossible-travel note (`1784756589583`) treats the alert as near-proof of credential compromise and claims low false-positive rates. Teaching should stress corroboration with VPN, device, token, location and authentication context.
   *Action taken:* flagged in the library; original question ORG-27 and case 1 teach corroboration.
4. **Different incident-response models are in play.** The SOC trainer teaches a six-step operational workflow, while objective 3.2 uses seven stages. Both are legitimate, but they must stay labelled. The repository's own `NOTES_CertMaster_Ambiguities.md` gives context.
5. **Graphics are supplementary, not authoritative.** The two inspected graphics were checked visually. The cyber-kill-chain graphic contains lettering mistakes (for example "Dehectiont").
6. **One note links to a remote image.** Remote media is not loaded offline; a placeholder is shown.
7. **Provenance.** The README acknowledges AI-assisted authoring and personal study intent. Keep the MIT notice; embedded excerpts and media may retain their original rights.

## Material not integrated

- `practice exams 003/` is older (CS0-003) material and was not assessed. CS0-004 is the curriculum baseline.
- The study guide EPUB was not parsed or integrated.

## Integration decisions

- Imported content keeps its source label and licence, and objective mappings carry a visible trust level: **original** and **reviewed** (checked), **indicative** (source-supplied, unverified), or **domain only** (no objective evidence). Book questions are never given invented objective tags.
- "Strong" for an objective requires the guide to be read, at least 8 distinct tagged questions, and at least 80% on the most recent 10 answers. This is evidence of practice, not a prediction.
- The practice book and Anki material are for private personal study. The site and repository should remain private.
