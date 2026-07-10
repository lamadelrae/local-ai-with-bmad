"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blobToWavBase64 } from "@/lib/wav-encode";
import { renderPdfToImages } from "@/lib/pdf-render";

const MAX_RECORDING_MS = 30_000; // matches llama.cpp mtmd's audio chunk limit

function ServerStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setOnline(data.online);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    check();
    const interval = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const label =
    online === null ? "Checking model server..." : online ? "Model server online" : "Model server offline";
  const dotColor = online === null ? "bg-muted-foreground" : online ? "bg-green-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <span className={`size-2 rounded-full ${dotColor}`} />
      {label}
    </div>
  );
}

type ConversationSummary = { id: string; title: string | null; updatedAt: string };

function HistoryMenu({
  activeConversationId,
  onSelect,
  onDelete,
  onNew,
}: {
  activeConversationId: string | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onNew: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // Re-fetch the list every time the menu opens (latest titles/order) and
  // again after a delete (so the open menu doesn't show a stale, now-gone
  // entry) — this app has one client, polling isn't worth the churn.
  const refresh = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    const data: { conversations: ConversationSummary[] } = await res.json();
    setConversations(data.conversations);
  }, []);

  return (
    <DropdownMenu onOpenChange={(open) => open && refresh()}>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>History</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onNew}>New conversation</DropdownMenuItem>
        {conversations.length === 0 ? (
          <DropdownMenuItem disabled>No past conversations</DropdownMenuItem>
        ) : (
          conversations.map((c) => (
            <div key={c.id} className="flex items-center gap-1">
              <DropdownMenuItem
                className="flex-1"
                onClick={() => onSelect(c.id)}
                data-active={c.id === activeConversationId || undefined}
              >
                {c.title || "Untitled conversation"}
              </DropdownMenuItem>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete "${c.title || "Untitled conversation"}"`}
                onClick={async (e) => {
                  e.stopPropagation();
                  await onDelete(c.id);
                  refresh();
                }}
              >
                ×
              </Button>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type RecordingState = "idle" | "recording" | "transcribing" | "error";

function MicButton({ onTranscribed }: { onTranscribed: (text: string) => void }) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);

      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const blob = new Blob(chunks, { type: mr.mimeType });
          const wavBase64 = await blobToWavBase64(blob);
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: wavBase64, format: "wav" }),
          });
          if (!res.ok) throw new Error("transcription failed");
          const data: { text: string } = await res.json();
          onTranscribed(data.text);
          setState("idle");
        } catch {
          // AD-5: plain error state, no retry engineering. Manual typing
          // still works — this only affects the mic path.
          setError("Transcription failed — check the model server, or type your message.");
          setState("error");
        }
      };

      mr.start();
      setRecorder(mr);
      setState("recording");
      setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, MAX_RECORDING_MS);
    } catch {
      setError("Couldn't access the microphone — check browser permissions, or type your message.");
      setState("error");
    }
  }, [onTranscribed]);

  const stopRecording = useCallback(() => {
    recorder?.stop();
  }, [recorder]);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={state === "recording" ? "destructive" : "outline"}
        size="icon"
        aria-label={state === "recording" ? "Stop recording" : "Record a voice message"}
        disabled={state === "transcribing"}
        onClick={state === "recording" ? stopRecording : startRecording}
      >
        {state === "recording" ? "■" : state === "transcribing" ? "…" : "🎤"}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}

function PdfAttachItem({ onTruncated }: { onTruncated: (message: string | null) => void }) {
  const attachments = usePromptInputAttachments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file to re-trigger onChange
    if (!file) return;

    setError(null);
    onTruncated(null);
    try {
      const { pages, totalPages, truncated } = await renderPdfToImages(file);
      attachments.add(pages);
      // AC4: visible truncation indicator when the PDF has more than the cap.
      onTruncated(truncated ? `Showing first ${pages.length} of ${totalPages} pages` : null);
    } catch {
      // AD-5: plain error, no retry engineering.
      setError("Couldn't process that PDF — try a different file, or attach an image instead.");
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={handleChange} />
      <DropdownMenuItem onSelect={() => inputRef.current?.click()}>Attach PDF</DropdownMenuItem>
      {error ? <span className="px-2 text-destructive text-xs">{error}</span> : null}
    </>
  );
}

function AttachButton({ onPdfTruncated }: { onPdfTruncated: (message: string | null) => void }) {
  return (
    <PromptInputActionMenu>
      <PromptInputActionMenuTrigger aria-label="Attach an image or PDF" />
      <PromptInputActionMenuContent>
        <PromptInputActionAddAttachments label="Attach image" />
        <PdfAttachItem onTruncated={onPdfTruncated} />
      </PromptInputActionMenuContent>
    </PromptInputActionMenu>
  );
}

function SubmitButton({ status, input }: { status: ReturnType<typeof useChat>["status"]; input: string }) {
  const attachments = usePromptInputAttachments();
  return <PromptInputSubmit status={status} disabled={!input.trim() && attachments.files.length === 0} />;
}

function AttachmentChips() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {attachments.files.map((file) => (
        <div key={file.id} className="relative flex items-center gap-1 rounded-md border bg-muted p-1 text-xs">
          {file.url && file.mediaType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not a Next.js-optimizable remote image
            <img src={file.url} alt={file.filename ?? "attachment"} className="size-8 rounded object-cover" />
          ) : null}
          <span className="max-w-24 truncate">{file.filename}</span>
          <button
            type="button"
            aria-label={`Remove ${file.filename}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => attachments.remove(file.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ChatView({
  conversationId,
  initialMessages,
  onMessageSent,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  onMessageSent: () => void;
}) {
  const { messages, sendMessage, status } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat", body: { conversationId } }),
  });
  const [input, setInput] = useState("");
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text.trim() && message.files.length === 0) return;
    sendMessage({ text: message.text, files: message.files });
    setInput("");
    setPdfNotice(null);
    onMessageSent();
  };

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Say hello to Gemma"
              description="This chat runs entirely on your machine via a local llama.cpp server."
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                      return (
                        // eslint-disable-next-line @next/next/no-img-element -- data:/local attachment, not a Next.js-optimizable remote image
                        <img
                          key={i}
                          src={part.url}
                          alt={part.filename ?? "attachment"}
                          className="mt-2 max-h-64 rounded-md border object-contain"
                        />
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput accept="image/jpeg,image/png" onSubmit={handleSubmit}>
        <PromptInputBody>
          <AttachmentChips />
          {pdfNotice ? <span className="px-1 text-muted-foreground text-xs">{pdfNotice}</span> : null}
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder="Message Gemma..."
          />
        </PromptInputBody>
        <PromptInputFooter>
          <div className="flex items-center gap-2">
            <AttachButton onPdfTruncated={setPdfNotice} />
            <MicButton onTranscribed={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} />
          </div>
          <SubmitButton status={status} input={input} />
        </PromptInputFooter>
      </PromptInput>
    </>
  );
}

export default function Home() {
  // undefined conversationId + empty messages = a "new conversation" the
  // client has an id ready for but hasn't written a CONVERSATION row for yet
  // (that happens on first send, server-side — see /api/chat's POST handler).
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const res = await fetch("/api/chat", { cache: "no-store" });
        const data: { conversationId: string | null; messages: UIMessage[] } = await res.json();
        if (cancelled) return;
        setInitialMessages(data.messages);
        setConversationId(data.conversationId ?? nanoid());
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    const data: { conversationId: string; messages: UIMessage[] } = await res.json();
    setInitialMessages(data.messages);
    setConversationId(data.conversationId);
  }, []);

  const startNewConversation = useCallback(() => {
    setInitialMessages([]);
    setConversationId(nanoid());
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });

      if (id !== conversationId) return;

      // Deleted the active conversation — fall back to the next most recent,
      // or a fresh empty one if none remain (AC 3).
      const res = await fetch("/api/conversations", { cache: "no-store" });
      const data: { conversations: { id: string }[] } = await res.json();
      const next = data.conversations[0];
      if (next) {
        await selectConversation(next.id);
      } else {
        startNewConversation();
      }
    },
    [conversationId, selectConversation, startNewConversation]
  );

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between border-b pb-3">
        <h1 className="font-semibold text-lg">local-gemma-chat</h1>
        <div className="flex items-center gap-3">
          <ServerStatus />
          <HistoryMenu
            activeConversationId={conversationId}
            onSelect={selectConversation}
            onDelete={deleteConversation}
            onNew={startNewConversation}
          />
        </div>
      </header>

      {!historyLoaded || !conversationId ? null : (
        <ChatView
          key={conversationId}
          conversationId={conversationId}
          initialMessages={initialMessages}
          onMessageSent={() => {
            // no-op hook for the history menu to eventually react to (e.g.
            // re-sort); the menu already re-fetches on open, which is enough
            // for this app's scale.
          }}
        />
      )}
    </div>
  );
}
