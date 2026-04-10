"use client";

import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { yCursorPlugin } from "@tiptap/y-tiptap";
import { useSocket } from "../hooks/useSocket";

const DOC_ID = "test-document-101";

type PresenceUser = { name: string; color: string };

const AwarenessCursor = Extension.create<{
  awareness: awarenessProtocol.Awareness | null;
}>({
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

function CollaborativeWorkspace() {
  const socket = useSocket();
  const ydoc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new awarenessProtocol.Awareness(ydoc), [ydoc]);
  const [users, setUsers] = useState<PresenceUser[]>([]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      AwarenessCursor.configure({
        awareness,
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[60vh] p-8 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    const randomName = `Guest ${Math.floor(Math.random() * 900 + 100)}`;
    const randomColor = `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`;

    awareness.setLocalStateField("user", {
      name: randomName,
      color: randomColor,
    });

    const randomUser: PresenceUser = { name: randomName, color: randomColor };

    const syncUsers = () => {
      const activeUsers = Array.from(awareness.getStates().values())
        .map((state) => state.user)
        .filter(
          (user): user is { name: string; color: string } =>
            Boolean(user?.name && user?.color)
        );

      setUsers(activeUsers);
    };

    syncUsers();

    const handleAwarenessUpdate = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      syncUsers();

      if (!socket || origin === socket) {
        return;
      }

      const changedClients = [...added, ...updated, ...removed];
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        changedClients
      );

      socket.emit("send-awareness", {
        docId: DOC_ID,
        update: Array.from(encodedUpdate),
      });
    };

    awareness.on("update", handleAwarenessUpdate);

    return () => {
      awareness.off("update", handleAwarenessUpdate);
    };
  }, [awareness, editor, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "socket-sync") {
        return;
      }

      socket.emit("send-changes", {
        docId: DOC_ID,
        content: update,
      });
    };

    const handleReceiveChanges = (update: ArrayBuffer | number[] | Uint8Array) => {
      const normalizedUpdate =
        update instanceof Uint8Array ? update : new Uint8Array(update);

      Y.applyUpdate(ydoc, normalizedUpdate, "socket-sync");
    };

    const handleReceiveAwareness = (updateArray: number[]) => {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        new Uint8Array(updateArray),
        socket
      );
    };

    const joinDocument = () => {
      socket.emit("join-document", DOC_ID);
    };

    if (socket.connected) {
      joinDocument();
    }

    ydoc.on("update", handleDocUpdate);
    socket.on("connect", joinDocument);
    socket.on("receive-changes", handleReceiveChanges);
    socket.on("receive-awareness", handleReceiveAwareness);

    return () => {
      ydoc.off("update", handleDocUpdate);
      socket.off("connect", joinDocument);
      socket.off("receive-changes", handleReceiveChanges);
      socket.off("receive-awareness", handleReceiveAwareness);
    };
  }, [awareness, socket, ydoc]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Real-Time Collaborative Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Collaborative Document
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Room: {DOC_ID} • {socket?.connected ? "Connected" : "Connecting..."}
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-6 py-3 text-sm text-slate-600">
            Shared editor
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3">
            {users.length > 0 ? (
              users.map((user, index) => (
                <span
                  key={`${user.name}-${index}`}
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  Active User: {user.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No active users yet</span>
            )}
          </div>
          <div className="min-h-[65vh]">
            <EditorContent editor={editor} />
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <main className="min-h-screen bg-slate-100 px-4 py-10" />;
  }

  return <CollaborativeWorkspace />;
}
