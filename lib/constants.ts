import type { PageDef } from "./types";

export const PAGES: PageDef[] = [
  { key: "dashboard", label: "대시보드", icon: "dash" },
  { key: "todos", label: "할일 · 일정", icon: "todo" },
  { key: "wiki", label: "지식베이스", icon: "wiki" },
  { key: "files", label: "파일 브라우저", icon: "file" },
  { key: "automation", label: "자동화 스크립트", icon: "auto" },
  { key: "editor", label: "코드 에디터", icon: "code" },
  { key: "auditlog", label: "감사 로그", icon: "log" },
];

export const TITLES: Record<string, [string, string]> = {
  dashboard: ["대시보드", "오늘의 업무 현황"],
  todos: ["할일 · 일정", "리스트 / 캘린더"],
  wiki: ["지식베이스", "위키 스타일 문서"],
  files: ["파일 브라우저", "동기화된 서버 폴더"],
  automation: ["자동화 스크립트", "화이트리스트 등록 스크립트만 실행"],
  editor: ["코드 에디터", "스크립트 코드 편집"],
  auditlog: ["감사 로그", "계정·스크립트·파일 변경 이력"],
};

export const ICONS: Record<string, string> = {
  dash: "M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z",
  todo: "M4 3.5h12a1 1 0 011 1V16a1 1 0 01-1 1H4a1 1 0 01-1-1V4.5a1 1 0 011-1zM3 7.5h14M6.5 11l1.6 1.6L11.5 9",
  wiki: "M3.5 4h5a2 2 0 012 2v10a2 2 0 00-2-1.6h-5zM16.5 4h-5a2 2 0 00-2 2v10a2 2 0 012-1.6h5z",
  file: "M2.5 5.5A1.5 1.5 0 014 4h3l1.6 2H16a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5z",
  auto: "M11 2.5L4.5 11.5H9L8.5 17.5L15.5 8.5H10.6z",
  code: "M7 5.5L3 10l4 4.5M13 5.5L17 10l-4 4.5M11.5 3.5l-3 13",
  log: "M4 3h9l3 3v11a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zM12.5 3v3.5H16M6.5 10.5h7M6.5 13.5h7M6.5 7.5h3",
};
