import { InputRule, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { createTitleResolver, LORE_LINK_ATTR } from '@/lib/links';
import LinkSuggestionList, { LinkSuggestionItem, LinkSuggestionListHandle } from './LinkSuggestionList';

export type LinkTarget = { id: string; title: string; category: string };

export type LoreLinkOptions = {
  // Read on every use, so callers can pass a function over live state
  getTargets: () => LinkTarget[];
  // Create an article for an unknown title and return its id
  onCreate: ((title: string) => string) | null;
};

const MAX_SUGGESTIONS = 8;
export const loreLinkRefreshKey = new PluginKey('loreLinkMissing');

function suggestionItems(targets: LinkTarget[], query: string, canCreate: boolean): LinkSuggestionItem[] {
  const q = query.trim().toLowerCase();
  const matches = targets
    .filter((t) => t.title.toLowerCase().includes(q))
    // Titles starting with the query first, then alphabetical
    .sort(
      (a, b) =>
        Number(!a.title.toLowerCase().startsWith(q)) - Number(!b.title.toLowerCase().startsWith(q)) ||
        a.title.localeCompare(b.title)
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((t): LinkSuggestionItem => ({ kind: 'article', ...t }));

  const exact = targets.some((t) => t.title.trim().toLowerCase() === q);
  if (canCreate && q && !exact) matches.push({ kind: 'create', title: query.trim() });
  return matches;
}

function placePopup(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  el.style.position = 'fixed';
  el.style.zIndex = '70';
  el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
  el.style.top = `${rect.bottom + 6}px`;
}

// An inline link to another article. Stored as <a data-lore-link="id">label</a>.
export const LoreLink = Mark.create<LoreLinkOptions>({
  name: 'loreLink',
  // Parse before StarterKit's generic Link mark, which also matches <a>
  priority: 1001,
  inclusive: false,

  addOptions() {
    return { getTargets: () => [], onCreate: null };
  },

  addAttributes() {
    return {
      articleId: {
        default: null,
        parseHTML: (el) => el.getAttribute(LORE_LINK_ATTR),
        renderHTML: (attrs) => ({ [LORE_LINK_ATTR]: attrs.articleId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `a[${LORE_LINK_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes({ class: 'lore-link' }, HTMLAttributes), 0];
  },

  // Typing a complete [[Title]] or [[Title|label]] links it if the title exists
  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]$/,
        handler: ({ state, range, match }) => {
          const id = createTitleResolver(this.options.getTargets())(match[1]);
          if (!id) return null;
          const label = (match[2] ?? match[1]).trim();
          state.tr.replaceWith(range.from, range.to, state.schema.text(label, [this.type.create({ articleId: id })]));
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const markType = this.type;

    return [
      Suggestion<LinkSuggestionItem, LinkSuggestionItem>({
        editor: this.editor,
        pluginKey: new PluginKey('loreLinkSuggestion'),
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        items: ({ query }) => suggestionItems(options.getTargets(), query, !!options.onCreate),
        command: ({ editor, range, props: item }) => {
          const id = item.kind === 'article' ? item.id : options.onCreate?.(item.title);
          if (!id) return;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'text', text: item.title, marks: [{ type: markType.name, attrs: { articleId: id } }] },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
        render: () => {
          let renderer: ReactRenderer<LinkSuggestionListHandle> | null = null;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(LinkSuggestionList, { props, editor: props.editor });
              document.body.appendChild(renderer.element);
              placePopup(renderer.element, props.clientRect?.());
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              if (renderer) placePopup(renderer.element, props.clientRect?.());
            },
            // Escape is handled by the suggestion plugin, which then calls onExit
            onKeyDown: ({ event }) => renderer?.ref?.onKeyDown(event) ?? false,
            onExit: () => {
              renderer?.element.remove();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),

      // Mark links whose article no longer exists
      new Plugin({
        key: loreLinkRefreshKey,
        props: {
          decorations: (state) => {
            const existing = new Set(options.getTargets().map((t) => t.id));
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText) return;
              const mark = node.marks.find((m) => m.type === markType);
              if (mark && !existing.has(mark.attrs.articleId)) {
                decorations.push(
                  Decoration.inline(pos, pos + node.nodeSize, {
                    class: 'lore-link-missing',
                    title: 'This article was deleted',
                  })
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
