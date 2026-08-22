import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const terms = ["2025-Fall", "2026-Spring", "2026-Fall"];
const sourceRepository = "https://github.com/soid/columbia-catalog-data";
const destination = resolve("src/data/columbia-courses.json");

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const coursesByCode = new Map();

for (const term of terms) {
  const response = await fetch(
    `https://raw.githubusercontent.com/soid/columbia-catalog-data/master/classes/${term}.json`
  );
  if (!response.ok) throw new Error(`Could not download ${term}: ${response.status}`);

  const rows = await response.json();
  for (const row of rows) {
    const code = String(row.course_code ?? "").trim().replace(/\s+/g, " ");
    if (!code) continue;

    const key = normalizeCode(code);
    const existing = coursesByCode.get(key) ?? {
      code,
      title: String(row.course_title ?? "").trim(),
      terms: [],
    };

    if (!existing.title && row.course_title) existing.title = String(row.course_title).trim();
    if (!existing.terms.includes(term)) existing.terms.push(term);
    coursesByCode.set(key, existing);
  }
}

const catalog = {
  updated: new Date().toISOString().slice(0, 10),
  source: sourceRepository,
  sourceDescription: "Public mirror of the Columbia University Directory of Classes",
  terms,
  courses: [...coursesByCode.values()].sort((first, second) => first.code.localeCompare(second.code)),
};

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(catalog));
console.log(`Wrote ${catalog.courses.length} Columbia courses to ${destination}`);
