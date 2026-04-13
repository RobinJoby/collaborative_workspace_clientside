"use client";

/**
 * EditorToolbar
 * Props:
 *   editor – the Tiptap editor instance returned by useEditor()
 */
export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  const btn = (isActive, onClick, title, children) => (
    <button
      key={title}
      onMouseDown={(e) => {
        // Use mousedown to avoid losing editor focus
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={[
        "inline-flex items-center justify-center rounded px-2.5 py-1 text-sm font-medium transition-colors",
        isActive
          ? "bg-gray-200 text-gray-900"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      ].join(" ")}
    >
      {children}
    </button>
  );

  const tools = [
    {
      title: "Bold",
      isActive: editor.isActive("bold"),
      onClick: () => editor.chain().focus().toggleBold().run(),
      label: <strong>B</strong>,
    },
    {
      title: "Italic",
      isActive: editor.isActive("italic"),
      onClick: () => editor.chain().focus().toggleItalic().run(),
      label: <em>I</em>,
    },
    {
      title: "Strikethrough",
      isActive: editor.isActive("strike"),
      onClick: () => editor.chain().focus().toggleStrike().run(),
      label: <s>S</s>,
    },
    {
      title: "Inline Code",
      isActive: editor.isActive("code"),
      onClick: () => editor.chain().focus().toggleCode().run(),
      label: <code className="font-mono text-xs">{"<>"}</code>,
    },
    {
      title: "Heading 1",
      isActive: editor.isActive("heading", { level: 1 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      label: "H1",
    },
    {
      title: "Heading 2",
      isActive: editor.isActive("heading", { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      label: "H2",
    },
    {
      title: "Bullet List",
      isActive: editor.isActive("bulletList"),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      label: "• List",
    },
  ];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white/80 px-4 py-2 backdrop-blur">
      {tools.map(({ title, isActive, onClick, label }) =>
        btn(isActive, onClick, title, label)
      )}
    </div>
  );
}
