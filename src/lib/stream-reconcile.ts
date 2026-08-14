/**
 * 누적 문자열에 offset 기반 델타를 멱등 병합한다.
 *
 * - 이미 스냅샷에 포함된 앞부분은 건너뛴다.
 * - 일부만 포함됐으면 보이지 않은 suffix만 붙인다.
 * - offset이 현재 길이보다 크면 유실 구간이 있으므로 적용하지 않는다.
 */
export function mergeTextDelta(
  current: string,
  offset: number,
  chunk: string,
): { content: string; hasGap: boolean } {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return { content: current, hasGap: true };
  }

  if (offset > current.length) {
    return { content: current, hasGap: true };
  }

  const overlapLength = Math.min(current.length - offset, chunk.length);
  if (
    current.slice(offset, offset + overlapLength) !==
    chunk.slice(0, overlapLength)
  ) {
    return { content: current, hasGap: true };
  }

  if (overlapLength >= chunk.length) {
    return { content: current, hasGap: false };
  }

  return { content: current + chunk.slice(overlapLength), hasGap: false };
}
