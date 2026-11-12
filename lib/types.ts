export type Theme = "light" | "dark";

export type PageKey = "dashboard" | "todos" | "files" | "favorites" | "notes" | "automation" | "editor" | "auditlog" | "settings";

export interface PageDef {
  key: PageKey;
  label: string;
  icon: string;
  badge?: string;
}
