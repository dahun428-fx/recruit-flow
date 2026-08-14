// 이력서 HTML 템플릿('default') — DESIGN.md 토큰 이식, 자기완결형 1파일, 인라인 CSS.
// A4·@media print·페이지 넘김 보장. LLM 아님 — 결정론적 코드 변환(결정 10).
// 색/타입스케일/룰은 C:\workspaces2\my-recruit\DESIGN.md 기준.

/** 템플릿 카탈로그(M1은 'default' 1종). */
export const TEMPLATES = ["default"] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export function isTemplateId(id: string): id is TemplateId {
  return (TEMPLATES as readonly string[]).includes(id);
}

/**
 * 본문 HTML(마크다운 렌더 결과)을 자기완결형 문서로 감싼다.
 * - 인라인 <style> 하나, 외부 리소스 참조 없음.
 * - A4 페이지, @media print에서 페이지 넘김·마진 보장.
 * - DESIGN.md 색·타입스케일·룰 토큰 적용(§8-D 추천: 흐름 템플릿, .page 고정박스 v2).
 */
export function wrapDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main class="resume">
${bodyHtml}
</main>
</body>
</html>
`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────
// DESIGN.md 토큰 기반 스타일
// 색: ink #1f1f1f · subtext #3f4650 · muted #777 · accent(navy) #1f3d55
//     line #d7d7d7 · lineStrong #1f1f1f · lineSoft #eeeeee · paper #fff · canvas #eee
// 폰트: Noto Sans KR → Malgun Gothic 폴백, word-break: keep-all
// 타입스케일(pt): h1 21/1.2/700, h2 14.5/1.35/700, body 10.2/1.82/400,
//                 meta 8.2/1.4, footer 6.8/1.4. strong = weight 800(색 아님).
// 레이아웃: A4 210×297mm, padding 18mm 19mm 17mm, 단일 컬럼.
//           라운드 0px, 그림자 없음(화면 미리보기 전용 shadow 1개), fill 없음.
// 인쇄: @page{size:A4}, print-color-adjust:exact, @media print에서 shadow·canvas 제거.
// ─────────────────────────────────────────────
const STYLE = `
/* ── DESIGN.md 색 토큰 ─────────────────────────── */
:root {
  --ink:        #1f1f1f;  /* 본문·제목 기본 잉크 */
  --subtext:    #3f4650;  /* 보조 텍스트·리드 */
  --muted:      #777777;  /* 레이블·페이지번호·footer */
  --accent:     #1f3d55;  /* 딥 네이비 — 링크·fit-note 헤딩 */
  --line:       #d7d7d7;  /* 표준 규칙선(footer·fit-note) */
  --line-strong:#1f1f1f;  /* 헤더 하단 강한 구분선 */
  --line-soft:  #eeeeee;  /* topic 제목 하단 헤어라인 */
  --paper:      #ffffff;  /* 페이지 배경 */
  --canvas:     #eeeeee;  /* 화면 미리보기 배경(인쇄 시 제거) */
  --page-w:     210mm;
  --page-pad-t: 18mm;
  --page-pad-x: 19mm;
  --page-pad-b: 17mm;
}

/* ── 기본 리셋 ────────────────────────────────── */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--canvas);
  color: var(--ink);
  /* Noto Sans KR → Malgun Gothic 폴백(DESIGN.md typography.fontFamily) */
  font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  /* body: 10.2pt / 1.82 / 400 */
  font-size: 10.2pt;
  line-height: 1.82;
  font-weight: 400;
  /* 한국어 어절 단위 개행 */
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* ── 페이지 박스(화면: 중앙 카드, 인쇄: 자동) ── */
.resume {
  width: var(--page-w);
  min-height: 297mm;
  margin: 24px auto;
  padding: var(--page-pad-t) var(--page-pad-x) var(--page-pad-b);
  background: var(--paper);
  /* 화면 미리보기 전용 shadow — @media print에서 제거 */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10);
  /* 인쇄 색 보존(DESIGN.md "print-color-adjust: exact") */
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* ── h1: 문서 제목 — 21pt / 1.2 / 700 ─────────── */
.resume h1 {
  font-size: 21pt;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0pt;
  color: var(--ink);
  /* 헤더 하단 강한 구분선(DESIGN.md components.documentHeader) */
  border-bottom: 1px solid var(--line-strong);
  padding-bottom: 5mm;
  margin-bottom: 5mm;
  /* 페이지 넘김 시 제목 뒤 잘림 방지 */
  break-after: avoid;
  page-break-after: avoid;
}

/* ── h2: 페이지 헤딩 / 섹션 제목 — 14.5pt / 1.35 / 700 ── */
/* DESIGN.md: pageHeading=14.5pt, topicTitle=15.5pt.
   마크다운 단일 ## 구조에서는 14.5pt로 통일(흐름 템플릿 제약).
   topicTitle 15.5pt는 h3가 아니라 .topic-title 클래스로 향후 분리한다
   — h3에 매핑하면 ###이 ##보다 커지는 위계 역전이 생긴다. */
.resume h2 {
  font-size: 14.5pt;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: 0pt;
  color: var(--ink);
  /* 헤더 하단 강한 구분선 */
  border-bottom: 1px solid var(--line-strong);
  padding-bottom: 5mm;
  margin-top: 10mm;
  margin-bottom: 3.6mm;
  break-after: avoid;
  page-break-after: avoid;
}

/* ── h3: 소항목 제목 ──────────────────────────── */
/* h2(섹션, 14.5pt)의 하위이므로 반드시 h2보다 작아야 한다.
   과거 DESIGN.md의 topicTitle 15.5pt를 그대로 h3에 매핑해 ###이 ##보다
   크게 보이는 위계 역전이 있었다 — 12.5pt로 내려 h2 > h3 > body를 회복. */
.resume h3 {
  font-size: 12.5pt;
  line-height: 1.35;
  font-weight: 700;
  color: var(--ink);
  /* 헤어라인(lineSoft) — topic 제목 하단 */
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 3.5mm;
  margin-top: 5mm;
  margin-bottom: 3.6mm;
  break-after: avoid;
  page-break-after: avoid;
}

/* ── h4~h6: 세부 소제목 ───────────────────────── */
.resume h4, .resume h5, .resume h6 {
  font-size: 10.2pt;
  line-height: 1.82;
  font-weight: 700;
  color: var(--subtext);
  margin-top: 3.6mm;
  margin-bottom: 1.8mm;
  break-after: avoid;
  page-break-after: avoid;
}

/* ── 본문 단락 ─────────────────────────────────── */
.resume p {
  font-size: 10.2pt;
  line-height: 1.82;
  font-weight: 400;
  color: var(--ink);
  margin-top: 3.6mm;
  margin-bottom: 0;
}
/* 단락 사이 여백(paragraphGap 3.6mm) — 첫 단락은 위 여백 없음 */
.resume p + p { margin-top: 3.6mm; }

/* ── 강조: weight 800, 색 유지(DESIGN.md emphasis) ── */
.resume strong {
  font-weight: 800;
  color: inherit;
}
.resume em {
  font-style: italic;
  color: var(--subtext);
}

/* ── 목록 ─────────────────────────────────────── */
.resume ul, .resume ol {
  margin: 3.6mm 0 3.6mm 5mm;
  padding: 0;
}
.resume li {
  margin: 1.8mm 0;
  line-height: 1.82;
  break-inside: avoid;
  page-break-inside: avoid;
}

/* ── 링크: accent navy ──────────────────────────── */
.resume a {
  color: var(--accent);
  text-decoration: none;
}
.resume a:hover { text-decoration: underline; }

/* ── 수평선: 표준 규칙선(line #d7d7d7) ─────────── */
.resume hr {
  border: none;
  border-top: 1px solid var(--line);
  margin: 5mm 0;
}

/* ── 인라인 코드 ────────────────────────────────── */
.resume code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 9pt;
  background: var(--line-soft);
  padding: 1px 4px;
  border-radius: 0;  /* DESIGN.md: rounded.none = 0px */
}

/* ── 코드 블록 ──────────────────────────────────── */
.resume pre {
  background: var(--line-soft);
  padding: 3.6mm 4mm;
  overflow-x: auto;
  break-inside: avoid;
  page-break-inside: avoid;
}
.resume pre code { background: none; padding: 0; }

/* ── 인용구(blockquote) — fit-note 스타일 적용 ── */
/* DESIGN.md fitNote: subtext 색, 상단 line(#d7d7d7) 규칙선 */
.resume blockquote {
  margin: 3.6mm 0;
  padding: 3.5mm 0 0;
  border-top: 1px solid var(--line);
  color: var(--subtext);
  font-size: 8.8pt;
  line-height: 1.5;
}

/* ── 표 ─────────────────────────────────────────── */
.resume table {
  width: 100%;
  border-collapse: collapse;
  margin: 3.6mm 0;
  break-inside: avoid;
  page-break-inside: avoid;
}
.resume th, .resume td {
  border: 1px solid var(--line);
  padding: 2mm 3mm;
  text-align: left;
  font-size: 10.2pt;
  line-height: 1.82;
}
.resume th {
  font-weight: 700;
  color: var(--subtext);
  font-size: 8.2pt;  /* meta: 8.2pt */
}

/* ── 이미지 ─────────────────────────────────────── */
.resume img {
  max-width: 100%;
  display: block;
}

/* ── 페이지 넘김 보호 ────────────────────────────── */
.resume h1, .resume h2, .resume h3,
.resume h4, .resume h5, .resume h6 {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* ── 인쇄 설정 ──────────────────────────────────── */
/* @page: A4, 여백 없음(padding은 .resume가 담당) */
@page {
  size: A4;
  margin: 0;
}

@media print {
  /* canvas 제거 */
  html, body {
    background: var(--paper);
  }
  /* 페이지 박스: 화면 스타일 제거, 인쇄 레이아웃으로 전환 */
  .resume {
    width: 100%;
    min-height: 0;
    margin: 0;
    /* 패딩 유지(A4 여백) */
    padding: var(--page-pad-t) var(--page-pad-x) var(--page-pad-b);
    box-shadow: none;
  }
}
`;
