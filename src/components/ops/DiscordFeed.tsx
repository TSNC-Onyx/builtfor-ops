import { useState, useEffect, useRef } from "react";

const EDGE_URL = "https://tsdcxvmywimqfpdkevdx.supabase.co/functions/v1/discord-messages";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZGN4dm15d2ltcWZwZGtldmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODc0MDcsImV4cCI6MjA5MTA2MzQwN30.UXYnT3R2R28JicoAjRnhHMKsUvpgkqYICJRM0jsLCmg";
const POLL_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Attachment { url: string; proxyUrl: string; contentType: string | null; filename: string; width: number | null; height: number | null; size?: number | null; }
interface EmbedField { name: string; value: string; inline: boolean; }
interface Embed { type: string; url: string | null; title: string | null; description: string | null; color: number | null; image: { url: string } | null; thumbnail: { url: string } | null; video: { url: string } | null; author: { name: string; url: string | null } | null; footer: { text: string } | null; fields: EmbedField[]; }
interface Sticker { id: string; name: string; formatType: number; url: string | null; }
interface ReplyTo { id: string; author: string; content: string; }
interface Reaction { count: number; emoji: { id: string | null; name: string; url: string | null }; }
interface Message { id: string; type: number; content: string; timestamp: string; editedTimestamp: string | null; author: string; authorId: string | null; avatarUrl: string | null; attachments: Attachment[]; embeds: Embed[]; stickers: Sticker[]; replyTo: ReplyTo | null; reactions: Reaction[]; pinned: boolean; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  const d = new Date(iso), today = new Date(), yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function isSameDay(a: string, b: string) { return new Date(a).toDateString() === new Date(b).toDateString(); }

// Parse Discord markdown to React nodes — sequential token matching, no global-flag regex
function parseMarkdown(raw: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let s = raw, k = 0;
  while (s.length > 0) {
    if (s.startsWith("**")) { const end = s.indexOf("**", 2); if (end > 2) { out.push(<strong key={k++}>{s.slice(2, end)}</strong>); s = s.slice(end + 2); continue; } }
    if (s.startsWith("__")) { const end = s.indexOf("__", 2); if (end > 2) { out.push(<u key={k++}>{s.slice(2, end)}</u>); s = s.slice(end + 2); continue; } }
    if (s.startsWith("~~")) { const end = s.indexOf("~~", 2); if (end > 2) { out.push(<s key={k++}>{s.slice(2, end)}</s>); s = s.slice(end + 2); continue; } }
    if (s.startsWith("||")) { const end = s.indexOf("||", 2); if (end > 2) { const txt = s.slice(2, end); out.push(<SpoilerSpan key={k++} text={txt} />); s = s.slice(end + 2); continue; } }
    if (s.startsWith("```")) { const end = s.indexOf("```", 3); if (end > 3) { const inner = s.slice(3, end).replace(/^\w+\n/, ""); out.push(<code key={k++} style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: "11px", backgroundColor: "rgba(0,0,0,0.25)", padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "2px 0" }}>{inner.trim()}</code>); s = s.slice(end + 3); continue; } }
    if (s.startsWith("`")) { const end = s.indexOf("`", 1); if (end > 1) { out.push(<code key={k++} style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", backgroundColor: "rgba(88,101,242,0.12)", padding: "1px 4px", borderRadius: "2px" }}>{s.slice(1, end)}</code>); s = s.slice(end + 1); continue; } }
    if (s.startsWith("*")) { const end = s.indexOf("*", 1); if (end > 1) { out.push(<em key={k++}>{s.slice(1, end)}</em>); s = s.slice(end + 1); continue; } }
    if (s.startsWith("_")) { const end = s.indexOf("_", 1); if (end > 1) { out.push(<em key={k++}>{s.slice(1, end)}</em>); s = s.slice(end + 1); continue; } }
    // Custom emoji <:name:id> or <a:name:id>
    const cemo = s.match(/^<a?:(\w+):(\d+)>/);
    if (cemo) { const anim = s.startsWith("<a:"); out.push(<img key={k++} src={`https://cdn.discordapp.com/emojis/${cemo[2]}.${anim ? "gif" : "png"}?size=24`} alt={`:${cemo[1]}:`} style={{ width: 20, height: 20, verticalAlign: "middle", display: "inline" }} />); s = s.slice(cemo[0].length); continue; }
    // Mention
    const ment = s.match(/^<[@#][!&]?\d+>/);
    if (ment) { out.push(<span key={k++} style={{ backgroundColor: "rgba(88,101,242,0.2)", color: "#8ea1e1", padding: "0 2px", borderRadius: "2px" }}>{ment[0].startsWith("<#") ? "#channel" : "@user"}</span>); s = s.slice(ment[0].length); continue; }
    // URL
    const urlM = s.match(/^https?:\/\/[^\s<>"]+/);
    if (urlM) { out.push(<a key={k++} href={urlM[0]} target="_blank" rel="noopener noreferrer" style={{ color: "#5865F2", textDecoration: "underline", wordBreak: "break-all" }}>{urlM[0]}</a>); s = s.slice(urlM[0].length); continue; }
    // Blockquote
    if (s.startsWith("> ")) { const nl = s.indexOf("\n"); const line = nl === -1 ? s.slice(2) : s.slice(2, nl); out.push(<div key={k++} style={{ borderLeft: "3px solid rgba(255,255,255,0.18)", paddingLeft: "8px", opacity: 0.8, marginBottom: "1px" }}>{line}</div>); s = nl === -1 ? "" : s.slice(nl); continue; }
    // Consume plain text up to next potential token
    const plain = s.match(/^[^*_~|`<>h]+/) ?? [s[0]];
    out.push(<span key={k++}>{plain[0]}</span>);
    s = s.slice(plain[0].length);
  }
  return out;
}

function SpoilerSpan({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  return <span onClick={() => setShown(true)} title="Click to reveal" style={{ backgroundColor: shown ? "transparent" : "rgba(0,0,0,0.4)", color: shown ? "inherit" : "transparent", cursor: "pointer", padding: "0 2px", userSelect: "none", borderRadius: "2px" }}>{text}</span>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ author, avatarUrl }: { author: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) return <img src={avatarUrl} alt={author} width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0, display: "block", objectFit: "cover" }} onError={() => setFailed(true)} />;
  return <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#5865F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#fff", fontWeight: 600 }}>{author.slice(0, 2).toUpperCase()}</div>;
}

// ─── Reply banner ─────────────────────────────────────────────────────────────
function ReplyBanner({ reply }: { reply: ReplyTo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", paddingLeft: "4px", borderLeft: "2px solid hsl(var(--muted-foreground))", opacity: 0.55 }}>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground))", whiteSpace: "nowrap" }}>↩ {reply.author}</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reply.content || "[attachment]"}</span>
    </div>
  );
}

// ─── Attachments ──────────────────────────────────────────────────────────────
function AttachmentsBlock({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
      {attachments.map((a, i) => {
        const img = a.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url);
        const vid = a.contentType?.startsWith("video/");
        if (img) return <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.proxyUrl || a.url} alt={a.filename} style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "contain", display: "block", border: "1px solid hsl(var(--surface-border))" }} /></a>;
        if (vid) return <video key={i} src={a.url} controls style={{ maxWidth: "100%", maxHeight: "200px", display: "block" }} />;
        return <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))", textDecoration: "none" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#5865F2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.filename}</span>{a.size ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))" }}>({Math.round(a.size / 1024)}KB)</span> : null}</a>;
      })}
    </div>
  );
}

// ─── Embeds ───────────────────────────────────────────────────────────────────
function EmbedsBlock({ embeds }: { embeds: Embed[] }) {
  if (!embeds.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
      {embeds.map((e, i) => {
        if (e.type === "gifv") {
          return e.video?.url ? <video key={i} src={e.video.url} autoPlay loop muted playsInline style={{ maxWidth: "100%", maxHeight: "240px", display: "block" }} /> : null;
        }
        if (e.type === "image") {
          const src = e.image?.url ?? e.thumbnail?.url;
          return src ? <a key={i} href={e.url ?? src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "contain", display: "block" }} /></a> : null;
        }
        const accent = e.color ? `#${e.color.toString(16).padStart(6, "0")}` : "#5865F2";
        return (
          <div key={i} style={{ borderLeft: `3px solid ${accent}`, backgroundColor: "hsl(var(--surface-raised))", padding: "8px 10px", display: "flex", flexDirection: "column", gap: "3px" }}>
            {e.author && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{e.author.url ? <a href={e.author.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{e.author.name}</a> : e.author.name}</div>}
            {e.title && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "13px", fontWeight: 700, color: "hsl(var(--foreground))" }}>{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: "#5865F2", textDecoration: "none" }}>{e.title}</a> : e.title}</div>}
            {e.description && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "hsl(var(--foreground))", opacity: 0.8, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{e.description.slice(0, 300)}{e.description.length > 300 ? "…" : ""}</div>}
            {e.fields.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "2px" }}>{e.fields.map((f, fi) => <div key={fi} style={{ gridColumn: f.inline ? undefined : "1 / -1" }}><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", marginBottom: "1px" }}>{f.name}</div><div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "hsl(var(--foreground))" }}>{f.value}</div></div>)}</div>}
            {e.image && <img src={e.image.url} alt="" style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain", marginTop: "2px" }} onError={(x) => { (x.currentTarget as HTMLImageElement).style.display = "none"; }} />}
            {!e.image && e.thumbnail && <img src={e.thumbnail.url} alt="" style={{ maxWidth: "80px", maxHeight: "80px", objectFit: "contain", alignSelf: "flex-end" }} />}
            {e.footer && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>{e.footer.text}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stickers ─────────────────────────────────────────────────────────────────
function StickersBlock({ stickers }: { stickers: Sticker[] }) {
  if (!stickers.length) return null;
  return <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>{stickers.map((s) => s.url ? <img key={s.id} src={s.url} alt={s.name} title={s.name} style={{ width: 80, height: 80, objectFit: "contain" }} /> : <span key={s.id} style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>[{s.name}]</span>)}</div>;
}

// ─── Reactions ────────────────────────────────────────────────────────────────
function ReactionsBlock({ reactions }: { reactions: Reaction[] }) {
  if (!reactions.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px" }}>
      {reactions.map((r, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
          {r.emoji.url ? <img src={r.emoji.url} alt={r.emoji.name} width={14} height={14} /> : <span style={{ fontSize: "13px", lineHeight: 1 }}>{r.emoji.name}</span>}
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>{r.count}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Date divider ─────────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", margin: "4px 0" }}>
      <div style={{ flex: 1, height: "1px", backgroundColor: "hsl(var(--surface-border))" }} />
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: "1px", backgroundColor: "hsl(var(--surface-border))" }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
      const res = await fetch(`${EDGE_URL}?limit=50`, { headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` } });
      const body = await res.json();
      if (!res.ok) {
        let detail: { code?: number; message?: string } | null = null;
        try { detail = JSON.parse(body.discord_detail); } catch { /* noop */ }
        if (res.status === 403 || detail?.code === 50001) setError("Bot needs access to #general — add it to the server with View Channel and Read Message History permissions.");
        else setError(`Discord error ${res.status}${detail?.message ? `: ${detail.message}` : ""}`);
        return;
      }
      const msgs: Message[] = body.messages ?? [];
      if (msgs.length > 0) {
        const latest = msgs[msgs.length - 1].id;
        if (prevIdRef.current && latest !== prevIdRef.current && !open) setNewCount((n) => n + 1);
        prevIdRef.current = latest;
      }
      setMessages(msgs);
    } catch { setError("Could not reach the Discord feed."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!hasFetchedRef.current) { hasFetchedRef.current = true; fetchMessages(); }
    const id = setInterval(() => fetchMessages(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) {
      setNewCount(0);
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 80);
    }
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  const items: Array<{ type: "div"; label: string } | { type: "msg"; msg: Message }> = [];
  messages.forEach((msg, i) => {
    if (i === 0 || !isSameDay(messages[i - 1].timestamp, msg.timestamp)) items.push({ type: "div", label: formatDate(msg.timestamp) });
    items.push({ type: "msg", msg });
  });

  return (
    <>
      {/* Panel */}
      <div style={{ position: "fixed", top: "56px", right: 0, bottom: 0, width: "360px", zIndex: 200, display: "flex", flexDirection: "column", backgroundColor: "hsl(var(--surface))", borderLeft: "1px solid hsl(var(--surface-border))", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: open ? "-8px 0 32px rgba(10,20,40,0.22)" : "none" }}>

        {/* Header */}
        <div style={{ height: "44px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid hsl(var(--surface-border))", backgroundColor: "hsl(var(--nav-bg))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.053a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--nav-text))", fontWeight: 500 }}>#general</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>— live</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <button onClick={() => fetchMessages()} aria-label="Refresh" style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: loading ? 0.4 : 0.7 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ transition: "transform 0.4s", transform: loading ? "rotate(180deg)" : "none" }}><path d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.05-3.41L10 6h5V1l-1.35 1.35z" fill="currentColor" /></svg>
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: 0.7 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></svg>
            </button>
          </div>
        </div>

        {/* Feed */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 0 20px", display: "flex", flexDirection: "column" }}>
          {loading && !messages.length && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em" }}>Loading…</div>}
          {error && <div style={{ margin: "12px 14px", padding: "10px 12px", backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", fontFamily: "'DM Sans',sans-serif", fontSize: "12px", lineHeight: 1.5, color: "hsl(var(--destructive))" }}>{error}</div>}
          {!loading && !error && !messages.length && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "hsl(var(--muted-foreground))", opacity: 0.45, letterSpacing: "0.08em" }}>No messages yet</div>}

          {items.map((item, idx) => {
            if (item.type === "div") return <DateDivider key={`d${idx}`} label={item.label} />;
            const { msg } = item;
            return (
              <div key={msg.id} style={{ display: "flex", gap: "10px", padding: "4px 14px", alignItems: "flex-start" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "hsl(var(--surface-raised))"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = ""; }}>
                <Avatar author={msg.author} avatarUrl={msg.avatarUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "1px" }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "13px", fontWeight: 700, color: "hsl(var(--foreground))" }}>{msg.author}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))", opacity: 0.55, letterSpacing: "0.04em", flexShrink: 0 }}>
                      {formatTime(msg.timestamp)}{msg.editedTimestamp ? " (edited)" : ""}{msg.pinned ? " 📌" : ""}
                    </span>
                  </div>
                  {msg.replyTo && <ReplyBanner reply={msg.replyTo} />}
                  {msg.content && (
                    <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "hsl(var(--foreground))", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                      {parseMarkdown(msg.content)}
                    </p>
                  )}
                  {!msg.content && !msg.attachments.length && !msg.embeds.length && !msg.stickers.length && (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "hsl(var(--muted-foreground))", opacity: 0.4, fontStyle: "italic" }}>[message]</span>
                  )}
                  <AttachmentsBlock attachments={msg.attachments} />
                  <EmbedsBlock embeds={msg.embeds} />
                  <StickersBlock stickers={msg.stickers} />
                  <ReactionsBlock reactions={msg.reactions} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dim overlay */}
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199, backgroundColor: "rgba(10,20,40,0.2)" }} />}

      {/* Bubble */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open Discord feed" style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 201, width: "46px", height: "46px", borderRadius: "0px", backgroundColor: "#1B3C6E", border: "1px solid rgba(248,246,241,0.25)", boxShadow: "0 3px 14px rgba(27,60,110,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.053a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#F8F6F1" /></svg>
          {newCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", minWidth: "17px", height: "17px", padding: "0 3px", borderRadius: "0px", backgroundColor: "#C4622D", border: "2px solid hsl(var(--background))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#F8F6F1", fontWeight: 700, lineHeight: 1, boxSizing: "border-box" }}>{newCount > 9 ? "9+" : newCount}</span>}
        </button>
      )}
    </>
  );
}
