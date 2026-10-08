// Intelligent Multi-Format Document Importer & Multi-Entity Segmenter
import { EntityProperty, LoreArticle } from './database';
import { RoleId } from './roles';
import { classifyEntry, defaultImportRules, fallbackCategory, ImportRule } from './importRules';
import { sanitizeImportedHtml } from './sanitizeHtml';

export interface ParsedEntityDraft {
  id: string;
  title: string;
  category: string;
  // The section heading the entry was found under ('' if none); used for categorizing
  sectionContext: string;
  // True once the category is final (already-structured imports, or changed by hand),
  // so re-sorting with new keyword rules leaves it alone
  categoryLocked: boolean;
  tags: string[];
  properties: EntityProperty[];
  contentHtml: string;
  rawText: string;
  coverImage?: string;
  selected: boolean;
}

// Convert plain text or markdown to TipTap-compatible HTML
export function convertTextToHtml(title: string, text: string): string {
  const lines = text.split('\n');
  const htmlParts: string[] = [`<h1>${escapeHtml(title)}</h1>`];

  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Markdown H2 / H3 / H4
    if (/^#{2,4}\s+/.test(line)) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      const hText = line.replace(/^#{2,4}\s+/, '');
      htmlParts.push(`<h2>${escapeHtml(hText)}</h2>`);
      continue;
    }

    // "Identity & Personality:" on its own line is a subheading
    if (/^[^:]{2,40}:$/.test(line) && !line.startsWith('http')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(`<h3>${escapeHtml(line.slice(0, -1))}</h3>`);
      continue;
    }

    // Bullet points (●, ○, *, -, •)
    const listMatch = line.match(/^[●○*•-]\s*(.+)$/);
    if (listMatch) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      const itemContent = formatInlineText(listMatch[1]);
      htmlParts.push(`<li>${itemContent}</li>`);
      continue;
    }

    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }

    // Normal paragraph
    htmlParts.push(`<p>${formatInlineText(line)}</p>`);
  }

  if (inList) {
    htmlParts.push('</ul>');
  }

  return htmlParts.join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineText(str: string): string {
  // Bold Key: Value or **bold**
  let formatted = escapeHtml(str);

  // **bold**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Key: Value at beginning of line
  formatted = formatted.replace(/^([A-Za-z0-9\s&/()'-]{2,35}):\s*/, '<strong>$1:</strong> ');

  return formatted;
}

// Binary DOC text stream decoder
function extractTextFromBinaryDoc(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let ascii = '';

  // Extract consecutive printable ASCII characters
  let currentChunk = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      currentChunk += String.fromCharCode(b);
    } else {
      if (currentChunk.length > 3) {
        ascii += currentChunk + '\n';
      }
      currentChunk = '';
    }
  }

  // Also try UTF-16LE decoding for rich Word documents
  try {
    const decoder = new TextDecoder('utf-16le', { fatal: false });
    const utf16Candidate = decoder.decode(bytes);
    const cleanedUtf16 = utf16Candidate
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim();

    if (cleanedUtf16.length > ascii.length) {
      return cleanedUtf16;
    }
  } catch {
    // ignore
  }

  return ascii;
}

// PDF Text Extractor using pdfjs-dist with fallback
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Worker is bundled from node_modules so PDF import works offline and under a self-only CSP.
    if (!pdfjs.GlobalWorkerOptions.workerPort && typeof window !== 'undefined') {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' },
      );
    }

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let pageStr = '';

      for (const item of textContent.items as Array<{ str?: string; transform?: number[] }>) {
        if (!item.str) continue;
        const currentY = item.transform ? item.transform[5] : null;

        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 8) {
          pageStr += '\n';
        } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
          pageStr += ' ';
        }

        pageStr += item.str;
        lastY = currentY;
      }

      pageTexts.push(pageStr);
    }

    const fullPdfText = pageTexts.join('\n\n');
    if (fullPdfText.trim().length > 50) {
      return fullPdfText;
    }
  } catch (err) {
    console.warn('pdfjs-dist extraction fallback invoked:', err);
  }

  // Fallback: direct text stream extraction from PDF binary
  const bytes = new Uint8Array(arrayBuffer);
  const rawStr = new TextDecoder('latin1').decode(bytes);
  const textChunks: string[] = [];
  
  // Look for text within BT ... ET blocks or parentheses
  const matches = rawStr.match(/\(([^()]{2,})\)[\s]*T[jJ]/g);
  if (matches && matches.length > 10) {
    for (const m of matches) {
      const clean = m.replace(/[\(\)]/g, '').replace(/T[jJ]/, '').trim();
      if (clean.length > 1) textChunks.push(clean);
    }
    return textChunks.join('\n');
  }

  return extractTextFromBinaryDoc(arrayBuffer);
}

// DOCX text and HTML extractor via mammoth
async function extractFromDocx(arrayBuffer: ArrayBuffer): Promise<{ text: string; html: string }> {
  try {
    const mammoth = await import('mammoth');
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer }),
    ]);

    return {
      text: rawResult.value || '',
      html: htmlResult.value || '',
    };
  } catch (err) {
    console.warn('Mammoth extraction notice:', err);
    return {
      text: extractTextFromBinaryDoc(arrayBuffer),
      html: '',
    };
  }
}

// "Key: Value" lines (optionally bulleted) become entity properties
const PROPERTY_LINE = /^[●○*•-]?\s*([A-Za-z0-9\s&/()'-]{2,30}):\s*(.+)$/;

function extractProperties(lines: string[]): EntityProperty[] {
  const properties: EntityProperty[] = [];
  for (const rawLine of lines) {
    const match = rawLine.trim().match(PROPERTY_LINE);
    if (!match || match[1].toLowerCase().includes('http')) continue;
    const value = match[2].trim();
    if (value.length > 0 && value.length < 250) properties.push({ key: match[1].trim(), value });
  }
  return properties;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Generic headings that group entries (in addition to the role's own category names)
const GENERIC_SECTION_NAMES = [
  'characters', 'people', 'cast', 'npcs', 'locations', 'places', 'factions', 'organizations',
  'creatures', 'bestiary', 'monsters', 'items', 'artifacts', 'weapons', 'magic', 'spells',
  'technology', 'history', 'events', 'quests', 'chapters', 'glossary', 'appendix',
];

// Small words that may stay lowercase in a Title Case heading ("Stone of Embers")
const MINOR_WORDS = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'de', 'von', 'van', 'du', 'la', 'le']);

function isTitleCaseLine(line: string): boolean {
  if (line.length > 60 || /[.,!?;:]$/.test(line) || !/^[A-Z]/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 6) return false;
  return words.every((w, i) => (i > 0 && MINOR_WORDS.has(w.toLowerCase())) || /^[A-Z0-9("'‘“]/.test(w));
}

// Multi-entity segmentation: split a document into one draft per entry, using
// structure only (headings, numbering, Title Case lines), never world-specific words.
export function segmentDocumentText(
  text: string,
  activeRole: RoleId,
  rules: ImportRule[] = defaultImportRules(activeRole)
): ParsedEntityDraft[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sectionNames = new Set([
    ...GENERIC_SECTION_NAMES,
    ...rules.map((r) => r.category.toLowerCase()),
  ]);

  function isPropertyLine(line: string): boolean {
    return PROPERTY_LINE.test(line);
  }

  function isEntityHeader(line: string): boolean {
    if (!line || line.length > 65 || isPropertyLine(line)) return false;
    // Markdown H2-H4
    if (/^#{2,4}\s+\S/.test(line)) return true;
    // Numbered entries: "1. Roric Houstan (The Captain)", "IV. The Last Gate"
    if (/^(\d+\.|[IVXLCDM]+\.)\s+[A-Z]/.test(line)) return true;
    // "Name (Title)"
    if (/^[A-Z][^()]{0,50}\([^()]{1,40}\)$/.test(line)) return true;
    return isTitleCaseLine(line);
  }

  const nextNonEmpty = (from: number) => {
    for (let j = from; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t) return t;
    }
    return '';
  };

  function isSectionHeader(line: string, index: number): boolean {
    if (!line || line.length > 60) return false;
    // Markdown H1
    if (/^#\s+\S/.test(line)) return true;
    const bare = line.replace(/[:#]/g, '').trim();
    // ALL CAPS headings ("GOVERNMENTS", "THE NORTHERN REACHES")
    if (/[A-Z]{3}/.test(bare) && bare === bare.toUpperCase() && bare.split(/\s+/).length <= 6) return true;
    // Known group names, or a heading directly followed by another heading
    if (sectionNames.has(bare.toLowerCase())) return true;
    return isEntityHeader(line) && !/^#{2,4}\s/.test(line) && isEntityHeader(nextNonEmpty(index + 1));
  }

  const DEFAULT_SECTION = '';
  let section = DEFAULT_SECTION;
  type Segment = { title: string; sectionContext: string; lines: string[] };
  const segments: Segment[] = [];
  let current: Segment | null = null;
  const hasContent = (seg: Segment | null): seg is Segment => !!seg && seg.lines.some((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (current?.lines.length) current.lines.push('');
      continue;
    }

    if (isSectionHeader(trimmed, i)) {
      section = trimmed.replace(/^#+\s*/, '').replace(/[:#]/g, '').trim();
      continue;
    }

    if (isEntityHeader(trimmed)) {
      if (hasContent(current)) segments.push(current);
      current = {
        title: trimmed.replace(/^#+\s*/, '').replace(/^(\d+\.|[IVXLCDM]+\.)\s+/, '').trim(),
        sectionContext: section,
        lines: [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else {
      // Text before the first heading becomes an entry named after its section
      current = { title: section || 'Overview', sectionContext: section, lines: [line] };
    }
  }
  if (hasContent(current)) segments.push(current);

  // No structure found: import the whole document as one article
  if (segments.length === 0) {
    segments.push({ title: 'Imported Document', sectionContext: DEFAULT_SECTION, lines });
  }

  const fallback = fallbackCategory(activeRole);
  return segments.map((seg, idx) => {
    const rawBody = seg.lines.join('\n').trim();
    const timestamp = Date.now() + idx;
    return {
      id: `imported-${slugify(seg.title)}-${timestamp}`,
      title: seg.title,
      category: classifyEntry({ title: seg.title, sectionContext: seg.sectionContext, body: rawBody }, rules, fallback),
      sectionContext: seg.sectionContext,
      categoryLocked: false,
      // The section an entry came from is a useful tag ("bestiary", "governments")
      tags: seg.sectionContext ? [slugify(seg.sectionContext)].filter(Boolean) : [],
      properties: extractProperties(seg.lines),
      contentHtml: convertTextToHtml(seg.title, rawBody),
      rawText: rawBody,
      selected: true,
    };
  });
}

// Re-sort drafts with (edited) keyword rules, leaving locked categories alone
export function recategorizeDrafts(
  drafts: ParsedEntityDraft[],
  activeRole: RoleId,
  rules: ImportRule[]
): ParsedEntityDraft[] {
  const fallback = fallbackCategory(activeRole);
  return drafts.map((d) =>
    d.categoryLocked
      ? d
      : { ...d, category: classifyEntry({ title: d.title, sectionContext: d.sectionContext, body: d.rawText }, rules, fallback) }
  );
}

// Turn already-structured articles (e.g. from a JSON export) into reviewable drafts
export function articlesToDrafts(items: unknown[], activeRole: RoleId): ParsedEntityDraft[] {
  return items
    .filter((item): item is Partial<LoreArticle> => !!item && typeof item === 'object')
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `json-import-${Date.now()}-${idx}`,
      title: typeof item.title === 'string' && item.title ? item.title : 'Untitled Lore',
      category: typeof item.category === 'string' && item.category ? item.category : fallbackCategory(activeRole),
      sectionContext: '',
      categoryLocked: true,
      tags: Array.isArray(item.tags) ? item.tags.filter((t) => typeof t === 'string') : [],
      properties: Array.isArray(item.properties)
        ? item.properties.filter((p) => p && typeof p.key === 'string' && typeof p.value === 'string')
        : [],
      contentHtml: sanitizeImportedHtml(
        typeof item.content === 'string' && item.content
          ? item.content
          : `<h1>${escapeHtml(typeof item.title === 'string' ? item.title : '')}</h1>`,
      ),
      rawText: '',
      ...(typeof item.coverImage === 'string' ? { coverImage: item.coverImage } : {}),
      selected: true,
    }));
}

// Master file parser for File objects (.pdf, .docx, .doc, .md, .txt, .json)
export async function parseDocumentFile(
  file: File,
  activeRole: RoleId,
  rules: ImportRule[] = defaultImportRules(activeRole)
): Promise<ParsedEntityDraft[]> {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  // 1. JSON (Gaea-Forge backup, legacy article-list export, or raw lore list)
  if (fileName.endsWith('.json')) {
    const text = new TextDecoder('utf-8').decode(arrayBuffer);
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return articlesToDrafts(parsed, activeRole);
    }
    const wrapped = (parsed as { articles?: unknown } | null)?.articles;
    if (Array.isArray(wrapped)) {
      return articlesToDrafts(wrapped, activeRole);
    }
    throw new Error('This JSON file is not a Gaea-Forge backup or a list of articles.');
  }

  // 2. PDF Document
  if (fileName.endsWith('.pdf')) {
    const extractedText = await extractTextFromPdf(arrayBuffer);
    return segmentDocumentText(extractedText, activeRole, rules);
  }

  // 3. Word DOCX Document
  if (fileName.endsWith('.docx')) {
    const { text, html } = await extractFromDocx(arrayBuffer);
    const segments = segmentDocumentText(text, activeRole, rules);
    // If only one segment and mammoth generated clean HTML, preserve it
    if (segments.length === 1 && html) {
      segments[0].contentHtml = sanitizeImportedHtml(html);
    }
    return segments;
  }

  // 4. Legacy Word DOC Document
  if (fileName.endsWith('.doc')) {
    const extractedText = extractTextFromBinaryDoc(arrayBuffer);
    return segmentDocumentText(extractedText, activeRole, rules);
  }

  // 5. Markdown / Plain Text (.md, .txt)
  const text = new TextDecoder('utf-8').decode(arrayBuffer);
  return segmentDocumentText(text, activeRole, rules);
}
