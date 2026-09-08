import "server-only";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "@/lib/prisma";
import { permLevelOf, type CurrentUser } from "@/lib/session";
import type { PageKey } from "@/lib/types";
import { hashPassword } from "@/lib/auth";
import { listDir, readFileBuffer, writeFile as writeFsFile, deleteEntry, renameOrMoveEntry, ensureDir, UnsafePathError } from "@/lib/files";
import { listScriptFiles, readScriptFile, writeScriptFile } from "@/lib/scripts-fs";
import { executeScript, ScriptRunError } from "@/lib/run-script";
import { generateShareToken, type ShareScope } from "@/lib/share";
import { writeAudit } from "@/lib/audit";
import { PAGES } from "@/lib/constants";

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
function denied(page: string): CallToolResult {
  return err(`권한이 없습니다: ${page} 페이지에 대한 접근 권한이 없습니다.`);
}

/** Builds a fresh McpServer with every tool bound to `user`'s live permissions —
 * identical enforcement to the web UI (lib/guard.ts), just checked inline per tool
 * instead of via requirePerm(), since there's no cookie/redirect context here. */
export function buildMcpServer(user: CurrentUser): McpServer {
  const server = new McpServer({ name: "individual-portal", version: "1.0.0" });
  const level = (page: PageKey) => permLevelOf(user, page);

  // ---------- todos ----------
  server.registerTool(
    "list_todos",
    { title: "할일 목록", description: "할일 목록을 조회합니다.", inputSchema: { done: z.boolean().optional(), parentId: z.string().nullable().optional() } },
    async ({ done, parentId }) => {
      if (level("todos") < 1) return denied("todos");
      const where: Record<string, unknown> = {};
      if (done !== undefined) where.done = done;
      if (parentId !== undefined) where.parentId = parentId;
      const todos = await prisma.todo.findMany({ where, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
      return ok(todos);
    }
  );

  server.registerTool(
    "create_todo",
    {
      title: "할일 생성",
      description: "새 할일을 생성합니다. parentId를 주면 하위 할일이 됩니다.",
      inputSchema: {
        title: z.string(),
        description: z.string().optional(),
        project: z.string().optional(),
        tag: z.enum(["업무", "반복", "개인", "마감"]).optional(),
        repeat: z.string().optional(),
        dueAt: z.string().optional().describe("ISO date, e.g. 2026-09-10"),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe("1=high 2=medium 3=low"),
        parentId: z.string().optional(),
      },
    },
    async (args) => {
      if (level("todos") < 2) return denied("todos");
      const todo = await prisma.todo.create({
        data: {
          title: args.title,
          description: args.description || null,
          project: args.project || null,
          tag: args.tag || "업무",
          repeat: args.repeat || null,
          dueAt: args.dueAt ? new Date(args.dueAt) : null,
          priority: args.priority ?? 2,
          parentId: args.parentId || null,
          ownerId: user.id,
        },
      });
      return ok(todo);
    }
  );

  server.registerTool(
    "update_todo",
    {
      title: "할일 수정",
      description: "할일의 필드를 수정합니다.",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        project: z.string().optional(),
        tag: z.enum(["업무", "반복", "개인", "마감"]).optional(),
        repeat: z.string().optional(),
        dueAt: z.string().nullable().optional(),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        done: z.boolean().optional(),
      },
    },
    async ({ id, dueAt, ...rest }) => {
      if (level("todos") < 2) return denied("todos");
      const todo = await prisma.todo.update({
        where: { id },
        data: { ...rest, ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}) },
      });
      return ok(todo);
    }
  );

  server.registerTool("delete_todo", { title: "할일 삭제", description: "할일을 삭제합니다 (하위 할일도 함께 삭제).", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("todos") < 2) return denied("todos");
    await prisma.todo.delete({ where: { id } });
    return ok({ deleted: id });
  });

  // ---------- wiki ----------
  server.registerTool("list_notes", { title: "위키 문서 목록", description: "위키 문서 목록을 조회합니다.", inputSchema: { folder: z.string().optional() } }, async ({ folder }) => {
    if (level("wiki") < 1) return denied("wiki");
    const notes = await prisma.note.findMany({ where: folder !== undefined ? { folder } : undefined, orderBy: [{ folder: "asc" }, { title: "asc" }] });
    return ok(notes.map((n) => ({ id: n.id, title: n.title, folder: n.folder, format: n.format, tags: n.tags, updatedAt: n.updatedAt })));
  });

  server.registerTool("get_note", { title: "위키 문서 조회", description: "위키 문서 전체 내용을 조회합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("wiki") < 1) return denied("wiki");
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) return err("문서를 찾을 수 없습니다.");
    return ok(note);
  });

  server.registerTool(
    "create_note",
    {
      title: "위키 문서 생성",
      description: "새 위키 문서를 만듭니다. format은 md 또는 html.",
      inputSchema: { title: z.string(), folder: z.string().optional(), tags: z.array(z.string()).optional(), format: z.enum(["md", "html"]).optional(), content: z.string().optional() },
    },
    async (args) => {
      if (level("wiki") < 2) return denied("wiki");
      const format = args.format || "md";
      const content = args.content ?? (format === "html" ? `<h1>${args.title}</h1>\n<p></p>\n` : `# ${args.title}\n\n`);
      const note = await prisma.note.create({ data: { title: args.title, folder: args.folder || "", tags: args.tags || [], format, content, ownerId: user.id } });
      return ok(note);
    }
  );

  server.registerTool("update_note", { title: "위키 문서 수정", description: "위키 문서 내용을 수정합니다.", inputSchema: { id: z.string(), content: z.string() } }, async ({ id, content }) => {
    if (level("wiki") < 2) return denied("wiki");
    const note = await prisma.note.update({ where: { id }, data: { content } });
    return ok(note);
  });

  server.registerTool("delete_note", { title: "위키 문서 삭제", description: "위키 문서를 삭제합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("wiki") < 2) return denied("wiki");
    await prisma.note.delete({ where: { id } });
    return ok({ deleted: id });
  });

  // ---------- files ----------
  server.registerTool("list_files", { title: "파일 목록", description: "SYNC_FOLDER_PATH 내 폴더 내용을 나열합니다.", inputSchema: { dir: z.string().optional() } }, async ({ dir }) => {
    if (level("files") < 1) return denied("files");
    try {
      return ok(await listDir(dir || ""));
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "폴더를 읽을 수 없습니다.");
    }
  });

  server.registerTool("read_file", { title: "파일 읽기", description: "텍스트 파일 내용을 읽습니다 (최대 200KB). 바이너리 파일은 지원하지 않습니다.", inputSchema: { path: z.string() } }, async ({ path: relPath }) => {
    if (level("files") < 1) return denied("files");
    try {
      const buf = await readFileBuffer(relPath);
      return ok(buf.toString("utf-8").slice(0, 200_000));
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "파일을 읽을 수 없습니다.");
    }
  });

  server.registerTool("write_file", { title: "파일 쓰기", description: "텍스트 파일을 생성하거나 덮어씁니다.", inputSchema: { path: z.string(), content: z.string() } }, async ({ path: relPath, content }) => {
    if (level("files") < 2) return denied("files");
    try {
      await writeFsFile(relPath, Buffer.from(content, "utf-8"));
      await writeAudit(user, "file.write", relPath, { via: "mcp" });
      return ok({ written: relPath });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "파일을 쓸 수 없습니다.");
    }
  });

  server.registerTool("delete_file", { title: "파일/폴더 삭제", description: "파일 또는 폴더를 삭제합니다.", inputSchema: { path: z.string() } }, async ({ path: relPath }) => {
    if (level("files") < 2) return denied("files");
    try {
      await deleteEntry(relPath);
      await writeAudit(user, "file.delete", relPath, { via: "mcp" });
      return ok({ deleted: relPath });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "삭제할 수 없습니다.");
    }
  });

  server.registerTool("rename_file", { title: "파일 이름변경/이동", description: "파일 또는 폴더 이름을 바꾸거나 이동합니다.", inputSchema: { from: z.string(), to: z.string() } }, async ({ from, to }) => {
    if (level("files") < 2) return denied("files");
    try {
      await renameOrMoveEntry(from, to);
      await writeAudit(user, "file.rename", from, { to, via: "mcp" });
      return ok({ from, to });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "이동할 수 없습니다.");
    }
  });

  server.registerTool("mkdir", { title: "폴더 생성", description: "새 폴더를 만듭니다.", inputSchema: { dir: z.string() } }, async ({ dir }) => {
    if (level("files") < 2) return denied("files");
    try {
      await ensureDir(dir);
      return ok({ created: dir });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "폴더를 만들 수 없습니다.");
    }
  });

  server.registerTool(
    "create_share_link",
    { title: "파일 공유 링크 생성", description: "파일을 공유하는 링크를 만듭니다.", inputSchema: { path: z.string(), scope: z.enum(["members", "public"]) } },
    async ({ path: relPath, scope }) => {
      if (level("files") < 2) return denied("files");
      const token = generateShareToken();
      await prisma.shareLink.create({ data: { token, relPath, scope: scope as ShareScope, createdById: user.id } });
      await writeAudit(user, "file.share", relPath, { scope, via: "mcp" });
      return ok({ token, path: `/share/${token}` });
    }
  );

  server.registerTool("list_share_links", { title: "공유 링크 목록", description: "특정 파일의 활성 공유 링크를 조회합니다.", inputSchema: { path: z.string() } }, async ({ path: relPath }) => {
    if (level("files") < 1) return denied("files");
    const links = await prisma.shareLink.findMany({ where: { relPath, revoked: false } });
    return ok(links.map((l) => ({ id: l.id, token: l.token, scope: l.scope, createdAt: l.createdAt })));
  });

  server.registerTool("revoke_share_link", { title: "공유 링크 취소", description: "공유 링크를 취소합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("files") < 2) return denied("files");
    await prisma.shareLink.update({ where: { id }, data: { revoked: true } });
    return ok({ revoked: id });
  });

  // ---------- automation ----------
  server.registerTool("list_scripts", { title: "자동화 스크립트 목록", description: "등록된 화이트리스트 스크립트를 조회합니다.", inputSchema: {} }, async () => {
    if (level("automation") < 1) return denied("automation");
    const scripts = await prisma.scriptDef.findMany({ include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } } });
    return ok(scripts);
  });

  server.registerTool("run_script", { title: "스크립트 실행", description: "화이트리스트 스크립트를 실행합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("automation") < 2) return denied("automation");
    try {
      const result = await executeScript(id, "manual", user.id);
      return ok(result);
    } catch (e) {
      return err(e instanceof ScriptRunError ? e.message : "스크립트를 실행할 수 없습니다.");
    }
  });

  server.registerTool("get_run_logs", { title: "실행 로그 조회", description: "최근 스크립트 실행 로그를 조회합니다.", inputSchema: { scriptId: z.string().optional(), limit: z.number().max(50).optional() } }, async ({ scriptId, limit }) => {
    if (level("automation") < 1) return denied("automation");
    const runs = await prisma.scriptRun.findMany({
      where: scriptId ? { scriptId } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit || 20,
      include: { script: true },
    });
    return ok(runs);
  });

  server.registerTool("read_script_file", { title: "스크립트 코드 읽기", description: "스크립트 파일 소스를 읽습니다 (admin).", inputSchema: { file: z.string() } }, async ({ file }) => {
    if (level("editor") < 1) return denied("editor");
    try {
      return ok(await readScriptFile(file));
    } catch {
      return err("파일을 읽을 수 없습니다.");
    }
  });

  server.registerTool("write_script_file", { title: "스크립트 코드 쓰기", description: "스크립트 파일 소스를 저장합니다 (admin).", inputSchema: { file: z.string(), content: z.string() } }, async ({ file, content }) => {
    if (level("editor") < 2) return denied("editor");
    if (file.includes("/") || file.includes("..")) return err("잘못된 파일명입니다.");
    await writeScriptFile(file, content);
    await writeAudit(user, "script.save", file, { via: "mcp" });
    return ok({ written: file });
  });

  server.registerTool("list_script_files", { title: "스크립트 파일 목록", description: "SCRIPTS_PATH의 파일 목록을 조회합니다 (admin).", inputSchema: {} }, async () => {
    if (level("editor") < 1) return denied("editor");
    return ok(await listScriptFiles());
  });

  // ---------- users & roles ----------
  server.registerTool("list_users", { title: "사용자 목록", description: "포털 사용자 목록을 조회합니다.", inputSchema: {} }, async () => {
    if (level("users") < 1) return denied("users");
    const users = await prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: "asc" } });
    return ok(users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role.key, active: u.active, lastLoginAt: u.lastLoginAt })));
  });

  server.registerTool(
    "create_user",
    { title: "사용자 추가", description: "새 사용자 계정을 만듭니다.", inputSchema: { email: z.string(), name: z.string(), role: z.string(), password: z.string().min(8) } },
    async ({ email, name, role: roleKey, password }) => {
      if (level("users") < 2) return denied("users");
      const role = await prisma.role.findUnique({ where: { key: roleKey } });
      if (!role) return err("존재하지 않는 역할입니다.");
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return err("이미 등록된 이메일입니다.");
      const created = await prisma.user.create({ data: { email, name, roleId: role.id, passwordHash: await hashPassword(password) } });
      await writeAudit(user, "user.create", email, { via: "mcp" });
      return ok({ id: created.id, email: created.email });
    }
  );

  server.registerTool(
    "update_user",
    { title: "사용자 정보 수정", description: "사용자 이름/이메일/역할을 수정합니다.", inputSchema: { id: z.string(), email: z.string().optional(), name: z.string().optional(), role: z.string().optional() } },
    async ({ id, email, name, role: roleKey }) => {
      if (level("users") < 2) return denied("users");
      const data: Record<string, unknown> = {};
      if (email) data.email = email;
      if (name) data.name = name;
      if (roleKey) {
        const role = await prisma.role.findUnique({ where: { key: roleKey } });
        if (!role) return err("존재하지 않는 역할입니다.");
        data.roleId = role.id;
      }
      const updated = await prisma.user.update({ where: { id }, data });
      await writeAudit(user, "user.update", updated.email, { via: "mcp" });
      return ok(updated);
    }
  );

  server.registerTool("toggle_user_active", { title: "사용자 활성/비활성 전환", description: "사용자 계정을 활성화/비활성화합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("users") < 2) return denied("users");
    if (id === user.id) return err("본인 계정은 비활성화할 수 없습니다.");
    const target = await prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
    const nextActive = !target.active;
    if (!nextActive && target.role.key === "admin") {
      const activeAdmins = await prisma.user.count({ where: { active: true, role: { key: "admin" } } });
      if (activeAdmins <= 1) return err("마지막 남은 활성 관리자는 비활성화할 수 없습니다.");
    }
    await prisma.user.update({ where: { id }, data: { active: nextActive } });
    await writeAudit(user, "user.toggle", target.email, { active: nextActive, via: "mcp" });
    return ok({ id, active: nextActive });
  });

  server.registerTool("reset_user_password", { title: "비밀번호 초기화", description: "사용자 비밀번호를 임의의 임시 비밀번호로 초기화합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    if (level("users") < 2) return denied("users");
    const temp = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase();
    const target = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(temp), tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } });
    await writeAudit(user, "user.reset_password", target.email, { via: "mcp" });
    return ok({ id, tempPassword: temp });
  });

  server.registerTool("list_roles", { title: "역할 목록", description: "역할과 페이지 권한 매트릭스를 조회합니다.", inputSchema: {} }, async () => {
    if (level("roles") < 1) return denied("roles");
    const roles = await prisma.role.findMany({ include: { permissions: true, _count: { select: { users: true } } } });
    return ok(roles);
  });

  server.registerTool(
    "set_permission",
    { title: "권한 설정", description: "역할×페이지 권한을 설정합니다 (0=없음, 1=읽기, 2=읽기·쓰기). 페이지: " + PAGES.map((p) => p.key).join(", "), inputSchema: { roleId: z.string(), page: z.string(), level: z.union([z.literal(0), z.literal(1), z.literal(2)]) } },
    async ({ roleId, page, level: newLevel }) => {
      if (level("roles") < 2) return denied("roles");
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (role?.isSystem) return err("시스템 역할(admin)의 권한은 변경할 수 없습니다.");
      await prisma.pagePermission.upsert({
        where: { roleId_page: { roleId, page } },
        update: { level: newLevel },
        create: { roleId, page, level: newLevel },
      });
      await writeAudit(user, "permission.save", `${roleId}/${page}`, { level: newLevel, via: "mcp" });
      return ok({ roleId, page, level: newLevel });
    }
  );

  server.registerTool(
    "create_role",
    { title: "역할 생성", description: "새 역할을 생성합니다 (모든 페이지 권한 없음으로 시작).", inputSchema: { key: z.string(), name: z.string(), description: z.string().optional() } },
    async ({ key, name, description }) => {
      if (level("roles") < 2) return denied("roles");
      const existing = await prisma.role.findUnique({ where: { key } });
      if (existing) return err("이미 존재하는 역할 키입니다.");
      const role = await prisma.role.create({ data: { key, name, description } });
      await prisma.pagePermission.createMany({ data: PAGES.map((p) => ({ roleId: role.id, page: p.key, level: 0 })) });
      await writeAudit(user, "role.create", key, { via: "mcp" });
      return ok(role);
    }
  );

  // ---------- audit log ----------
  server.registerTool("list_audit_log", { title: "감사 로그 조회", description: "권한/계정/스크립트/파일 변경 이력을 조회합니다.", inputSchema: { limit: z.number().max(200).optional() } }, async ({ limit }) => {
    if (level("auditlog") < 1) return denied("auditlog");
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit || 50 });
    return ok(logs);
  });

  return server;
}
