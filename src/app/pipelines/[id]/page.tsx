// 파이프라인 페이지(/pipelines/[id]).
// PR4 이후: AppShell 내 TabEditor가 URL에서 pipelineId를 추출해
// PipelineView를 직접 렌더한다. 이 페이지는 URL 라우팅 진입점만 담당.
"use client";

export default function PipelinePage() {
  // TabEditor가 usePathname()으로 pipelineId를 추출해 PipelineView를 렌더함.
  // 이 컴포넌트는 children으로 렌더되지 않으므로 null 반환.
  return null;
}
