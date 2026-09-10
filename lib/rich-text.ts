/** Returns true if Tiptap-produced HTML has no visible content (e.g. "<p></p>"). Kept in a
 * plain shared module (no "use client"/"use server") since it's imported from both a client
 * component (RichTextEditor) and a "use server" actions file. */
export function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === "";
}
