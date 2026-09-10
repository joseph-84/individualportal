import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

// Single-user portal: every note is authored and read by the same trusted account (and never
// shared externally — see README "파일 공유"), so we only strip what could actually execute
// (script, event-handler attributes, javascript: URLs) instead of a narrow tag/style allowlist.
// A tight allowlist here previously stripped most of the class/style-based formatting that AI-
// generated HTML notes rely on, so the 뷰어 (sanitized) looked far plainer than the 에디터
// live preview (rendered unsanitized) — this keeps the two visually consistent.
// Inline SVG diagrams show up often in AI-generated study-guide notes.
const SVG_TAGS = [
  "svg", "title", "desc", "defs", "marker", "path", "filter", "feDropShadow", "feGaussianBlur",
  "feOffset", "feMerge", "feMergeNode", "feColorMatrix", "feComponentTransfer", "feFuncA",
  "feFuncR", "feFuncG", "feFuncB", "rect", "text", "tspan", "line", "g", "polygon", "polyline",
  "circle", "ellipse", "use", "symbol", "clipPath", "linearGradient", "radialGradient", "stop",
  "pattern", "mask", "image",
];
const SVG_ATTRS = [
  "d", "viewBox", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "fill", "stroke",
  "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "transform", "points",
  "markerWidth", "markerHeight", "markerUnits", "orient", "refX", "refY", "gradientUnits",
  "gradientTransform", "offset", "stop-color", "stop-opacity", "stdDeviation", "in", "in2",
  "result", "dx", "dy", "patternUnits", "patternContentUnits", "preserveAspectRatio", "xmlns",
  "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-family", "text-anchor",
  "dominant-baseline", "clip-path", "mask", "filter",
];

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "h1",
    "h2",
    "img",
    "span",
    "div",
    "style",
    "font",
    "center",
    "figure",
    "figcaption",
    "details",
    "summary",
    "mark",
    "input", // Tiptap task-list checkboxes (todo descriptions)
    "label",
    ...SVG_TAGS,
  ]),
  // Acknowledges sanitize-html's warning about allowing <style> (CSS-only risk, no script
  // execution) — acceptable here since only the note's own trusted author ever views it.
  allowVulnerableTags: true,
  disallowedTagsMode: "discard",
  allowedAttributes: {
    "*": ["style", "class", "id", "title", "align", "valign", "colspan", "rowspan", "width", "height", "data-*", ...SVG_ATTRS],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    input: ["type", "checked", "disabled"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  // Deliberately omit `allowedStyles`: sanitize-html only supports a "*" wildcard for the TAG
  // key, not the CSS property-name key within a tag's style map — `{"*":{"*":[/.*/]}}` (our
  // previous attempt at "allow any property") silently matches nothing and strips every inline
  // `style="..."` attribute. Omitting the option entirely disables property-level filtering and
  // keeps the whole style attribute, which is what we actually want here.
  //
  // The underlying parser also lowercases attribute names by default (fine for regular HTML,
  // but it silently strips camelCase SVG attributes like viewBox/markerWidth/preserveAspectRatio
  // since the lowercased name no longer matches the allowlist above) — preserve original case
  // so SVG diagrams keep their viewBox and scale/clip correctly instead of overflowing.
  parser: { lowerCaseAttributeNames: false },
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Wraps rendered note/document HTML in a full standalone page with its own embedded
 * typography — used for the public share viewer, which loads content into a sandboxed
 * <iframe> that has no access to the app's own stylesheet. A note authored as raw HTML
 * (e.g. an AI-generated study guide) usually carries its own more specific <style> block
 * that overrides these baseline rules; markdown-rendered notes have none of their own, so
 * they get this document's typography as-is instead of unstyled browser defaults. */
export function renderShareDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin:0; padding:32px 40px; background:#fff; color:#1b1a18; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif; font-size:16px; line-height:1.85; }
  h1 { font-size:28px; font-weight:600; margin:0 0 18px; }
  h2 { font-size:21px; font-weight:600; margin:30px 0 12px; }
  h3 { font-size:17px; font-weight:600; margin:22px 0 8px; }
  p { margin:0 0 16px; }
  ul, ol { margin:0 0 16px; padding-left:22px; }
  li { margin-bottom:6px; }
  code { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size:.9em; background:#f0eeea; padding:1px 5px; border-radius:4px; }
  pre { background:#f0eeea; padding:14px 16px; border-radius:8px; overflow-x:auto; }
  pre code { background:none; padding:0; }
  blockquote { margin:0 0 16px; padding:10px 14px; border-left:3px solid #b0512e; background:#fbeade; border-radius:0 8px 8px 0; }
  table { border-collapse:collapse; margin:0 0 16px; max-width:100%; }
  th, td { border:1px solid #e4e0da; padding:7px 11px; }
  img, svg { max-width:100%; height:auto; }
  a { color:#b0512e; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`;
}
