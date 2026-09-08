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
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedStyles: {
    "*": {
      "*": [/.*/],
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
