// 앱 진입(/). PR4 IDE 셸 이후: 레이아웃의 AppShell이 children을 렌더하지
// 않으므로 이 페이지 본문은 표시되지 않는다. "/" → 마지막(또는 새) 파이프라인
// 리다이렉트는 AppShell의 진입 라우팅 effect가 담당한다.
export default function Home() {
  return null;
}
