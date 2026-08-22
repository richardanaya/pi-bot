const LIMITS: Array<[number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

export function normalizeSchedule(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  assertCron(trimmed);
  return trimmed;
}

export function assertCron(expr: string): void {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Schedule must be a 5-field cron: minute hour day month weekday");
  }
  for (let i = 0; i < 5; i += 1) {
    const [min, max] = LIMITS[i]!;
    if (!validField(parts[i]!, min, max)) {
      throw new Error(`Invalid cron field "${parts[i]}"`);
    }
  }
}

export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const values = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay(),
  ];
  return parts.every((field, i) => {
    const [min, max] = LIMITS[i]!;
    return fieldMatches(field, values[i]!, min, max);
  });
}

export function sameMinute(a: number, b: number): boolean {
  return Math.floor(a / 60_000) === Math.floor(b / 60_000);
}

function validField(field: string, min: number, max: number): boolean {
  return field.split(",").every((token) => validToken(token, min, max));
}

function validToken(token: string, min: number, max: number): boolean {
  if (token === "*") return true;
  if (token.includes("/")) {
    const [range, stepStr] = token.split("/");
    const step = Number(stepStr);
    if (!Number.isInteger(step) || step <= 0) return false;
    if (range === "*") return true;
    return validToken(range ?? "", min, max);
  }
  if (token.includes("-")) {
    const [lo, hi] = token.split("-").map(Number);
    return Number.isInteger(lo) && Number.isInteger(hi) && lo! >= min && hi! <= max && lo! <= hi!;
  }
  const n = Number(token);
  return Number.isInteger(n) && n >= min && n <= max;
}

function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((token) => tokenMatches(token, value, min, max));
}

function tokenMatches(token: string, value: number, min: number, max: number): boolean {
  if (token === "*") return true;
  if (token.includes("/")) {
    const [range, stepStr] = token.split("/");
    const step = Number(stepStr);
    if (!Number.isInteger(step) || step <= 0) return false;
    const [lo, hi] = bounds(range ?? "*", min, max);
    return value >= lo && value <= hi && (value - lo) % step === 0;
  }
  if (token.includes("-")) {
    const [lo, hi] = bounds(token, min, max);
    return value >= lo && value <= hi;
  }
  return Number(token) === value;
}

function bounds(range: string, min: number, max: number): [number, number] {
  if (range === "*" || range === "") return [min, max];
  if (range.includes("-")) {
    const [lo, hi] = range.split("-").map(Number);
    return [lo!, hi!];
  }
  const n = Number(range);
  return [n, max];
}
