"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { yCursorPlugin } from "@tiptap/y-tiptap";
import { io } from "socket.io-client";
import EditorToolbar from "../../../components/EditorToolbar";

// ─── Helpers ────────────────────────────────────────────────────────────────
const COLORS = [
  "#E03E3E", "#D9730D", "#DFAB01", "#0F7B6C",
  "#0B6E99", "#6940A5", "#AD1A72", "#4D5461",
];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const randomName = () => `Guest ${Math.floor(Math.random() * 900 + 100)}`;

const AwarenessCursor = Extension.create({
  name: "awarenessCursor",
  addOptions() {
    return {
      awareness: null,
    };
  },
  addProseMirrorPlugins() {
    if (!this.options.awareness) {
      return [];
    }

    return [yCursorPlugin(this.options.awareness)];
  },
});

// ─── Component ──────────────────────────────────────────────────────────────
export default function DocumentPage() {
  const params = useParams();
  const docId = params?.id ?? "default";

  // Yjs
  const ydoc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(
    () => new awarenessProtocol.Awareness(ydoc),
    [ydoc]
  );

  // Local user identity (stable across re-renders)
  const localUser = useMemo(
    () => ({ name: randomName(), color: randomColor() }),
    []
  );

  // State
  const [users, setUsers] = useState([]);
  const [syncStatus, setSyncStatus] = useState("Connecting…");
  const socketRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isLoaded = useRef(false); // avoid spurious saves before initial load

  // ─── Tiptap editor ──────────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      AwarenessCursor.configure({
        awareness,
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none p-10 min-h-[700px] focus:outline-none",
      },
    },
  });

  // ─── Socket + Yjs bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    const socket = io(
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001",
      { transports: ["websocket"] }
    );
    socketRef.current = socket;

    // Set local awareness state
    awareness.setLocalStateField("user", localUser);

    // ── Sync users list from awareness ──────────────────────────────────
    const syncUsers = () => {
      const active = Array.from(awareness.getStates().values())
        .map((s) => s.user)
        .filter((u) => u?.name && u?.color);
      setUsers(active);
    };

    // ── Awareness: broadcast + sync ───────────────────────────────────
    const handleAwarenessUpdate = ({ added, updated, removed }) => {
      syncUsers();
      const changedClients = [...added, ...updated, ...removed];
      const encoded = awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        changedClients
      );
      socket.emit("send-awareness", {
        docId,
        update: Array.from(encoded),
      });
    };
    awareness.on("update", handleAwarenessUpdate);

    // ── Yjs: send changes + debounced save ────────────────────────────
    const handleYUpdate = (update, origin) => {
      if (origin === "socket-sync" || !isLoaded.current) return;

      socket.emit("send-changes", {
        docId,
        content: Array.from(update),
      });

      // Debounced save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSyncStatus("Saving…");
      saveTimerRef.current = setTimeout(() => {
        const state = Y.encodeStateAsUpdate(ydoc);
        socket.emit("save-document", {
          docId,
          state: Array.from(state),
        });
        setSyncStatus("Saved ☁️");
      }, 2000);
    };
    ydoc.on("update", handleYUpdate);

    // ── Socket event handlers ─────────────────────────────────────────
    const handleConnect = () => {
      setSyncStatus("Connecting…");
      socket.emit("join-document", docId);
      socket.emit("load-document", docId);
    };

    const handleDocumentLoaded = (stateData) => {
      if (stateData) {
        const update =
          stateData instanceof Uint8Array
            ? stateData
            : new Uint8Array(
              stateData?.data ?? stateData?.buffer ?? stateData
            );
        Y.applyUpdate(ydoc, update, "socket-sync");
      }
      isLoaded.current = true;
      setSyncStatus("Saved ☁️");
    };

    const handleReceiveChanges = (content) => {
      const update =
        content instanceof Uint8Array ? content : new Uint8Array(content);
      Y.applyUpdate(ydoc, update, "socket-sync");
    };

    const handleReceiveAwareness = (updateArray) => {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        new Uint8Array(updateArray),
        socket
      );
    };

    socket.on("connect", handleConnect);
    socket.on("document-loaded", handleDocumentLoaded);
    socket.on("receive-changes", handleReceiveChanges);
    socket.on("receive-awareness", handleReceiveAwareness);

    // Fire join/load immediately if already connected
    if (socket.connected) {
      handleConnect();
    }

    syncUsers();

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      awareness.off("update", handleAwarenessUpdate);
      ydoc.off("update", handleYUpdate);
      socket.off("connect", handleConnect);
      socket.off("document-loaded", handleDocumentLoaded);
      socket.off("receive-changes", handleReceiveChanges);
      socket.off("receive-awareness", handleReceiveAwareness);
      socket.disconnect();
    };
  }, [docId, ydoc, awareness, localUser]);

  // ─── Sync-status pill colours ────────────────────────────────────────────
  const pillColor =
    syncStatus === "Saved ☁️"
      ? "bg-emerald-100 text-emerald-700"
      : syncStatus === "Saving…"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-500";

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center pb-20">
      {/* ── Top navigation bar ── */}
      <header className="w-full border-b border-gray-200 bg-white/70 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            {/* Notion-style page icon */}
            <span className="text-xl">📄</span>
            <span className="text-sm font-medium text-gray-700 font-mono truncate max-w-[220px]">
              {docId}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${pillColor}`}
          >
            {syncStatus}
          </span>
        </div>
      </header>

      {/* ── Document "paper" container ── */}
      <div className="bg-white max-w-4xl w-full mt-10 mx-4 shadow-sm border border-gray-200 rounded-lg min-h-[800px] overflow-hidden">
        {/* Formatting toolbar */}
        <EditorToolbar editor={editor} />

        {/* Active-user pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-2.5 min-h-[44px]">
          {users.length > 0 ? (
            users.map((user, i) => (
              <span
                key={`${user.name}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
                style={{ backgroundColor: user.color }}
              >
                <svg
                  className="h-2 w-2 fill-current opacity-80"
                  viewBox="0 0 8 8"
                >
                  <circle cx="4" cy="4" r="4" />
                </svg>
                {user.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400">No collaborators yet</span>
          )}
        </div>

        {/* Tiptap editor */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
