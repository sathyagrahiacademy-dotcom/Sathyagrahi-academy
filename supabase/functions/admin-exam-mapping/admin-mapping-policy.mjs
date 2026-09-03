export function normalizeSubtopicTitle(value) {
  const title = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!title) return { ok:false, error:'Subtopic title is required.' };
  if (title.length > 180) return { ok:false, error:'Subtopic title is too long.' };
  return { ok:true, title };
}

export function validateSplitTitles(values) {
  if (!Array.isArray(values)) return { ok:false, error:'Split titles are required.' };
  const titles = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = normalizeSubtopicTitle(value);
    if (!normalized.ok) return normalized;
    const key = normalized.title.toLocaleLowerCase('en-IN');
    if (seen.has(key)) return { ok:false, error:'Split titles must be distinct.' };
    seen.add(key);
    titles.push(normalized.title);
  }
  if (titles.length < 2) return { ok:false, error:'Split requires at least two replacement titles.' };
  return { ok:true, titles };
}

export function validateMergeRequest({ chapterId, subtopicIds, title } = {}) {
  const chapter = Number(chapterId);
  if (!Number.isInteger(chapter) || chapter <= 0) return { ok:false, error:'Valid chapter is required.' };
  if (!Array.isArray(subtopicIds) || subtopicIds.length < 2) return { ok:false, error:'Merge requires at least two subtopics.' };
  const ids = subtopicIds.map(x => String(x ?? '').trim()).filter(Boolean);
  if (ids.length !== subtopicIds.length || new Set(ids).size !== ids.length) return { ok:false, error:'Merge subtopics must be distinct.' };
  const normalized = normalizeSubtopicTitle(title);
  if (!normalized.ok) return normalized;
  return { ok:true, chapterId:chapter, subtopicIds:ids, title:normalized.title };
}

export function validateCoverage(value) {
  const coverage = String(value ?? '').trim().toLowerCase();
  if (!['full','partial'].includes(coverage)) return { ok:false, error:'Coverage must be full or partial.' };
  return { ok:true, coverage };
}
