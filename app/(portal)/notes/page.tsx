import { pageAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { StickyNoteBoard } from "@/components/StickyNoteBoard";

export default async function NotesPage() {
  const { level } = await pageAccess("notes");

  const notes = await prisma.stickyNote.findMany({ orderBy: { z: "asc" } });

  return (
    <StickyNoteBoard
      canWrite={level === 2}
      notes={notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        color: n.color,
        x: n.x,
        y: n.y,
        z: n.z,
        width: n.width,
        height: n.height,
        collapsed: n.collapsed,
      }))}
    />
  );
}
