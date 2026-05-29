import { useEffect, useState } from "react";

/**
 * 입력값을 지정한 지연 시간만큼 디바운스한다.
 * 블로그 검색창처럼 타이핑마다 즉시 반응하지 않고 잠시 멈췄을 때만
 * 결과를 갱신하고 싶을 때 사용한다.
 *
 * setState를 effect 본문에서 동기적으로 호출하지 않고 setTimeout 콜백 안에서
 * 호출하므로 React 19의 `react-hooks/set-state-in-effect` 규칙을 위반하지 않는다.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
