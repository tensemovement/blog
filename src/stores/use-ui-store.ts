import { create } from "zustand";

type Theme = "light" | "dark";

interface UIState {
  theme: Theme;
  isMobileNavOpen: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

/**
 * UI 전역 상태. 블로그에서는 주로 테마 토글, 모바일 내비게이션 등
 * 클라이언트 측 UI 상태를 다룬다. 게시글 데이터는 서버 컴포넌트에서 직접
 * 가져오므로 전역 스토어에 넣지 않는다.
 */
export const useUIStore = create<UIState>((set) => ({
  theme: "light",
  isMobileNavOpen: false,
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
  setTheme: (theme) => set({ theme }),
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  toggleMobileNav: () =>
    set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
}));
