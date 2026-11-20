/** Pure line-level diff (LCS-based), no external dependency. Used by the TextDiff
 * utility page to compare two blocks of text client-side. */

export type DiffLine = { type: "same" | "add" | "del"; text: string };

// The LCS table below is O(n*m) time and memory. Above this many cells it would
// risk freezing the tab on a large paste, so fall back to a cheap index-aligned
// compare instead (less precise around inserted/deleted lines, but linear).
const MAX_LCS_CELLS = 2_000_000;

export function diffLines(a: string, b: string): DiffLine[] {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const n = linesA.length;
  const m = linesB.length;

  if (n * m > MAX_LCS_CELLS) {
    const result: DiffLine[] = [];
    const max = Math.max(n, m);
    for (let k = 0; k < max; k++) {
      if (k < n && k < m && linesA[k] === linesB[k]) result.push({ type: "same", text: linesA[k] });
      else {
        if (k < n) result.push({ type: "del", text: linesA[k] });
        if (k < m) result.push({ type: "add", text: linesB[k] });
      }
    }
    return result;
  }

  // lcs[i][j] = length of the longest common subsequence of linesA[i:] and linesB[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = linesA[i] === linesB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) {
      result.push({ type: "same", text: linesA[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ type: "del", text: linesA[i] });
      i++;
    } else {
      result.push({ type: "add", text: linesB[j] });
      j++;
    }
  }
  while (i < n) result.push({ type: "del", text: linesA[i++] });
  while (j < m) result.push({ type: "add", text: linesB[j++] });

  return result;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "del") removed++;
  }
  return { added, removed };
}

export type SideCell = { num: number | null; text: string | null; type: "same" | "del" | "add" | "pad" };
export type SideRow = { left: SideCell; right: SideCell };

/** Re-groups the flat diffLines() sequence into diffchecker-style side-by-side rows:
 * unchanged lines stay aligned on both sides, and a run of consecutive removals/additions
 * between two unchanged lines is paired up index-by-index, padding the shorter side with a
 * blank "pad" cell so both panes keep the same row count (and so later unchanged lines still
 * line up on the same row). */
export function diffSideBySide(a: string, b: string): SideRow[] {
  const flat = diffLines(a, b);
  const rows: SideRow[] = [];
  let leftNum = 0;
  let rightNum = 0;
  let dels: string[] = [];
  let adds: string[] = [];

  const flushBlock = () => {
    const max = Math.max(dels.length, adds.length);
    for (let i = 0; i < max; i++) {
      const delText = i < dels.length ? dels[i] : null;
      const addText = i < adds.length ? adds[i] : null;
      rows.push({
        left: delText !== null ? { num: ++leftNum, text: delText, type: "del" } : { num: null, text: null, type: "pad" },
        right: addText !== null ? { num: ++rightNum, text: addText, type: "add" } : { num: null, text: null, type: "pad" },
      });
    }
    dels = [];
    adds = [];
  };

  for (const line of flat) {
    if (line.type === "same") {
      flushBlock();
      rows.push({
        left: { num: ++leftNum, text: line.text, type: "same" },
        right: { num: ++rightNum, text: line.text, type: "same" },
      });
    } else if (line.type === "del") {
      dels.push(line.text);
    } else {
      adds.push(line.text);
    }
  }
  flushBlock();

  return rows;
}
