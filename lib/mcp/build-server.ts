import "server-only";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { listDir, readFileBuffer, writeFile as writeFsFile, deleteEntry, renameOrMoveEntry, ensureDir, UnsafePathError } from "@/lib/files";
import { listScriptFiles, readScriptFile, writeScriptFile } from "@/lib/scripts-fs";
import { executeScript, ScriptRunError } from "@/lib/run-script";
import { generateShareToken } from "@/lib/share";
import { writeAudit } from "@/lib/audit";

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Builds a fresh McpServer bound to `user` — single-user portal, so any valid API
 * token grants full access to every tool (same as the web UI once logged in). */
export function buildMcpServer(user: CurrentUser): McpServer {
  const server = new McpServer({ name: "individual-portal", version: "1.0.0" });

  // ---------- todos ----------
  server.registerTool(
    "list_todos",
    {
      title: "할일 목록",
      description: "할일 목록을 조회합니다.",
      inputSchema: { status: z.enum(["todo", "in_progress", "done"]).optional(), parentId: z.string().nullable().optional() },
    },
    async ({ status, parentId }) => {
      const where: Record<string, unknown> = {};
      if (status !== undefined) where.status = status;
      if (parentId !== undefined) where.parentId = parentId;
      const todos = await prisma.todo.findMany({ where, orderBy: { order: "asc" } });
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
        description: z.string().optional().describe("일반 텍스트 또는 HTML(굵게/목록/체크박스 등, 웹 UI의 리치 텍스트 에디터와 동일한 형식)"),
        project: z.string().optional(),
        tag: z.enum(["업무", "반복", "개인", "마감"]).optional(),
        repeat: z.string().optional(),
        dueAt: z.string().optional().describe("ISO date, e.g. 2026-09-10"),
        status: z.enum(["todo", "in_progress", "done"]).optional().describe("칸반 상태. 기본값 todo."),
        parentId: z.string().optional(),
      },
    },
    async (args) => {
      const parentId = args.parentId || null;
      const last = await prisma.todo.findFirst({ where: { parentId }, orderBy: { order: "desc" } });
      const todo = await prisma.todo.create({
        data: {
          title: args.title,
          description: args.description || null,
          project: args.project || null,
          tag: args.tag || "업무",
          repeat: args.repeat || null,
          dueAt: args.dueAt ? new Date(args.dueAt) : null,
          status: args.status || "todo",
          order: (last?.order ?? 0) + 1000,
          parentId,
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
        description: z.string().optional().describe("일반 텍스트 또는 HTML(굵게/목록/체크박스 등, 웹 UI의 리치 텍스트 에디터와 동일한 형식)"),
        project: z.string().optional(),
        tag: z.enum(["업무", "반복", "개인", "마감"]).optional(),
        repeat: z.string().optional(),
        dueAt: z.string().nullable().optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
      },
    },
    async ({ id, dueAt, ...rest }) => {
      const todo = await prisma.todo.update({
        where: { id },
        data: { ...rest, ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}) },
      });
      return ok(todo);
    }
  );

  server.registerTool(
    "reorder_todo",
    {
      title: "할일 순서 변경",
      description: "할일의 표시 순서를 변경합니다. 같은 부모(parentId)를 가진 할일 목록 내에서, 지정한 두 할일 사이로 이동시킵니다. 목록 맨 앞/뒤로 옮기려면 beforeId 또는 afterId 중 하나를 생략하세요.",
      inputSchema: {
        id: z.string(),
        beforeId: z.string().nullable().optional().describe("이 할일 바로 다음(뒤)으로 이동. 목록 맨 앞이면 생략."),
        afterId: z.string().nullable().optional().describe("이 할일 바로 앞으로 이동. 목록 맨 뒤면 생략."),
      },
    },
    async ({ id, beforeId, afterId }) => {
      const [before, after] = await Promise.all([
        beforeId ? prisma.todo.findUnique({ where: { id: beforeId } }) : null,
        afterId ? prisma.todo.findUnique({ where: { id: afterId } }) : null,
      ]);
      const beforeOrder = before?.order ?? null;
      const afterOrder = after?.order ?? null;
      let newOrder: number;
      if (beforeOrder !== null && afterOrder !== null) newOrder = (beforeOrder + afterOrder) / 2;
      else if (beforeOrder !== null) newOrder = beforeOrder + 1000;
      else if (afterOrder !== null) newOrder = afterOrder - 1000;
      else newOrder = 1000;
      const todo = await prisma.todo.update({ where: { id }, data: { order: newOrder } });
      return ok(todo);
    }
  );

  server.registerTool("delete_todo", { title: "할일 삭제", description: "할일을 삭제합니다 (하위 할일도 함께 삭제).", inputSchema: { id: z.string() } }, async ({ id }) => {
    await prisma.todo.delete({ where: { id } });
    return ok({ deleted: id });
  });

  // ---------- wiki ----------
  server.registerTool("list_notes", { title: "위키 문서 목록", description: "위키 문서 목록을 조회합니다.", inputSchema: { folder: z.string().optional() } }, async ({ folder }) => {
    const notes = await prisma.note.findMany({ where: folder !== undefined ? { folder } : undefined, orderBy: [{ folder: "asc" }, { title: "asc" }] });
    return ok(notes.map((n) => ({ id: n.id, title: n.title, folder: n.folder, format: n.format, tags: n.tags, updatedAt: n.updatedAt })));
  });

  server.registerTool("get_note", { title: "위키 문서 조회", description: "위키 문서 전체 내용을 조회합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
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
      const format = args.format || "md";
      const content = args.content ?? (format === "html" ? `<h1>${args.title}</h1>\n<p></p>\n` : `# ${args.title}\n\n`);
      const note = await prisma.note.create({ data: { title: args.title, folder: args.folder || "", tags: args.tags || [], format, content, ownerId: user.id } });
      return ok(note);
    }
  );

  server.registerTool("update_note", { title: "위키 문서 수정", description: "위키 문서 내용을 수정합니다.", inputSchema: { id: z.string(), content: z.string() } }, async ({ id, content }) => {
    const note = await prisma.note.update({ where: { id }, data: { content } });
    return ok(note);
  });

  server.registerTool("delete_note", { title: "위키 문서 삭제", description: "위키 문서를 삭제합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    await prisma.note.delete({ where: { id } });
    return ok({ deleted: id });
  });

  // ---------- files ----------
  server.registerTool("list_files", { title: "파일 목록", description: "SYNC_FOLDER_PATH 내 폴더 내용을 나열합니다.", inputSchema: { dir: z.string().optional() } }, async ({ dir }) => {
    try {
      return ok(await listDir(dir || ""));
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "폴더를 읽을 수 없습니다.");
    }
  });

  server.registerTool("read_file", { title: "파일 읽기", description: "텍스트 파일 내용을 읽습니다 (최대 200KB). 바이너리 파일은 지원하지 않습니다.", inputSchema: { path: z.string() } }, async ({ path: relPath }) => {
    try {
      const buf = await readFileBuffer(relPath);
      return ok(buf.toString("utf-8").slice(0, 200_000));
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "파일을 읽을 수 없습니다.");
    }
  });

  server.registerTool("write_file", { title: "파일 쓰기", description: "텍스트 파일을 생성하거나 덮어씁니다.", inputSchema: { path: z.string(), content: z.string() } }, async ({ path: relPath, content }) => {
    try {
      await writeFsFile(relPath, Buffer.from(content, "utf-8"));
      await writeAudit(user, "file.write", relPath, { via: "mcp" });
      return ok({ written: relPath });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "파일을 쓸 수 없습니다.");
    }
  });

  server.registerTool("delete_file", { title: "파일/폴더 삭제", description: "파일 또는 폴더를 삭제합니다.", inputSchema: { path: z.string() } }, async ({ path: relPath }) => {
    try {
      await deleteEntry(relPath);
      await writeAudit(user, "file.delete", relPath, { via: "mcp" });
      return ok({ deleted: relPath });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "삭제할 수 없습니다.");
    }
  });

  server.registerTool("rename_file", { title: "파일 이름변경/이동", description: "파일 또는 폴더 이름을 바꾸거나 이동합니다.", inputSchema: { from: z.string(), to: z.string() } }, async ({ from, to }) => {
    try {
      await renameOrMoveEntry(from, to);
      await writeAudit(user, "file.rename", from, { to, via: "mcp" });
      return ok({ from, to });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "이동할 수 없습니다.");
    }
  });

  server.registerTool("mkdir", { title: "폴더 생성", description: "새 폴더를 만듭니다.", inputSchema: { dir: z.string() } }, async ({ dir }) => {
    try {
      await ensureDir(dir);
      return ok({ created: dir });
    } catch (e) {
      return err(e instanceof UnsafePathError ? e.message : "폴더를 만들 수 없습니다.");
    }
  });

  server.registerTool(
    "create_share_link",
    { title: "파일 공유 링크 생성", description: "파일을 공유하는 링크를 만듭니다. scope=public은 링크를 아는 누구나, scope=email_otp는 지정한 이메일로 매 방문마다 OTP를 보내 본인만 열람.", inputSchema: { path: z.string(), scope: z.enum(["email_otp", "public"]), email: z.string().optional() } },
    async ({ path: relPath, scope, email }) => {
      if (scope === "email_otp" && !email) return err("email_otp 방식은 email이 필요합니다.");
      const token = generateShareToken();
      await prisma.shareLink.create({ data: { token, relPath, scope, email: scope === "email_otp" ? email : null, createdById: user.id } });
      await writeAudit(user, "file.share", relPath, { scope, via: "mcp" });
      return ok({ token, url: `/share/${token}` });
    }
  );

  server.registerTool("list_share_links", { title: "공유 링크 목록", description: "특정 파일의 활성 공유 링크를 조회합니다.", inputSchema: { path: z.string() } }, async ({ path: relPath }) => {
    const links = await prisma.shareLink.findMany({ where: { relPath, revoked: false } });
    return ok(links.map((l) => ({ id: l.id, token: l.token, scope: l.scope, email: l.email, createdAt: l.createdAt })));
  });

  server.registerTool("revoke_share_link", { title: "공유 링크 취소", description: "공유 링크를 취소합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    await prisma.shareLink.update({ where: { id }, data: { revoked: true } });
    return ok({ revoked: id });
  });

  // ---------- automation ----------
  server.registerTool("list_scripts", { title: "자동화 스크립트 목록", description: "등록된 화이트리스트 스크립트를 조회합니다.", inputSchema: {} }, async () => {
    const scripts = await prisma.scriptDef.findMany({ include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } } });
    return ok(scripts);
  });

  server.registerTool("run_script", { title: "스크립트 실행", description: "화이트리스트 스크립트를 실행합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    try {
      const result = await executeScript(id, "manual", user.id);
      return ok(result);
    } catch (e) {
      return err(e instanceof ScriptRunError ? e.message : "스크립트를 실행할 수 없습니다.");
    }
  });

  server.registerTool("get_run_logs", { title: "실행 로그 조회", description: "최근 스크립트 실행 로그를 조회합니다.", inputSchema: { scriptId: z.string().optional(), limit: z.number().max(50).optional() } }, async ({ scriptId, limit }) => {
    const runs = await prisma.scriptRun.findMany({
      where: scriptId ? { scriptId } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit || 20,
      include: { script: true },
    });
    return ok(runs);
  });

  server.registerTool("read_script_file", { title: "스크립트 코드 읽기", description: "스크립트 파일 소스를 읽습니다.", inputSchema: { file: z.string() } }, async ({ file }) => {
    try {
      return ok(await readScriptFile(file));
    } catch {
      return err("파일을 읽을 수 없습니다.");
    }
  });

  server.registerTool("write_script_file", { title: "스크립트 코드 쓰기", description: "스크립트 파일 소스를 저장합니다.", inputSchema: { file: z.string(), content: z.string() } }, async ({ file, content }) => {
    if (file.includes("/") || file.includes("..")) return err("잘못된 파일명입니다.");
    await writeScriptFile(file, content);
    await writeAudit(user, "script.save", file, { via: "mcp" });
    return ok({ written: file });
  });

  server.registerTool("list_script_files", { title: "스크립트 파일 목록", description: "SCRIPTS_PATH의 파일 목록을 조회합니다.", inputSchema: {} }, async () => {
    return ok(await listScriptFiles());
  });

  // ---------- favorites ----------
  server.registerTool("list_favorites", { title: "즐겨찾기 목록", description: "즐겨찾기(문서·URL) 목록을 조회합니다.", inputSchema: { folder: z.string().optional() } }, async ({ folder }) => {
    const favorites = await prisma.favorite.findMany({ where: folder !== undefined ? { folder } : undefined, orderBy: [{ folder: "asc" }, { title: "asc" }] });
    return ok(favorites);
  });

  server.registerTool(
    "create_favorite",
    { title: "즐겨찾기 추가", description: "새 즐겨찾기를 추가합니다.", inputSchema: { title: z.string(), url: z.string(), folder: z.string().optional() } },
    async (args) => {
      const favorite = await prisma.favorite.create({ data: { title: args.title, url: args.url, folder: args.folder || "", ownerId: user.id } });
      return ok(favorite);
    }
  );

  server.registerTool(
    "update_favorite",
    { title: "즐겨찾기 수정", description: "즐겨찾기의 제목·URL·폴더를 수정합니다.", inputSchema: { id: z.string(), title: z.string().optional(), url: z.string().optional(), folder: z.string().optional() } },
    async ({ id, ...rest }) => {
      const favorite = await prisma.favorite.update({ where: { id }, data: rest });
      return ok(favorite);
    }
  );

  server.registerTool("delete_favorite", { title: "즐겨찾기 삭제", description: "즐겨찾기를 삭제합니다.", inputSchema: { id: z.string() } }, async ({ id }) => {
    await prisma.favorite.delete({ where: { id } });
    return ok({ deleted: id });
  });

  // ---------- audit log ----------
  server.registerTool("list_audit_log", { title: "감사 로그 조회", description: "계정·스크립트·파일 변경 이력을 조회합니다.", inputSchema: { limit: z.number().max(200).optional() } }, async ({ limit }) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit || 50 });
    return ok(logs);
  });

  return server;
}
