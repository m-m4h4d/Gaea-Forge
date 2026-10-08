// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeImportedHtml } from './sanitizeHtml';

describe('sanitizeImportedHtml', () => {
  it('keeps TipTap StarterKit formatting', () => {
    const html =
      '<h2>Title</h2><ul><li><strong>Bold</strong> <em>it</em> <s>gone</s></li></ul><ol start="3"><li>x</li></ol>' +
      '<blockquote><p>q</p></blockquote><pre><code class="language-js">a</code></pre><hr><p><a href="https://example.com">ok</a></p>';
    expect(sanitizeImportedHtml(html)).toBe(html);
  });

  it('removes scripts, event handlers and javascript: links', () => {
    const out = sanitizeImportedHtml(
      '<p>a</p><img src=x onerror="alert(1)"><svg onload="alert(1)"></svg><script>alert(1)</script>' +
        '<a href="javascript:alert(1)" onclick="alert(1)">b</a><iframe src="https://example.com"></iframe>',
    );
    expect(out).toBe('<p>a</p><a>b</a>');
  });

  it('drops unsupported tags but keeps their text', () => {
    expect(sanitizeImportedHtml('<table><tr><td>cell</td></tr></table><p style="color:red">x</p>')).toBe('cell<p>x</p>');
  });
});
