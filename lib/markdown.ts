import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt"],
      code: ["class"],
    },
  });
}
