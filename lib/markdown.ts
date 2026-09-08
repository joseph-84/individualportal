import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "img", "span", "div"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height"],
    code: ["class"],
    span: ["style", "class"],
    div: ["style", "class"],
    "*": ["id"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb/],
      "text-align": [/^left$|^right$|^center$/],
      "font-weight": [/^bold$|^\d+$/],
    },
  },
};

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string;
  return sanitizeHtml(raw, SANITIZE_OPTS);
}

/** For notes stored as raw HTML: no markdown parsing, sanitize only. */
export function renderSanitizedHtml(source: string): string {
  return sanitizeHtml(source, SANITIZE_OPTS);
}

export function renderNote(content: string, format: string): string {
  return format === "html" ? renderSanitizedHtml(content) : renderMarkdown(content);
}
