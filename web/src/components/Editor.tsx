'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export default function Editor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    immediatelyRender: false,
    content: `
      <h1>Gaea-Forge</h1>
      <p>Welcome to your Local-First, Open-Source World-Building Platform.</p>
      <p>Start writing your lore here...</p>
    `,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[60vh] p-8',
      },
    },
  });

  return (
    <div className="w-full h-full bg-slate-900 text-parchment rounded-xl shadow-inner overflow-hidden border border-slate-700/50">
      <div className="bg-slate-800 border-b border-slate-700 p-3 flex gap-2">
        <button 
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${editor?.isActive('bold') ? 'bg-gold text-slate-900' : 'bg-slate-700 text-parchment hover:bg-slate-600'}`}
        >
          B
        </button>
        <button 
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-3 py-1 rounded text-sm italic transition-colors ${editor?.isActive('italic') ? 'bg-gold text-slate-900' : 'bg-slate-700 text-parchment hover:bg-slate-600'}`}
        >
          I
        </button>
        <button 
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${editor?.isActive('heading', { level: 1 }) ? 'bg-gold text-slate-900' : 'bg-slate-700 text-parchment hover:bg-slate-600'}`}
        >
          H1
        </button>
        <button 
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-gold text-slate-900' : 'bg-slate-700 text-parchment hover:bg-slate-600'}`}
        >
          H2
        </button>
      </div>
      <div className="overflow-y-auto h-[calc(100%-3rem)] custom-scrollbar">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
