'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { LinkTarget, LoreLink, loreLinkRefreshKey } from './editor/loreLink';
import { LORE_LINK_ATTR } from '@/lib/links';

// How many of the editor's own recent outputs to remember when filtering echoes
const EMITTED_HISTORY_SIZE = 100;

interface EditorProps {
  content: string;
  onChange: (newContent: string) => void;
  readOnly?: boolean;
  // Articles that [[ links can point to
  linkTargets?: LinkTarget[];
  onOpenArticle?: (articleId: string) => void;
  // Create an article from the [[ picker; returns the new article's id
  onCreateLinkedArticle?: (title: string) => string;
}

export default function Editor({
  content,
  onChange,
  readOnly = false,
  linkTargets = [],
  onOpenArticle,
  onCreateLinkedArticle,
}: EditorProps) {
  // HTML this editor has emitted. A content prop matching one of these is an echo
  // of the user's own typing (possibly stale), not an external change.
  const emittedRef = useRef(new Set<string>());

  // The editor's extensions are created once, so they read live values through refs
  const linkTargetsRef = useRef(linkTargets);
  const onOpenArticleRef = useRef(onOpenArticle);
  const onCreateRef = useRef(onCreateLinkedArticle);
  useEffect(() => {
    linkTargetsRef.current = linkTargets;
    onOpenArticleRef.current = onOpenArticle;
    onCreateRef.current = onCreateLinkedArticle;
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      // The refs are only read inside editor event handlers, never during render
      // eslint-disable-next-line react-hooks/refs
      LoreLink.configure({
        getTargets: () => linkTargetsRef.current,
        onCreate: (title) => onCreateRef.current?.(title) ?? '',
      }),
    ],
    immediatelyRender: false,
    content: content || '<p>Start typing your lore...</p>',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const emitted = emittedRef.current;
      emitted.add(html);
      if (emitted.size > EMITTED_HISTORY_SIZE) {
        emitted.delete(emitted.values().next().value as string);
      }
      onChange(html);
    },
    editorProps: {
      // Clicking a link to an existing article opens it
      handleClick: (_view, _pos, event) => {
        const link = (event.target as HTMLElement | null)?.closest(`[${LORE_LINK_ATTR}]`);
        const id = link?.getAttribute(LORE_LINK_ATTR);
        if (!id || !linkTargetsRef.current.some((t) => t.id === id)) return false;
        onOpenArticleRef.current?.(id);
        return true;
      },
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[350px] p-3 sm:p-6 text-parchment font-serif leading-relaxed',
      },
    },
  });

  // Sync internal editor content when active article content changes externally
  // (e.g. an import overwrote this article). Resetting on our own echoes would
  // discard keystrokes typed since that echo was produced.
  useEffect(() => {
    if (!editor || emittedRef.current.has(content) || content === editor.getHTML()) return;
    emittedRef.current.clear();
    editor.commands.setContent(content || '', { emitUpdate: false });
  }, [content, editor]);

  // Re-check which links are broken when articles are added or deleted
  const targetIdsKey = linkTargets.map((t) => t.id).join('\n');
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta(loreLinkRefreshKey, true));
    }
  }, [editor, targetIdsKey]);

  if (!editor) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-900 rounded-xl">
        Loading Lore Editor...
      </div>
    );
  }

  const textContent = editor.getText();
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
  const characterCount = textContent.length;

  return (
    <div className="w-full h-full flex flex-col min-w-0 bg-slate-900/90 text-parchment rounded-xl shadow-2xl overflow-hidden border border-slate-800 backdrop-blur-md">
      {/* Toolbar */}
      <div className="bg-slate-950/80 border-b border-slate-800 p-2 sm:p-2.5 flex items-center gap-1.5 shrink-0 select-none overflow-x-auto custom-scrollbar">
        {/* Headings */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-1 shrink-0">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* Text Styles */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-1 shrink-0">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              editor.isActive('bold')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2.5 py-1 rounded text-xs italic font-serif transition-all ${
              editor.isActive('italic')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`px-2.5 py-1 rounded text-xs line-through transition-all ${
              editor.isActive('strike')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Strikethrough"
          >
            S
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
              editor.isActive('code')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Inline Code"
          >
            {"</>"}
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />

        {/* Lists & Blocks */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-1 shrink-0">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              editor.isActive('bulletList')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Bullet List"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              editor.isActive('orderedList')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Numbered List"
          >
            1. List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              editor.isActive('blockquote')
                ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Quote"
          >
            “ Quote
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title="Horizontal Divider"
          >
            ― Divider
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-1 shrink-0 sm:ml-auto">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 hover:bg-slate-800 transition-all"
            title="Undo"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 hover:bg-slate-800 transition-all"
            title="Redo"
          >
            ↪ Redo
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/60 p-2">
        <EditorContent editor={editor} />
      </div>

      {/* Footer / Stats */}
      <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <div className="flex gap-4">
          <span><strong>{wordCount}</strong> words</span>
          <span><strong>{characterCount}</strong> characters</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400">Live Editor</span>
        </div>
      </div>
    </div>
  );
}
