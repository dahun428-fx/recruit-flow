---
version: 1
name: My Recruit Document System
description: >-
  Visual identity for the owner's resume / cover-letter (자기소개서) documents.
  A4 print-first, single-column, ink-on-paper layout tuned for Korean text
  and recruiter readability. Tokens are derived from the reference document
  outputs/self-introduction-hyundai-autoever.{html,css}.
colors:
  background: "#ffffff"        # paper / page surface
  canvas: "#eeeeee"            # area around the page (screen preview only)
  text: "#1f1f1f"              # primary body + headings (near-black ink)
  subtext: "#3f4650"           # secondary lines, lead/subtitle copy
  muted: "#777777"             # labels, page numbers, footer
  accent: "#1f3d55"            # deep navy — sparing emphasis (fit notes, links)
  line: "#d7d7d7"              # rules below body / footer
  lineStrong: "#1f1f1f"        # primary divider under headers (uses {colors.text})
  lineSoft: "#eeeeee"          # hairline under topic titles
typography:
  fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif'
  wordBreak: keep-all
  documentTitle:
    fontSize: 21pt
    lineHeight: 1.2
    fontWeight: 700
    letterSpacing: "0pt"
  pageHeading:
    fontSize: 14.5pt
    lineHeight: 1.35
    fontWeight: 700
    letterSpacing: "0pt"
  topicTitle:
    fontSize: 15.5pt
    lineHeight: 1.35
    fontWeight: 700
    letterSpacing: "0pt"
  lead:
    fontSize: 8.8pt
    lineHeight: 1.5
    fontWeight: 400
  body:
    fontSize: 10.2pt
    lineHeight: 1.82
    fontWeight: 400
  emphasis:
    fontWeight: 800
  meta:
    fontSize: 8.2pt
    lineHeight: 1.4
    fontWeight: 400
  metaValue:
    fontWeight: 700
  footer:
    fontSize: 6.8pt
    lineHeight: 1.4
rounded:
  none: "0px"
spacing:
  pageWidth: 210mm
  pageHeight: 297mm
  pagePaddingTop: 18mm
  pagePaddingRight: 19mm
  pagePaddingBottom: 17mm
  pagePaddingLeft: 19mm
  pageGap: 18mm
  headerGap: 10mm
  headerPaddingBottom: 5mm
  topicPaddingTop: 5mm
  titlePaddingBottom: 3.5mm
  paragraphGap: 3.6mm
  essayMarginTop: 5.2mm
  footerInset: 8mm          # footer distance from the bottom page edge
  footerInsetX: 18mm        # footer distance from left/right page edges (1mm wider per side than the 19mm content column)
components:
  page:
    width: "{spacing.pageWidth}"
    height: "{spacing.pageHeight}"
    backgroundColor: "{colors.background}"
    padding: 18mm 19mm 17mm
  documentHeader:
    textColor: "{colors.text}"
    borderBottom: "1px solid {colors.lineStrong}"
    padding: "0 0 {spacing.headerPaddingBottom}"
  pageHeading:
    textColor: "{colors.text}"
    borderBottom: "1px solid {colors.lineStrong}"
    padding: "0 0 {spacing.headerPaddingBottom}"
  topicTitle:
    textColor: "{colors.text}"
    typography: "{typography.topicTitle}"
    borderBottom: "1px solid {colors.lineSoft}"
    padding: "0 0 {spacing.titlePaddingBottom}"
  paragraph:
    textColor: "{colors.text}"
    typography: "{typography.body}"
  fitNote:
    textColor: "{colors.subtext}"
    borderTop: "1px solid {colors.line}"
    padding: "3.5mm 0 0"
  footer:
    textColor: "{colors.muted}"
    typography: "{typography.footer}"
    borderTop: "1px solid {colors.line}"
    bottom: "{spacing.footerInset}"
    left: "{spacing.footerInsetX}"
    right: "{spacing.footerInsetX}"
---

# Overview

`my-recruit` produces the owner's job-application documents — résumés and
cover letters (자기소개서). The visual identity is **document-first, not
app-first**: every artifact is meant to print cleanly on **A4** and to be
skimmed by a recruiter in seconds. The look is quiet and editorial — black
ink on white paper, one column, generous line spacing, hairline rules, and a
single navy accent used sparingly.

Design priorities, in order:

1. **Readability of Korean long-form text.** Body copy uses `keep-all` word
   breaking and a tall `1.82` line height so paragraphs never feel cramped.
2. **Print fidelity.** Sizes are expressed in `pt`/`mm` so the on-screen
   preview and the printed PDF match exactly. Color is preserved in print
   (`print-color-adjust: exact`).
3. **Scannable hierarchy.** A clear title → page heading → topic title → body
   ladder lets a reader locate the relevant section without reading everything.
4. **Restraint.** No shadows on paper, no rounded corners, no decorative
   color. Emphasis comes from weight and rules, not from boxes or fills.

This file is the source of truth for any agent generating or editing these
documents. Prefer the tokens above over inventing new values.

## Reference implementation (start here)

These tokens are abstract; the **concrete, canonical template** that realizes
them is the owner's standard base résumé:

- `outputs/base-resume.html` — page-structured markup (fixed `.page` A4 boxes,
  `top-title`, `info-box`, `page-head`, per-page `footer`, `record`,
  `record-title`, `block`, `project`, `project-title`, `skill-block`,
  `achievement-list`/`core-item`, `major-section`). Backed by the content
  master `docs/resume-reference/base-resume.md`.
- `outputs/base-resume.css` — the stylesheet implementing every token below,
  plus the review-hardening blocks (overflow-wrap, flex `min-width: 0`,
  tabular-num dates, footer collision guards, heading hierarchy).

(`outputs/resume-career-cj-enm.{html,css}` is the earlier template it grew
from; prefer `base-resume` for anything new.)

**Any new résumé/CV artifact must start by reusing this HTML structure and CSS,
not by re-deriving a layout from the tokens.** Render it the same way it was
produced — **headless Chrome `--print-to-pdf`** — so the fixed page boxes and
`@media print` rules are honored. **Verify overflow on every render**: re-render
with `.page { height: auto; min-height: 297mm; overflow: visible }` and confirm
the total page count is unchanged — a fixed-height `.page` with
`overflow: hidden` silently clips, so this check is mandatory before shipping. Do **not** generate the artifact from a
generic Markdown→HTML converter and do **not** accept a PDF from a fallback
renderer (e.g. ReportLab); either one silently produces a different, flat,
inconsistent document. See `.claude/agents/designer.md` for the full procedure.

# Colors

The palette is intentionally narrow: a near-black ink, two grays for
secondary text, three rule weights, and one navy accent.

| Token | Value | Use |
| --- | --- | --- |
| `{colors.background}` | `#ffffff` | The page (paper) surface. |
| `{colors.canvas}` | `#eeeeee` | Area *around* the page — screen preview only; never prints. |
| `{colors.text}` | `#1f1f1f` | Primary ink: body, headings, emphasized runs. |
| `{colors.subtext}` | `#3f4650` | Lead/subtitle lines and supporting notes. |
| `{colors.muted}` | `#777777` | Labels, page numbers, footer. |
| `{colors.accent}` | `#1f3d55` | Deep navy. Reserved for fit-note headings and links. |
| `{colors.line}` | `#d7d7d7` | Standard rule (footer, fit-note divider). |
| `{colors.lineStrong}` | `#1f1f1f` | Strong divider under document/page headers. |
| `{colors.lineSoft}` | `#eeeeee` | Hairline under a topic title. |

Rules:

- **Never** introduce a color outside this list. If a new role is needed,
  add a token here first.
- Accent is for *emphasis of identity*, not for body text. A page should read
  as black-on-white with at most a touch of navy.
- On paper, all backgrounds are `{colors.background}`. `{colors.canvas}` exists
  only so the preview shows page edges; it is dropped under `@media print`.

# Typography

One family, weight- and size-driven hierarchy. No second typeface.

- **Family:** `{typography.fontFamily}` — Noto Sans KR with Malgun Gothic as
  the local fallback for Korean glyphs.
- **Word breaking:** `keep-all` everywhere, so Korean words are not split
  mid-eojeol across line ends.

Scale (print units):

| Role | Size | Line height | Weight |
| --- | --- | --- | --- |
| Document title (`h1`) | `21pt` | `1.2` | `700` |
| Page heading (`h2`) | `14.5pt` | `1.35` | `700` |
| Topic title (`h2`) | `15.5pt` | `1.35` | `700` |
| Body (`p`) | `10.2pt` | `1.82` | `400` |
| Lead / subtitle | `8.8pt` | `1.5` | `400` |
| Meta (지원자/경력/직무) | `8.2pt` | `1.4` | `400` (value `700`) |
| Footer | `6.8pt` | `1.4` | `400` |

Emphasis — three ink tiers (2026-07-27, 인사·기술·헤드헌터 3자 자문 반영):

| Tier | Weight | Tone | Used for |
| --- | --- | --- | --- |
| Body | `400` | `{colors.body}` | 서술·설명 |
| **Label** | `700` | `{colors.body}` | 불릿 머리표·구조 표지 (`실사용 서비스 전환 —`) |
| **Emphasis** | `800` | `{colors.text}` | 강조 예산을 쓴 곳 (수치·판단 구절) |

- Emphasis is still **bolder ink, not a different color** — `<strong>` never gets
  an accent color or a highlight. The tone axis exists only to *de-emphasize*
  the label tier (same principle as `.stack-paren` / `.core-chips`, both `400`
  muted), not to colorize emphasis.
- **Two axes are mandatory, not decorative.** Verified 2026-07-27: the declared
  `Noto Sans KR` is not installed on the authoring machine, so the PDF actually
  embeds `AppleSDGothicNeo` in Regular/Bold/ExtraBold — `700` vs `800` does
  render as distinct faces there. But the fallback `Malgun Gothic` ships only
  Regular and Bold, so on Windows the weight axis **collapses to two tiers**.
  The tone difference is what keeps the label tier readable everywhere. Never
  ship a label tier that relies on weight alone.
- Label tier must never carry `{colors.text}`; emphasis tier must never carry
  `{colors.body}`. If both appear on the same line, the tier collapse is visible.
- Use emphasis for the load-bearing phrase of a sentence (a result, a metric,
  a judgement criterion), never for whole sentences.

Emphasis placement — **digest policy** (2026-07-27 소유자 지시로 갱신.
배분 규칙은 `feedback-rules.md` C-03이 정본):

기준은 개수가 아니라 **"볼드만 따라 읽으면 그 자체로 요약본이 되는가"**다.
소유자 원문: *"bold 처리되는 부분을 읽음으로써 그냥 요약본을 읽은 것처럼
바로 인지가 되게끔 하고싶어."*

- **Each emphasis span must be a clause that carries subject + result**, not a
  bare keyword. `2주 납품` alone leaves the reader without "2주 만에 무엇을".
  Spans must chain into a readable digest when read in sequence.
- **No per-page count cap.** The shipped 2026-07-27 render carries ~13–21 per
  경력기술서 page and that is intended.
- The **label tier stays 700 + body tone.** This is the one constraint that
  survives — it is what fixed the original "안 읽힌다" problem. Labels must never
  render at 800, or the digest drowns in uniform bold again.
- **Bold-removal test still applies**: strip every `<strong>` and the sentence
  must still read in the same order of importance. C-03 forbids markup in
  plain-text application forms, so word order is the primary signal.

*Superseded (do not restore without owner instruction)*: the earlier scarcity
rules — one emphasis per bullet, at least half the bullets carrying none, no two
on one line, no two consecutive bullets, page budget 4–6. These came from the
2026-07-27 3자 자문 and were explicitly overridden the same day.

# Layout

A single A4 column, one logical section ("page") per printed page.

- **Page box:** `{spacing.pageWidth}` × `{spacing.pageHeight}` (`210mm × 297mm`).
- **Page padding:** `18mm 19mm 17mm` (top / sides / bottom). Content lives
  inside these margins; the footer is pinned to the bottom inset.
- **Preview gap:** pages stack vertically with `{spacing.pageGap}` between them
  on screen; in print each page breaks to its own sheet.
- **Structure of a page:**
  - First page: `document-header` (title + applicant meta) → `topic` (body).
  - Later pages: `page-heading` (heading + subtitle + page number) → `topic`.
  - Every page ends with a `footer` (left: section label, right: `n / total`),
    pinned `{spacing.footerInset}` from the bottom edge and `{spacing.footerInsetX}`
    from each side — note this is `18mm`, `1mm` wider than the `19mm` content column.
- **Header layout:** title block and meta/page-number sit on a single row,
  `justify-content: space-between`, separated by `{spacing.headerGap}`, with a
  `1px` bottom rule in `{colors.lineStrong}`.
- **Body rhythm:** the essay grid starts `{spacing.essayMarginTop}` below the
  topic title; paragraphs are separated by `{spacing.paragraphGap}` (no first-
  line indent — separation is by space, not indent).

Keep it one column. Do not add sidebars, multi-column body text, or floats.

# Elevation & Depth

There is essentially **no elevation on paper** — this is an ink document.

- Printed pages are flat: no shadows, no borders around the page itself.
- The only shadow in the system is a screen-preview affordance on the page
  box (`box-shadow: 0 4px 16px rgba(0,0,0,0.10)`) so edges read against the
  `{colors.canvas}` backdrop. It is removed under `@media print`.
- Depth and grouping are expressed with **rules**, not shadows or fills:
  - Strong rule (`{colors.lineStrong}`) under a header = top of a page.
  - Hairline (`{colors.lineSoft}`) under a topic title = start of an essay.
  - Standard rule (`{colors.line}`) above footers and fit notes = a closing.

# Shapes

- **Corners:** square. `{rounded.none}` (`0px`) is the only radius in the system.
  No rounded cards, no pills, no rounded images.
- **Dividers:** `1px` solid horizontal rules only. Three weights by color
  (`{colors.lineStrong}` / `{colors.line}` / `{colors.lineSoft}`); no double
  rules, no vertical rules.
- **Fills:** none. Notes and sections are delimited by spacing and a single
  top/bottom rule — never by a filled or tinted box. (The legacy left-border
  callout is deprecated; use a top rule instead.)

# Components

Tokens for each component are defined in the front matter `components` map;
this section explains intent and the canonical markup.

- **`page`** — the A4 sheet. `{colors.background}` surface, `18mm 19mm 17mm`
  padding, `position: relative` so the footer can pin to the bottom inset.
- **`documentHeader`** (first page) — `h1` document title plus a `dl` of
  applicant meta (지원자 / 경력 / 직무). Labels use `{colors.muted}`; values use
  weight `700`. Bottom rule: `1px solid {colors.lineStrong}`.
- **`pageHeading`** (continuation pages) — `h2` heading + lead subtitle on the
  left, two-digit `page-number` in `{colors.muted}` on the right. Same strong
  bottom rule as the document header.
- **`topicTitle`** — section `h2` at `15.5pt`, closed by a `{colors.lineSoft}`
  hairline; the essay body opens below it.
- **`paragraph`** — body text at `{typography.body}` in `{colors.text}`,
  stacked with `{spacing.paragraphGap}` between paragraphs.
- **`fitNote`** (optional) — a short "why I fit" aside. Heading in
  `{colors.accent}` at `8.8pt`; copy in `{colors.subtext}`. Separated by a top
  rule (`{colors.line}`), never a filled box.
- **`footer`** — pinned via `position: absolute`: `{spacing.footerInset}` from
  the bottom edge, `{spacing.footerInsetX}` from each side. Its side inset is
  `18mm`, so the footer rule sits `1mm` wider than the `19mm` content column on
  each side. Left: section label; right: `n / total`. `{colors.muted}` text
  above a `{colors.line}` top rule.

# Do's and Don'ts

**Do**

- Keep everything to one A4 column and print-test before shipping a PDF.
- Use the type scale and the nine color tokens exactly as named.
- Emphasize with weight `800` ink; let a single navy accent carry identity.
- Separate paragraphs with space (`{spacing.paragraphGap}`), not indents.
- Express grouping with the three rule weights.
- Keep Korean text on `keep-all` and body line height at `1.82`.
- Pin a footer with `section label` + `n / total` on every page.

**Don't**

- Don't add colors, typefaces, or radii outside this spec.
- Don't put shadows, borders, or fills on printed content (preview-only shadow
  excepted).
- Don't color or highlight `<strong>` — bolder ink only.
- Don't use the navy accent for body copy or large fills.
- Don't introduce multi-column layouts, sidebars, pills, or rounded cards.
- Don't mix `px`/`pt`/`mm` arbitrarily — type in `pt`, layout in `mm`, hairlines
  in `px`, matching the reference.
