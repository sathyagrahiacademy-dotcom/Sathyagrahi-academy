function cleanClause(value) {
  return String(value ?? '')
    .replace(/^\s*(?:[•●▪◦*-]|\d+\s*[.)-])\s*/u, '')
    .replace(/[.]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function suggestSubtopics(officialDetail) {
  const text = String(officialDetail ?? '').replace(/\r/g, '\n').trim();
  if (!text) return [];

  const parts = text
    .split(/;|\n+|(?<=[.!?])\s+(?=(?:[•●▪◦*-]|\d+\s*[.)-]|[A-Z]))/u)
    .map(cleanClause)
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const key = part.toLocaleLowerCase('en-IN');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}
