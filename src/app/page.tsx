// 앱 진입 — 마지막(가장 최근 연) 파이프라인으로 리다이렉트.
// 없으면 자동 생성 후 이동. 사용자가 항상 한 화면에서 시작.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pipelines = await api.listPipelines();
        if (cancelled) return;
        // 가장 최근 연 것 우선(lastOpenedAt), 없으면 최신 생성.
        const sorted = [...pipelines].sort(
          (a, b) =>
            (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt),
        );
        const target = sorted[0];
        if (target) {
          router.replace(`/pipelines/${target.id}`);
          return;
        }
        const created = await api.createPipeline("이력서 파이프라인 v1");
        if (cancelled) return;
        router.replace(`/pipelines/${created.id}`);
      } catch {
        if (!cancelled) setErr("파이프라인을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main style={{ padding: 40, color: "var(--text-dim)" }}>
      {err ?? "파이프라인을 여는 중…"}
    </main>
  );
}
