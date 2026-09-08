export type Theme = "light" | "dark";

export type PageKey = "dashboard" | "todos" | "wiki" | "files" | "favorites" | "automation" | "editor" | "auditlog" | "settings";

export interface PageDef {
  key: PageKey;
  label: string;
  icon: string;
  badge?: string;
}
