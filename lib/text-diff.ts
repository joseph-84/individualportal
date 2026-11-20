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
