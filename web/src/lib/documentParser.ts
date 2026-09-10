// Intelligent Multi-Format Document Importer & Multi-Entity Segmenter
import { EntityProperty, LoreArticle } from './database';
import { RoleId, mapSemanticToRoleCategory } from './roles';

export interface ParsedEntityDraft {
  id: string;
  title: string;
  category: string;
  semanticCategory: 'characters' | 'locations' | 'factions' | 'magic' | 'artifacts' | 'bestiary' | 'notes';
  tags: string[];
  properties: EntityProperty[];
  contentHtml: string;
  rawText: string;
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

    if (!pdfjs.GlobalWorkerOptions.workerSrc && typeof window !== 'undefined') {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
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

// Extract key-value entity properties and tags
function extractPropertiesAndTags(title: string, lines: string[], sectionContext: string) {
  const properties: EntityProperty[] = [];
  const textBody = lines.join('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Match "Key: Value" or "● Key: Value" or "○ Key: Value"
    const propMatch = line.match(/^[●○*•-]?\s*([A-Za-z0-9\s&/()'-]{2,30}):\s*(.+)$/);
    if (propMatch && !propMatch[1].toLowerCase().includes('http')) {
      const key = propMatch[1].trim();
      const value = propMatch[2].trim();
      if (value.length > 0 && value.length < 250) {
        properties.push({ key, value });
      }
    }
  }

  const tags = new Set<string>();
  const lowerTitle = title.toLowerCase();
  const lowerSection = sectionContext.toLowerCase();
  const lowerBody = textBody.toLowerCase();

  // Section and Title Tag Hints
  if (
    lowerSection.includes('governments') ||
    lowerSection.includes('contingent') ||
    lowerTitle.includes('kingdom') ||
    lowerTitle.includes('empire') ||
    lowerTitle.includes('dominion') ||
    lowerTitle.includes('nation')
  ) {
    tags.add('faction');
  }
  if (lowerSection.includes('bestiary') || lowerBody.includes('monster')) {
    tags.add('bestiary');
  }
  if (lowerSection.includes('gemstones') || lowerTitle.includes('stone of') || lowerBody.includes('stone of')) {
    tags.add('gemstone');
    tags.add('artifact');
  }
  if (lowerSection.includes('schools') || lowerTitle.includes('school of')) {
    tags.add('school');
    tags.add('location');
  }
  if (lowerSection.includes('arcanas') || lowerTitle.includes('arcana') || lowerBody.includes('arcana')) {
    tags.add('arcana');
    tags.add('magic');
  }
  if (lowerSection.includes('divinations') || lowerBody.includes('divination')) {
    tags.add('divination');
  }
  if (lowerTitle.includes('mercer')) {
    tags.add('mercer');
    tags.add('character');
  }
  if (lowerBody.includes('vampire')) tags.add('vampire');
  if (lowerBody.includes('dhampir')) tags.add('dhampir');
  if (lowerBody.includes('werewolf')) tags.add('werewolf');
  if (lowerBody.includes('heartless')) tags.add('heartless');

  // Semantic Category Classification
  let semanticCategory: 'characters' | 'locations' | 'factions' | 'magic' | 'artifacts' | 'bestiary' | 'notes' = 'notes';

  if (
    lowerSection.includes('character') ||
    lowerSection.includes('mercer') ||
    lowerSection.includes('contingent') ||
    lowerTitle.includes('mercer') ||
    lowerTitle.includes('captain') ||
    lowerTitle.includes('oracle') ||
    lowerTitle.includes('shaman') ||
    lowerTitle.includes('brother') ||
    lowerBody.includes('identity & personality') ||
    lowerBody.includes('allegiance/role') ||
    /^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+\([^)]+\))?$/.test(title)
  ) {
    if (lowerTitle.includes('baseline') || lowerTitle === 'mercers') {
      semanticCategory = 'factions';
    } else {
      semanticCategory = 'characters';
    }
  } else if (
    lowerSection.includes('bestiary') ||
    lowerTitle.includes('vampire') ||
    lowerTitle.includes('dhampir') ||
    lowerTitle.includes('werewolf') ||
    lowerTitle.includes('ghoul') ||
    lowerTitle.includes('mimic') ||
    lowerTitle.includes('mummy') ||
    lowerTitle.includes('monster') ||
    lowerTitle.includes('abomination') ||
    lowerTitle.includes('lineage')
  ) {
    semanticCategory = 'bestiary';
  } else if (
    lowerSection.includes('gemstone') ||
    lowerTitle.includes('stone of') ||
    lowerTitle.includes('katana') ||
    lowerTitle.includes('weapon') ||
    lowerTitle.includes('relic')
  ) {
    semanticCategory = 'artifacts';
  } else if (
    lowerSection.includes('governments') ||
    lowerTitle.includes('dominion') ||
    lowerTitle.includes('empire') ||
    lowerTitle.includes('kingdom') ||
    lowerTitle.includes('nation') ||
    lowerTitle.includes('heartless')
  ) {
    semanticCategory = 'factions';
  } else if (
    lowerSection.includes('school') ||
    lowerTitle.includes('school of') ||
    lowerBody.includes('capital city') ||
    lowerTitle.includes('city') ||
    lowerTitle.includes('lake') ||
    lowerTitle.includes('mountain')
  ) {
    semanticCategory = 'locations';
  } else if (
    lowerSection.includes('arcana') ||
    lowerSection.includes('divination') ||
    lowerTitle.includes('divination') ||
    lowerTitle.includes('arcana') ||
    lowerTitle.includes('attack')
  ) {
    semanticCategory = 'magic';
  }

  return {
    semanticCategory,
    properties,
    tags: Array.from(tags),
  };
}

// Multi-Entity Document Segmentation Algorithm
export function segmentDocumentText(text: string, activeRole: RoleId): ParsedEntityDraft[] {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');

  const KNOWN_SECTIONS = [
    'governments',
    'bestiary',
    'gemstones',
    'schools',
    'arcanas',
    'arcana',
    'divinations',
    'divination',
    'mercers',
    'heartless',
    'the aethelian dominion contingent',
    'the harkness empire contingent',
    'the fiona kingdom contingent',
    'characters',
    'locations',
    'factions',
    'weapons',
    'items',
    'monsters',
    'game systems & mechanics',
    'mechanics',
    'quests',
    'encounters',
  ];

  let currentMajorSection = 'World Overview';
  const rawSegments: { title: string; sectionContext: string; lines: string[] }[] = [];
  let currentSegment: { title: string; sectionContext: string; lines: string[] } | null = null;

  function isMajorSectionHeader(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 50) return false;
    if (/^#{1,2}\s+[A-Za-z0-9]/.test(trimmed)) return true;
    const lower = trimmed.toLowerCase().replace(/[:#]/g, '').trim();
    return KNOWN_SECTIONS.includes(lower);
  }

  function isEntityHeader(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 65) return false;

    // Markdown H2 / H3
    if (/^#{2,4}\s+.+/.test(trimmed)) return true;

    // Numbered entity e.g., "1. Roric Houstan (The Captain)" or "I. The Intelligent Abomination"
    if (/^(\d+\.|\b[IVXLCDM]+\.)\s+[A-Z].+/.test(trimmed)) return true;

    // "Title: Subtitle" or "Name (Title)"
    if (/^[A-Z][A-Za-z0-9\s'’-]+:\s*([A-Z].+)?$/.test(trimmed) && trimmed.length < 55) {
      const lower = trimmed.toLowerCase().replace(/[:.]/g, '').trim();
      const nonEntityPrefixes = [
        'capital city',
        'phase 1',
        'phase 2',
        'phase 3',
        'phase 4',
        'arcana',
        'allegiance/role',
        'identity & personality',
        'abilities & relic',
        'abilities & weapons',
        'origins & inheritance',
        'nature',
        'tactics',
        'hierarchy & types',
        'physiology & vulnerabilities',
        'combat traits',
        'unique divination',
      ];
      if (!nonEntityPrefixes.some((p) => lower.startsWith(p))) {
        return true;
      }
    }

    if (/^[A-Z][A-Za-z0-9\s'’-]+\s*\([A-Za-z0-9\s/'-]+\)$/.test(trimmed) && trimmed.length < 55) {
      return true;
    }

    // Standalone entity names like "Vampires", "Werewolves", "Fire", "Water"
    if (/^[A-Z][A-Za-z0-9\s'’-]+$/.test(trimmed) && trimmed.split(' ').length <= 4) {
      const lower = trimmed.toLowerCase().trim();
      const nonEntityWords = ['pact', 'binding', 'morph', 'curse', 'blessing', 'aging'];
      if (!nonEntityWords.includes(lower) && !KNOWN_SECTIONS.includes(lower)) {
        return true;
      }
    }

    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentSegment && currentSegment.lines.length > 0) {
        currentSegment.lines.push('');
      }
      continue;
    }

    if (isMajorSectionHeader(trimmed)) {
      currentMajorSection = trimmed.replace(/^#+\s*/, '').replace(/[:#]/g, '').trim();
      continue;
    }

    if (isEntityHeader(trimmed)) {
      const cleanTitle = trimmed
        .replace(/^#+\s*/, '')
        .replace(/^(\d+\.|\b[IVXLCDM]+\.)\s+/, '')
        .replace(/:$/, '')
        .trim();

      if (currentSegment && currentSegment.lines.filter((l) => l.trim().length > 0).length > 0) {
        rawSegments.push(currentSegment);
      }

      currentSegment = {
        title: cleanTitle,
        sectionContext: currentMajorSection,
        lines: [],
      };
      continue;
    }

    if (currentSegment) {
      currentSegment.lines.push(line);
    } else {
      currentSegment = {
        title: currentMajorSection || 'Overview',
        sectionContext: currentMajorSection,
        lines: [line],
      };
    }
  }

  if (currentSegment && currentSegment.lines.filter((l) => l.trim().length > 0).length > 0) {
    rawSegments.push(currentSegment);
  }

  // Fallback: If no sub-entities were detected, treat the entire doc as 1 article
  if (rawSegments.length === 0) {
    rawSegments.push({
      title: 'Imported Document',
      sectionContext: 'General Lore',
      lines: lines,
    });
  }

  // Convert raw segments to fully enriched ParsedEntityDraft items
  return rawSegments.map((seg, idx) => {
    const rawBody = seg.lines.join('\n').trim();
    const { semanticCategory, properties, tags } = extractPropertiesAndTags(seg.title, seg.lines, seg.sectionContext);
    const categoryName = mapSemanticToRoleCategory(semanticCategory, activeRole);
    const contentHtml = convertTextToHtml(seg.title, rawBody);
    const timestamp = Date.now() + idx;

    return {
      id: `imported-${seg.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`,
      title: seg.title,
      category: categoryName,
      semanticCategory,
      tags,
      properties,
      contentHtml,
      rawText: rawBody,
      selected: true,
    };
  });
}

// Master file parser for File objects (.pdf, .docx, .doc, .md, .txt, .json)
export async function parseDocumentFile(file: File, activeRole: RoleId): Promise<ParsedEntityDraft[]> {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  // 1. JSON (Gaea-Forge export backup or raw lore list)
  if (fileName.endsWith('.json')) {
    const text = new TextDecoder('utf-8').decode(arrayBuffer);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item: Partial<LoreArticle>, idx: number) => ({
        id: item.id || `json-import-${Date.now()}-${idx}`,
        title: item.title || 'Untitled Lore',
        category: item.category || mapSemanticToRoleCategory('notes', activeRole),
        semanticCategory: 'notes',
        tags: item.tags || [],
        properties: item.properties || [],
        contentHtml: item.content || `<h1>${escapeHtml(item.title || '')}</h1>`,
        rawText: '',
        selected: true,
      }));
    }
  }

  // 2. PDF Document
  if (fileName.endsWith('.pdf')) {
    const extractedText = await extractTextFromPdf(arrayBuffer);
    return segmentDocumentText(extractedText, activeRole);
  }

  // 3. Word DOCX Document
  if (fileName.endsWith('.docx')) {
    const { text, html } = await extractFromDocx(arrayBuffer);
    const segments = segmentDocumentText(text, activeRole);
    // If only one segment and mammoth generated clean HTML, preserve it
    if (segments.length === 1 && html) {
      segments[0].contentHtml = html;
    }
    return segments;
  }

  // 4. Legacy Word DOC Document
  if (fileName.endsWith('.doc')) {
    const extractedText = extractTextFromBinaryDoc(arrayBuffer);
    return segmentDocumentText(extractedText, activeRole);
  }

  // 5. Markdown / Plain Text (.md, .txt)
  const text = new TextDecoder('utf-8').decode(arrayBuffer);
  return segmentDocumentText(text, activeRole);
}
