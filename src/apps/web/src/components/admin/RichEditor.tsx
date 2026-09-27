"use client"

import React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect, useCallback, useRef } from "react"
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading2, Heading3, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Link2, ImageIcon, Minus, RotateCcw, RotateCw,
  Code, Code2, Quote, Loader2,
} from "lucide-react"

interface Props {
  content?: string
  onChange?: (html: string) => void
  onImageUpload?: (url: string) => void   // callback khi upload ảnh thành công (dùng cho cover auto-fill)
  placeholder?: string
  minHeight?: number
}

export default function RichEditor({ content = "", onChange, onImageUpload, placeholder = "Bắt đầu viết...", minHeight = 400 }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [imgUploading, setImgUploading] = React.useState(false)
  const [htmlMode, setHtmlMode] = React.useState(false)
  const [htmlValue, setHtmlValue] = React.useState("")
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded my-4" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none focus:outline-none px-5 py-4" },
    },
  })

  // Sync nội dung từ ngoài (AI generate)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const current = editor.getHTML()
    if (content && content !== current) {
      editor.commands.setContent(content)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const toggleHtmlMode = useCallback(() => {
    if (!editor) return
    if (!htmlMode) {
      // Entering HTML mode — snapshot current HTML into textarea
      setHtmlValue(editor.getHTML())
    } else {
      // Leaving HTML mode — push textarea content back into editor
      editor.commands.setContent(htmlValue)
      onChange?.(htmlValue)
    }
    setHtmlMode((v) => !v)
  }, [editor, htmlMode, htmlValue, onChange])

  const addLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL:", prev ?? "https://")
    if (url === null) return
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  const handleImageFile = useCallback(async (file: File) => {
    if (!editor) return
    setImgUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      editor.chain().focus().setImage({ src: data.url }).run()
      onImageUpload?.(data.url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setImgUploading(false)
    }
  }, [editor, onImageUpload])

  const addImage = useCallback(() => {
    imageInputRef.current?.click()
  }, [])

  if (!editor) return null

  const ToolBtn = ({
    active, disabled = false, onClick, title, children,
  }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
          <Code className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider" active={false}>
          <Minus className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
          <AlignRight className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolBtn active={editor.isActive("link")} onClick={addLink} title="Link">
          <Link2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={false} onClick={addImage} title="Upload ảnh" disabled={imgUploading}>
          {imgUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolBtn active={false} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <RotateCcw className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={false} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <RotateCw className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolBtn active={htmlMode} onClick={toggleHtmlMode} title="Xem / chỉnh sửa HTML nguồn">
          <Code2 className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="ml-auto text-xs text-muted-foreground px-1 tabular-nums">
          {editor.storage.characterCount?.characters?.() ?? ""}
        </div>
      </div>

      {/* Editor area */}
      {htmlMode ? (
        <textarea
          value={htmlValue}
          onChange={(e) => {
            setHtmlValue(e.target.value)
            onChange?.(e.target.value)
          }}
          spellCheck={false}
          className="w-full font-mono text-xs p-4 bg-muted/20 text-foreground resize-none focus:outline-none"
          style={{ minHeight }}
        />
      ) : (
        <div style={{ minHeight }} className="overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
