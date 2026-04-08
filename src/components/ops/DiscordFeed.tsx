import { useState, useEffect, useRef } from "react";

const EDGE_URL =
  "https://tsdcxvmywimqfpdkevdx.supabase.co/functions/v1/discord-messages";
// Publishable anon key — safe to include in client bundle
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZGN4dm15d2ltcWZwZGtldmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODc0MDcsImV4cCI6MjA5MTA2MzQwN30.UXYnT3R2R28JicoAjRnhHMKsUvpgkqYICJRM0jsLCmg";
const POLL_INTERVAL = 15_000;

interface Attachment {
  url: string;
  contentType?: string;
  filename: string;
}

interface Reaction {
  count: number;
  emoji: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  author: string;
  avatarUrl: string | null;
  attachments: Attachment[];
  reactions: Reaction[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isImageUrl(url: string, contentType?: string): boolean {
  if (contentType) return contentType.startsWith("image/");
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

function Avatar({ author, avatarUrl }: { author: string; avatarUrl: string | null }) {
  const initials = author.slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={author}
        width={28}
        height={28}
        style={{ borderRadius: "50%", flexShrink: 0, display: "block" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", backgroundColor: "#5865F2",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontFamily: "'DM Mono', monospace",
      fontSize: "10px", color: "#fff", fontWeight: 500,
    }}>
      {initials}
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return (
    <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "hsl(var(--foreground))", opacity: 0.85, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: "#5865F2", textDecoration: "underline", textDecorationColor: "rgba(88,101,242,0.4)" }}>
            {part}
          </a>
        ) : part
      )}
    </p>
  );
}

function AttachmentBlock({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
      {attachments.map((a, i) =>
        isImageUrl(a.url, a.contentType) ? (
          <img key={i} src={a.url} alt={a.filename}
            style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain", display: "block", border: "1px solid hsl(var(--surface-border))" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#5865F2", textDecoration: "underline", letterSpacing: "0.04em" }}>
            {a.filename}
          </a>
        )
      )}
    </div>
  );
}

function ReactionsBlock({ reactions }: { reactions: Reaction[] }) {
  if (!reactions?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
      {reactions.map((r, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: "3px",
          padding: "1px 6px",
          backgroundColor: "hsl(var(--surface-raised))",
          border: "1px solid hsl(var(--surface-border))",
          fontFamily: "'DM Sans', sans-serif", fontSize: "11px",
          color: "hsl(var(--foreground))",
        }}>
          {r.emoji.startsWith("http") ? (
            <img src={r.emoji} alt="emoji" width={14} height={14} style={{ display: "inline-block" }} />
          ) : (
            <span>{r.emoji}</span>
          )}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", opacity: 0.7 }}>{r.count}</span>
        </span>
      ))}
    </div>
  );
}

export function DiscordFeed() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevIdRef = useRef<string | null>(null);
  const hasFetchedRef = useRef(false);

  async function fetchMessages(quiet = false) {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${EDGE_URL}?limit=50`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { messages: Message[] } = await res.json();
      const msgs = data.messages ?? [];
      if (msgs.length > 0) {
        const latestId = msgs[msgs.length - 1].id;
        if (prevIdRef.current && latestId !== prevIdRef.current && !open) {
          setNewCount((n) => n + 1);
        }
        prevIdRef.current = latestId;
      }
      setMessages(msgs);
    } catch {
      setError("Could not load messages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchMessages();
    }
    const id = setInterval(() => fetchMessages(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) {
      setNewCount(0);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 60);
    }
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, open]);

  return (
    <>
      {/* Sliding panel */}
      <div style={{
        position: "fixed",
        top: "56px", right: 0, bottom: 0,
        width: "360px",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "hsl(var(--surface))",
        borderLeft: "1px solid hsl(var(--surface-border))",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: open ? "-4px 0 24px rgba(10,20,40,0.18)" : "none",
      }}>
        {/* Header */}
        <div style={{
          height: "44px", flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid hsl(var(--surface-border))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "inline-block", width: "8px", height: "8px",
              borderRadius: "50%", backgroundColor: "#5865F2", flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: "10px",
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "hsl(var(--muted-foreground))",
            }}>#general — Live</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => fetchMessages()} aria-label="Refresh" style={{
              width: "28px", height: "28px", display: "flex", alignItems: "center",
              justifyContent: "center", color: "hsl(var(--muted-foreground))",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.05-3.41L10 6h5V1l-1.35 1.35z" fill="currentColor" />
              </svg>
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close Discord feed" style={{
              width: "28px", height: "28px", display: "flex", alignItems: "center",
              justifyContent: "center", color: "hsl(var(--muted-foreground))",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
              </svg>
            </button>
          </div>
        </div>

        {/* Feed */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: "12px 0",
          display: "flex", flexDirection: "column", gap: "2px",
        }}>
          {loading && messages.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em" }}>Loading…</div>
          )}
          {error && (
            <div style={{ margin: "16px", padding: "10px 12px", backgroundColor: "rgba(220,38,38,0.08)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "hsl(var(--destructive))" }}>{error}</div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "hsl(var(--muted-foreground))", opacity: 0.6, letterSpacing: "0.08em" }}>No messages yet</div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: "10px", padding: "6px 16px", alignItems: "flex-start" }}>
              <Avatar author={msg.author} avatarUrl={msg.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "2px" }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", whiteSpace: "nowrap" }}>{msg.author}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))", opacity: 0.7, letterSpacing: "0.06em", flexShrink: 0 }}>{formatTime(msg.timestamp)}</span>
                </div>
                <MessageContent content={msg.content} />
                <AttachmentBlock attachments={msg.attachments} />
                <ReactionsBlock reactions={msg.reactions} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bubble — hidden when panel is open */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Discord feed"
          style={{
            position: "fixed",
            bottom: "24px", right: "24px",
            zIndex: 201,
            width: "44px", height: "44px",
            borderRadius: "0px",
            backgroundColor: "#1B3C6E",
            border: "1px solid rgba(248,246,241,0.3)",
            boxShadow: "0 2px 12px rgba(27,60,110,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.053a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#F8F6F1" />
          </svg>
          {newCount > 0 && (
            <span style={{
              position: "absolute", top: "-5px", right: "-5px",
              minWidth: "17px", height: "17px", padding: "0 3px",
              borderRadius: "0px", backgroundColor: "#C4622D",
              border: "2px solid #F8F6F1",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Mono', monospace", fontSize: "8px",
              color: "#F8F6F1", fontWeight: 700, lineHeight: 1, boxSizing: "border-box",
            }}>
              {newCount > 9 ? "9+" : newCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
