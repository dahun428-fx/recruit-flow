// 캔버스 탭(/pipelines/[id]) — 팔레트 | 캔버스 | 사이드 패널.
"use client";

import { use } from "react";
import { PipelineView } from "@/components/canvas/PipelineView";

export default function PipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PipelineView pipelineId={id} />;
}
