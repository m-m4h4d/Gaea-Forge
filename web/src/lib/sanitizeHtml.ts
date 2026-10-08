// HTML sanitizer for untrusted imported lore content (JSON imports, .docx output, backups)
import DOMPurify from 'dompurify';

// Markup supported by TipTap StarterKit; everything else is stripped (text content is kept).
const ALLOWED_TAGS = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
  'strong', 'b', 'em', 'i', 's', 'strike', 'del', 'u', 'a',
];

const ALLOWED_ATTR = ['href', 'start', 'class'];

const SAFE_URI = /^(?:https?:|mailto:|#)/i;

/**
 * Sanitizes untrusted HTML down to the TipTap StarterKit subset.
 * Must run in a browser context; outside one (e.g. static prerender) it escapes the input instead.
 */
export function sanitizeImportedHtml(dirty: string): string {
  if (typeof window === 'undefined' || !DOMPurify.isSupported) {
    return dirty.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URI,
    ALLOW_DATA_ATTR: false,
  });
}
