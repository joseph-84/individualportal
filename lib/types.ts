export type Theme = "light" | "dark";

export type PageKey =
  | "dashboard"
  | "todos"
  | "wiki"
  | "files"
  | "automation"
  | "editor"
  | "users"
  | "roles"
  | "auditlog";

export interface PageDef {
  key: PageKey;
  label: string;
  icon: string;
  admin?: boolean;
  badge?: string;
}
