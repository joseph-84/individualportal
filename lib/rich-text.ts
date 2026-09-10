/** Returns true if Tiptap-produced HTML has no visible content (e.g. "<p></p>"). Kept in a
 * plain shared module (no "use client"/"use server") since it's imported from both a client
 * component (RichTextEditor) and a "use server" actions file. */
export function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === "";
}

/** Flips the checked state of the Nth task-item checkbox (0-indexed, in document order,
 * across any nesting) in Tiptap-produced HTML -- used to toggle a checkbox directly from the
 * read-only list/Kanban render without opening the full editor. Updates both the <li
 * data-checked="..."> attribute (what Tiptap reads back when the description is next opened
 * for editing) and the <input ... checked> attribute (what determines the checkbox's visual
 * state when this HTML is set via innerHTML/dangerouslySetInnerHTML). Returns the HTML
 * unchanged if no task item exists at that index. */
export function toggleTaskItemChecked(html: string, index: number): string {
  const liOpenRegex = /<li\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  let count = -1;
  let target: RegExpExecArray | null = null;
  while ((m = liOpenRegex.exec(html))) {
    if (!/data-type="taskItem"/.test(m[1])) continue;
    count++;
    if (count === index) {
      target = m;
      break;
    }
  }
  if (!target) return html;

  const wasChecked = /data-checked="true"/.test(target[1]);
  const nowChecked = !wasChecked;
  const liOpenStart = target.index;
  const liOpenEnd = liOpenStart + target[0].length;
  const newAttrs = /data-checked="(true|false)"/.test(target[1])
    ? target[1].replace(/data-checked="(true|false)"/, `data-checked="${nowChecked}"`)
    : `${target[1]} data-checked="${nowChecked}"`;
  const newLiOpen = `<li${newAttrs}>`;

  const afterLi = html.slice(liOpenEnd);
  const inputMatch = /<input\b[^>]*type="checkbox"[^>]*\/?>/.exec(afterLi);
  if (!inputMatch) return html.slice(0, liOpenStart) + newLiOpen + afterLi;

  const inputAbsStart = liOpenEnd + inputMatch.index;
  const inputAbsEnd = inputAbsStart + inputMatch[0].length;
  const newInput = `<input type="checkbox"${nowChecked ? " checked" : ""}>`;

  return html.slice(0, liOpenStart) + newLiOpen + html.slice(liOpenEnd, inputAbsStart) + newInput + html.slice(inputAbsEnd);
}
