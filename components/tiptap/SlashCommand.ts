import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SlashMenuList, type SlashMenuItem, type SlashMenuHandle } from "./SlashMenuList";

export type { SlashMenuItem };

export interface SlashCommandOptions {
  items: SlashMenuItem[];
}

function matches(item: SlashMenuItem, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  if (item.label.toLowerCase().includes(q)) return true;
  return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
}

/** "/" 입력 시 블록 삽입 메뉴를 띄우는 Tiptap 확장. 문서용/메모용 호출부가 서로 다른
 * `items` 목록(파일 전체 vs 가벼운 메모용 세트)을 넘겨 재사용한다. */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return { items: [] };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => options.items.filter((item) => matches(item, query)).slice(0, 12),
        command: ({ editor, range, props }) => {
          (props as SlashMenuItem).run({ editor, range });
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle, { items: SlashMenuItem[]; command: (item: SlashMenuItem) => void }> | null = null;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenuList, {
                editor: props.editor,
                props: { items: props.items, command: props.command },
              });
              // z-index must go on this wrapper node, not on anything SlashMenuList renders
              // inside it: this is the element @tiptap/suggestion actually appends to
              // document.body and absolutely-positions via Floating UI, so it's the one that
              // competes in stacking order against things like a sticky note's z-index -- a
              // z-index set on a static-positioned descendant (no `position` of its own) has
              // no effect at all and silently does nothing.
              (component.element as HTMLElement).style.zIndex = "9999";
              // SlashMenuList's colors (var(--panel) etc.) are only defined inside
              // ThemedShell's `[data-theme]` div (see app/globals.css), not on <html>/<body>.
              // Mounted straight onto document.body, this element falls outside that scope, so
              // the variables resolve to nothing and e.g. `background: var(--panel)` computes
              // to transparent -- note text behind the popup bleeds through. Mirror the
              // attribute from the editor's own themed ancestor onto this wrapper so its
              // subtree gets the same custom properties back.
              const themeHost = props.editor.view.dom.closest("[data-theme]");
              if (themeHost) (component.element as HTMLElement).setAttribute("data-theme", themeHost.getAttribute("data-theme")!);
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => {
              component?.updateProps({ items: props.items, command: props.command });
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                unmount?.();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              unmount?.();
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
