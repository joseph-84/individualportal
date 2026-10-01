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
import { nextCompletedAt, cascadeParentCompletion } from "@/lib/todo-status";

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Shared preview-then-confirm gate for the destination-ambiguous "create" tools and the
 * irreversible delete/run tools (same set the web UI already gates behind a JS confirm()
 * dialog, plus run_script -- a wrong natural-language guess at *which* script to run is a
 * bigger risk than a misclick on an already-visible button). An MCP client calling without
 * confirm:true (the default/safe path) gets a text description of what *would* happen and
 * nothing is changed; only confirm:true performs the actual mutation. This is enforced here
 * server-side rather than relying on MCP "elicitation" (inconsistently supported across
 * clients, unconfirmed on mobile) -- the calling model is instructed via each tool's
 * description to present the preview to the user in chat and wait for explicit agreement
 * before re-calling with confirm:true, but even a model that ignores that instruction can't
 * skip the gate itself. */
const CONFIRM_FIELD = {
  confirm: z
    .boolean()
    .optional()
    .describe(
      "실제로 실행하려면 true로 설정하세요. 생략하거나 false면 아무것도 바꾸지 않고 무엇을 할 것인지 설명만 반환합니다 -- 반드시 먼저 사용자에게 계획을 말로 설명하고 명시적 동의를 받은 뒤에만 true로 다시 호출하세요."
    ),
};
const CONFIRM_NOTE =
  " confirm 없이(또는 false로) 먼저 호출해 계획을 확인하고, 그 내용을 사용자에게 보여준 뒤 동의를 받으면 confirm:true로 다시 호출하세요.";

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
      description:
        "새 할일을 생성합니다. parentId를 주면 하위 할일이 됩니다. 자연어 요청은 할일/체크리스트/위키 중 어디에 넣을지 애매한 경우가 많으므로," +
        CONFIRM_NOTE,
      inputSchema: {
        title: z.string(),
        description: z.string().optional().describe("일반 텍스트 또는 HTML(굵게/목록/체크박스 등, 웹 UI의 리치 텍스트 에디터와 동일한 형식)"),
        project: z.string().optional(),
        tag: z.enum(["업무", "반복", "개인", "마감"]).optional(),
        repeat: z.string().optional(),
        dueAt: z.string().optional().describe("ISO date, e.g. 2026-09-10"),
        status: z.enum(["todo", "in_progress", "done"]).optional().describe("칸반 상태. 기본값 todo."),
        parentId: z.string().optional(),
        ...CONFIRM_FIELD,
      },
    },
    async (args) => {
      const parentId = args.parentId || null;
      if (args.confirm !== true) {
        return ok({
          preview: true,
          message: `아직 생성되지 않았습니다. 다음 내용으로 ${parentId ? "하위 할일을" : "할일을"} 생성하려 합니다: "${args.title}"${args.project ? ` (프로젝트: ${args.project})` : ""}${args.tag ? ` (태그: ${args.tag})` : ""}${args.dueAt ? ` (마감일: ${args.dueAt})` : ""}. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.`,
        });
      }
      const last = await prisma.todo.findFirst({ where: { parentId }, orderBy: { order: "desc" } });
      const status = args.status || "todo";
      const todo = await prisma.todo.create({
        data: {
          title: args.title,
          description: args.description || null,
          project: args.project || null,
          tag: args.tag || "업무",
          repeat: args.repeat || null,
          dueAt: args.dueAt ? new Date(args.dueAt) : null,
          status,
          completedAt: status === "done" ? new Date() : null,
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
    async ({ id, dueAt, status, ...rest }) => {
      const existing = await prisma.todo.findUniqueOrThrow({ where: { id } });
      const todo = await prisma.todo.update({
        where: { id },
        data: {
          ...rest,
          ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
          ...(status !== undefined ? { status, completedAt: nextCompletedAt(status, existing.status, existing.completedAt) } : {}),
        },
      });
      await cascadeParentCompletion(id);
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

  server.registerTool(
    "delete_todo",
    { title: "할일 삭제", description: "할일을 삭제합니다 (하위 할일도 함께 삭제, 되돌릴 수 없음)." + CONFIRM_NOTE, inputSchema: { id: z.string(), ...CONFIRM_FIELD } },
    async ({ id, confirm }) => {
      const todo = await prisma.todo.findUnique({ where: { id }, include: { children: true } });
      if (!todo) return err("할일을 찾을 수 없습니다.");
      if (confirm !== true) {
        return ok({
          preview: true,
          message: `"${todo.title}"을(를) 삭제하려 합니다.${todo.children.length ? ` 하위 할일 ${todo.children.length}개도 함께 삭제됩니다.` : ""} 되돌릴 수 없습니다. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.`,
        });
      }
      await prisma.todo.delete({ where: { id } });
      return ok({ deleted: id });
    }
  );

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
      description: "새 위키 문서를 만듭니다. format은 md 또는 html. 자연어 요청은 할일/체크리스트/위키 중 어디에 넣을지 애매한 경우가 많으므로," + CONFIRM_NOTE,
      inputSchema: {
        title: z.string(),
        folder: z.string().optional(),
        tags: z.array(z.string()).optional(),
        format: z.enum(["md", "html"]).optional(),
        content: z.string().optional(),
        ...CONFIRM_FIELD,
      },
    },
    async (args) => {
      if (args.confirm !== true) {
        return ok({
          preview: true,
          message: `아직 생성되지 않았습니다. 다음 내용으로 위키 문서를 생성하려 합니다: "${args.title}"${args.folder ? ` (폴더: ${args.folder})` : ""} (format: ${args.format || "md"}). 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.`,
        });
      }
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

  server.registerTool(
    "delete_note",
    { title: "위키 문서 삭제", description: "위키 문서를 삭제합니다 (되돌릴 수 없음)." + CONFIRM_NOTE, inputSchema: { id: z.string(), ...CONFIRM_FIELD } },
    async ({ id, confirm }) => {
      const note = await prisma.note.findUnique({ where: { id } });
      if (!note) return err("문서를 찾을 수 없습니다.");
      if (confirm !== true) {
        return ok({ preview: true, message: `"${note.title}" 문서를 삭제하려 합니다. 되돌릴 수 없습니다. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.` });
      }
      await prisma.note.delete({ where: { id } });
      return ok({ deleted: id });
    }
  );

  // ---------- checklists ----------
  server.registerTool("list_checklists", { title: "체크리스트 목록", description: "체크리스트 문서 목록을 조회합니다.", inputSchema: { folder: z.string().optional() } }, async ({ folder }) => {
    const checklists = await prisma.checklist.findMany({ where: folder !== undefined ? { folder } : undefined, orderBy: [{ folder: "asc" }, { title: "asc" }] });
    return ok(checklists.map((c) => ({ id: c.id, title: c.title, folder: c.folder, updatedAt: c.updatedAt })));
  });

  server.registerTool("get_checklist", { title: "체크리스트 조회", description: "체크리스트 문서 전체 내용을 조회합니다 (content는 체크박스 목록을 담은 HTML).", inputSchema: { id: z.string() } }, async ({ id }) => {
    const checklist = await prisma.checklist.findUnique({ where: { id } });
    if (!checklist) return err("체크리스트를 찾을 수 없습니다.");
    return ok(checklist);
  });

  server.registerTool(
    "create_checklist",
    {
      title: "체크리스트 생성",
      description:
        "새 체크리스트 문서를 만듭니다. content는 생략하면 빈 문서로 시작합니다 (일반 텍스트 또는 HTML -- 체크박스 목록은 웹 UI의 위지위그 에디터와 동일한 형식). 자연어 요청은 할일/체크리스트/위키 중 어디에 넣을지 애매한 경우가 많으므로," +
        CONFIRM_NOTE,
      inputSchema: { title: z.string(), folder: z.string().optional(), content: z.string().optional(), ...CONFIRM_FIELD },
    },
    async (args) => {
      if (args.confirm !== true) {
        return ok({
          preview: true,
          message: `아직 생성되지 않았습니다. 다음 내용으로 체크리스트를 생성하려 합니다: "${args.title}"${args.folder ? ` (폴더: ${args.folder})` : ""}. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.`,
        });
      }
      const checklist = await prisma.checklist.create({ data: { title: args.title, folder: args.folder || "", content: args.content || "", ownerId: user.id } });
      return ok(checklist);
    }
  );

  server.registerTool("update_checklist", { title: "체크리스트 수정", description: "체크리스트 내용을 수정합니다(전체 content 교체).", inputSchema: { id: z.string(), content: z.string() } }, async ({ id, content }) => {
    const checklist = await prisma.checklist.update({ where: { id }, data: { content } });
    return ok(checklist);
  });

  server.registerTool(
    "delete_checklist",
    { title: "체크리스트 삭제", description: "체크리스트 문서를 삭제합니다 (되돌릴 수 없음)." + CONFIRM_NOTE, inputSchema: { id: z.string(), ...CONFIRM_FIELD } },
    async ({ id, confirm }) => {
      const checklist = await prisma.checklist.findUnique({ where: { id } });
      if (!checklist) return err("체크리스트를 찾을 수 없습니다.");
      if (confirm !== true) {
        return ok({ preview: true, message: `"${checklist.title}" 체크리스트를 삭제하려 합니다. 되돌릴 수 없습니다. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.` });
      }
      await prisma.checklist.delete({ where: { id } });
      return ok({ deleted: id });
    }
  );

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

  server.registerTool(
    "delete_file",
    { title: "파일/폴더 삭제", description: "파일 또는 폴더를 삭제합니다 (되돌릴 수 없음)." + CONFIRM_NOTE, inputSchema: { path: z.string(), ...CONFIRM_FIELD } },
    async ({ path: relPath, confirm }) => {
      if (confirm !== true) {
        return ok({ preview: true, message: `"${relPath}"을(를) 삭제하려 합니다. 폴더라면 내용물도 함께 삭제되고, 되돌릴 수 없습니다. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.` });
      }
      try {
        await deleteEntry(relPath);
        await writeAudit(user, "file.delete", relPath, { via: "mcp" });
        return ok({ deleted: relPath });
      } catch (e) {
        return err(e instanceof UnsafePathError ? e.message : "삭제할 수 없습니다.");
      }
    }
  );

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

  server.registerTool(
    "run_script",
    {
      title: "스크립트 실행",
      description: "화이트리스트 스크립트를 실행합니다. 자연어 요청만으로 어떤 스크립트를 돌릴지 잘못 판단하면 되돌리기 어려운 부작용이 있을 수 있으므로," + CONFIRM_NOTE,
      inputSchema: { id: z.string(), ...CONFIRM_FIELD },
    },
    async ({ id, confirm }) => {
      const script = await prisma.scriptDef.findUnique({ where: { id } });
      if (!script) return err("스크립트를 찾을 수 없습니다.");
      if (confirm !== true) {
        return ok({ preview: true, message: `스크립트 "${script.file}"(${script.description})를 실행하려 합니다. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.` });
      }
      try {
        const result = await executeScript(id, "manual", user.id);
        return ok(result);
      } catch (e) {
        return err(e instanceof ScriptRunError ? e.message : "스크립트를 실행할 수 없습니다.");
      }
    }
  );

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

  server.registerTool(
    "delete_favorite",
    { title: "즐겨찾기 삭제", description: "즐겨찾기를 삭제합니다 (되돌릴 수 없음)." + CONFIRM_NOTE, inputSchema: { id: z.string(), ...CONFIRM_FIELD } },
    async ({ id, confirm }) => {
      const favorite = await prisma.favorite.findUnique({ where: { id } });
      if (!favorite) return err("즐겨찾기를 찾을 수 없습니다.");
      if (confirm !== true) {
        return ok({ preview: true, message: `즐겨찾기 "${favorite.title}"을(를) 삭제하려 합니다. 사용자에게 먼저 알리고 확인받은 후 confirm:true로 다시 호출하세요.` });
      }
      await prisma.favorite.delete({ where: { id } });
      return ok({ deleted: id });
    }
  );

  // ---------- audit log ----------
  server.registerTool("list_audit_log", { title: "감사 로그 조회", description: "계정·스크립트·파일 변경 이력을 조회합니다.", inputSchema: { limit: z.number().max(200).optional() } }, async ({ limit }) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit || 50 });
    return ok(logs);
  });

  return server;
}
