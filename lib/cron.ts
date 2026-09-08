// Minimal 5-field cron parser/matcher (minute hour day month weekday). No seconds, no `L`/`#`.

function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(\*|\d+-\d+|\d+)\/(\d+)$/);
    if (stepMatch) {
      const [, rangePart, stepStr] = stepMatch;
      const step = Number(stepStr);
      const [lo, hi] = rangePart === "*" ? [min, max] : rangePart.split("-").map(Number);
      for (let v = lo; v <= hi; v += step) out.add(v);
      continue;
    }
    if (part === "*") {
      for (let v = min; v <= max; v++) out.add(v);
      continue;
    }
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = Number(rangeMatch[1]);
      const hi = Number(rangeMatch[2]);
      for (let v = lo; v <= hi; v++) out.add(v);
      continue;
    }
    if (/^\d+$/.test(part)) {
      out.add(Number(part));
      continue;
    }
  }
  return out;
}

export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  try {
    parseField(parts[0], 0, 59);
    parseField(parts[1], 0, 23);
    parseField(parts[2], 1, 31);
    parseField(parts[3], 1, 12);
    parseField(parts[4], 0, 6);
    return true;
  } catch {
    return false;
  }
}

/** True when `date` (local time, minute resolution) matches the cron expression. */
export function matchesCron(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minF, hourF, domF, monF, dowF] = parts;
  const minutes = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monF, 1, 12);
  const dows = parseField(dowF, 0, 6);

  return (
    minutes.has(date.getMinutes()) &&
    hours.has(date.getHours()) &&
    doms.has(date.getDate()) &&
    months.has(date.getMonth() + 1) &&
    dows.has(date.getDay())
  );
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** Best-effort Korean label for common patterns; falls back to the raw expression. */
export function cronToLabel(expr: string | null): string {
  if (!expr) return "수동 실행만";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5 || !isValidCron(expr)) return expr;
  const [min, hour, dom, mon, dow] = parts;
  const hh = hour.padStart(2, "0");
  const mm = min.padStart(2, "0");

  if (dom === "*" && mon === "*" && dow === "*" && /^\d+$/.test(hour) && /^\d+$/.test(min)) {
    return `매일 ${hh}:${mm}`;
  }
  if (dom === "*" && mon === "*" && /^\d+$/.test(dow) && /^\d+$/.test(hour) && /^\d+$/.test(min)) {
    return `매주 ${WEEKDAY_KO[Number(dow)]} ${hh}:${mm}`;
  }
  if (/^\d+$/.test(dom) && mon === "*" && dow === "*" && /^\d+$/.test(hour) && /^\d+$/.test(min)) {
    return `매월 ${dom}일 ${hh}:${mm}`;
  }
  if (min === "0" && hour.startsWith("*/")) {
    return `${hour.slice(2)}시간마다`;
  }
  if (min.startsWith("*/") && hour === "*") {
    return `${min.slice(2)}분마다`;
  }
  return expr;
}
