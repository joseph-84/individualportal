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
