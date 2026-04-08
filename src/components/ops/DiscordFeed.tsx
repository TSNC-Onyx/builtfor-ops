import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";

const EDGE_URL = "https://tsdcxvmywimqfpdkevdx.supabase.co/functions/v1/discord-messages";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZGN4dm15d2ltcWZwZGtldmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODc0MDcsImV4cCI6MjA5MTA2MzQwN30.UXYnT3R2R28JicoAjRnhHMKsUvpgkqYICJRM0jsLCmg";
const POLL_MS = 15_000;
const H = { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` };

// ─── Types ────────────────────────────────────────────────────────────────────
interface Attachment { url: string; proxyUrl: string; contentType: string | null; filename: string; width: number | null; height: number | null; }
interface EmbedField { name: string; value: string; inline: boolean; }
interface Embed { type: string; url: string | null; title: string | null; description: string | null; color: number | null; image: { url: string } | null; thumbnail: { url: string } | null; video: { url: string } | null; author: { name: string; url: string | null } | null; footer: { text: string } | null; fields: EmbedField[]; }
interface Sticker { id: string; name: string; url: string | null; }
interface ReplyTo { id: string; author: string; content: string; attachments?: number; }
interface Reaction { count: number; emoji: { id: string | null; name: string; url: string | null }; }
interface Message { id: string; type: number; systemLabel: string | null; content: string; timestamp: string; editedTimestamp: string | null; author: string; authorId: string | null; avatarUrl: string | null; attachments: Attachment[]; embeds: Embed[]; stickers: Sticker[]; replyTo: ReplyTo | null; reactions: Reaction[]; pinned: boolean; }
interface Gif { id: string; title: string; previewUrl: string; gifUrl: string; mp4Url: string | null; }

// ─── Emoji categories ────────────────────────────────────────────────────────
const EMOJI_CATS = [
  { label:"Smileys", icon:"😊", e:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😋","😛","😜","🤪","😝","🤑","🤗","🤔","🤐","😐","😑","😏","😒","🙄","😬","😌","😔","😪","😴","😷","🤒","🤕","🤢","🤧","🥵","🥶","😵","🤯","😎","🥳","🤓","🧐","😤","😠","😡","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"] },
  { label:"People",  icon:"👋", e:["👋","🤚","🖐️","✋","🖖","🤙","👌","✌️","🤞","🤟","🤘","👈","👉","👆","👇","👍","👎","✊","👊","🤛","🤜","👏","🙌","🤝","🙏","💪","🦾","🤲","👐","🫶","❤️‍🔥","👀","👁️","👅","👂","🦻","💄","💋","👄","🫦"] },
  { label:"Hearts",  icon:"❤️", e:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❤️‍🔥","❤️‍🩹","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","✨","🌟","⭐","🌈","☀️","🌙","⚡","🔥","💫","🎉","🎊","🎈","🎁","🏆","🥇"] },
  { label:"Animals", icon:"🐶", e:["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐗","🦄","🐝","🦋","🐛","🐌","🐞","🐜","🦟","🦗","🕷️","🐢","🐍","🦎","🦕","🦖","🐙","🦑","🦐","🦀","🐬","🐳","🦈","🐊","🦒","🦓","🐘","🐃","🐎","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦔","🐿️","🦫","🦦","🦥"] },
  { label:"Food",    icon:"🍕", e:["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🍆","🥔","🥕","🌽","🌶️","🥒","🥬","🧅","🧄","🥜","🍞","🥐","🥖","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🌮","🌯","🥙","🧆","🥗","🍱","🍣","🍙","🍚","🍛","🍜","🍝","🍡","🍧","🍨","🍦","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","☕","🍵","🧃","🥤","🧋","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾"] },
  { label:"Sports",  icon:"⚽", e:["⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🏸","🥊","🥋","⛳","🎣","🤿","🎿","🛷","🥌","🏒","🏑","🏓","🏋️","🤼","🤸","🏇","🏊","🏄","🏆","🥇","🥈","🥉","🎖️","🎗️","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎵","🎶","🎹","🥁","🎷","🎺","🎸","🎻","🎲","🎯","🎳","🎮","🎰","🧩","🎴","🃏","🪄"] },
  { label:"Objects", icon:"💡", e:["💡","🔦","🕯️","💎","💍","👑","🔮","🪄","🎩","🎁","🎀","🎊","🎉","🎈","🧨","✨","🎆","🎇","📱","💻","🖥️","⌨️","🖱️","📷","📸","📹","🎥","📞","☎️","📺","📻","🧭","⏱️","⏰","🕰️","⌛","📡","🔋","🔌","💼","🧳","🔑","🗝️","🔓","🔒","🔧","🔨","⚒️","🛠️","⛏️","🔩","🧱","💰","💸","💳","📚","📖","📝","✏️","🖊️","📌","📍","🗑️","📫","📧","💬","💭","🗯️","🔔","🔕"] },
  { label:"Symbols", icon:"✅", e:["✅","❌","⭕","🆘","🚫","⚠️","🔞","🔥","💯","🔝","🔛","🔜","🔚","🆙","🆕","🆓","🆗","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","❗","❓","⁉️","💱","♻️","🔱","⚜️","🏧","✨","🎵","🎶","💤","🔞","📵","🚯","🚱","🚳","🚭","🔇","📴","🈳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🅾️","🆑","🆒","🆕"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => {
  const d = new Date(iso), t = new Date(), y = new Date(t); y.setDate(t.getDate()-1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
// Match Tenor CDN GIF URLs (media.tenor.com, c.tenor.com, media1.tenor.com, etc.) and legacy GIPHY URLs
const isGifOnly = (s: string) => {
  const t = s.trim();
  if (!t || t.includes(" ") || t.includes("\n")) return false;
  return /^https?:\/\/(media\d*\.giphy\.com\/media\/[^/\s]+\/[^/\s]+|(?:media\d*|c)\.tenor\.com\/[^\s]+)\.gif(\?.*)?$/i.test(t);
};
const fmtBytes = (n: number) => n < 1024*1024 ? `${Math.round(n/1024)}KB` : `${(n/1024/1024).toFixed(1)}MB`;

function parseMarkdown(raw: string): React.ReactNode[] {
  const out: React.ReactNode[] = []; let s = raw, k = 0;
  while (s.length > 0) {
    if (s.startsWith("**")) { const e=s.indexOf("**",2); if(e>2){out.push(<strong key={k++}>{s.slice(2,e)}</strong>);s=s.slice(e+2);continue;} }
    if (s.startsWith("__")) { const e=s.indexOf("__",2); if(e>2){out.push(<u key={k++}>{s.slice(2,e)}</u>);s=s.slice(e+2);continue;} }
    if (s.startsWith("~~")) { const e=s.indexOf("~~",2); if(e>2){out.push(<s key={k++}>{s.slice(2,e)}</s>);s=s.slice(e+2);continue;} }
    if (s.startsWith("||")) { const e=s.indexOf("||",2); if(e>2){const t=s.slice(2,e);out.push(<Spoiler key={k++} t={t}/>);s=s.slice(e+2);continue;} }
    if (s.startsWith("```")) { const e=s.indexOf("```",3); if(e>3){const inner=s.slice(3,e).replace(/^\w+\n/,"");out.push(<code key={k++} style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:"11px",backgroundColor:"rgba(0,0,0,0.2)",padding:"6px 8px",whiteSpace:"pre-wrap",wordBreak:"break-all",margin:"2px 0",borderRadius:"2px"}}>{inner.trim()}</code>);s=s.slice(e+3);continue;} }
    if (s.startsWith("`")) { const e=s.indexOf("`",1); if(e>1){out.push(<code key={k++} style={{fontFamily:"'DM Mono',monospace",fontSize:"11px",backgroundColor:"rgba(88,101,242,0.12)",padding:"1px 4px",borderRadius:"2px"}}>{s.slice(1,e)}</code>);s=s.slice(e+1);continue;} }
    if (s.startsWith("*")) { const e=s.indexOf("*",1); if(e>1){out.push(<em key={k++}>{s.slice(1,e)}</em>);s=s.slice(e+1);continue;} }
    if (s.startsWith("_")) { const e=s.indexOf("_",1); if(e>1){out.push(<em key={k++}>{s.slice(1,e)}</em>);s=s.slice(e+1);continue;} }
    if (s.startsWith("> ")) { const nl=s.indexOf("\n"); const line=nl===-1?s.slice(2):s.slice(2,nl); out.push(<div key={k++} style={{borderLeft:"3px solid hsl(var(--muted-foreground))",paddingLeft:"8px",opacity:.75,marginBottom:"1px"}}>{line}</div>); s=nl===-1?"":s.slice(nl); continue; }
    const cemo=s.match(/^<a?:(\w+):(\d+)>/); if(cemo){const a=s.startsWith("<a:");out.push(<img key={k++} src={`https://cdn.discordapp.com/emojis/${cemo[2]}.${a?"gif":"png"}?size=24`} alt={`:${cemo[1]}:`} style={{width:20,height:20,verticalAlign:"middle",display:"inline"}}/>);s=s.slice(cemo[0].length);continue;}
    const ment=s.match(/^<[@#][!&]?\d+>/); if(ment){out.push(<span key={k++} style={{backgroundColor:"rgba(88,101,242,0.18)",color:"#8ea1e1",padding:"0 2px",borderRadius:"2px"}}>{ment[0].startsWith("<#")?"#channel":"@user"}</span>);s=s.slice(ment[0].length);continue;}
    const urlM=s.match(/^https?:\/\/[^\s<>"]+/); if(urlM){out.push(<a key={k++} href={urlM[0]} target="_blank" rel="noopener noreferrer" style={{color:"#5865F2",textDecoration:"underline",wordBreak:"break-all"}}>{urlM[0]}</a>);s=s.slice(urlM[0].length);continue;}
    const plain=s.match(/^[^*_~|`<>\n]+/)??[s[0]]; out.push(<span key={k++}>{plain[0]}</span>); s=s.slice(plain[0].length);
  }
  return out;
}

function Spoiler({ t }: { t: string }) {
  const [shown, setShown] = useState(false);
  return <span onClick={()=>setShown(true)} style={{backgroundColor:shown?"transparent":"rgba(0,0,0,0.35)",color:shown?"inherit":"transparent",cursor:"pointer",padding:"0 2px",userSelect:"none",borderRadius:"2px"}}>{t}</span>;
}

function Avatar({ author, avatarUrl }: { author: string; avatarUrl: string | null }) {
  const [fail, setFail] = useState(false);
  if (avatarUrl && !fail) return <img src={avatarUrl} alt={author} width={32} height={32} style={{borderRadius:"50%",flexShrink:0,display:"block",objectFit:"cover"}} onError={()=>setFail(true)}/>;
  return <div style={{width:32,height:32,borderRadius:"50%",backgroundColor:"#5865F2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"#fff",fontWeight:600}}>{author.slice(0,2).toUpperCase()}</div>;
}

function ReplyBanner({ r }: { r: ReplyTo }) {
  return <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px",paddingLeft:"4px",borderLeft:"2px solid hsl(var(--muted-foreground))",opacity:.55}}><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"11px",fontWeight:600,color:"hsl(var(--foreground))",whiteSpace:"nowrap"}}>↩ {r.author}</span><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"hsl(var(--muted-foreground))",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.content||(r.attachments?"[attachment]":"[message]")}</span></div>;
}

function AttachBlock({ a }: { a: Attachment[] }) {
  if (!a.length) return null;
  return <div style={{display:"flex",flexDirection:"column",gap:"6px",marginTop:"4px"}}>{a.map((x,i)=>{
    const img=x.contentType?.startsWith("image/")||/\.(png|jpe?g|gif|webp)(\?|$)/i.test(x.url);
    const vid=x.contentType?.startsWith("video/");
    if(img) return <a key={i} href={x.url} target="_blank" rel="noopener noreferrer"><img src={x.proxyUrl||x.url} alt={x.filename} style={{maxWidth:"100%",maxHeight:"240px",objectFit:"contain",display:"block",border:"1px solid hsl(var(--surface-border))"}}/></a>;
    if(vid) return <video key={i} src={x.url} controls style={{maxWidth:"100%",maxHeight:"200px",display:"block"}}/>;
    return <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 10px",backgroundColor:"hsl(var(--surface-raised))",border:"1px solid hsl(var(--surface-border))",textDecoration:"none"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#5865F2",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.filename}</span></a>;
  })}</div>;
}

function EmbedBlock({ e }: { e: Embed[] }) {
  if (!e.length) return null;
  return <div style={{display:"flex",flexDirection:"column",gap:"5px",marginTop:"4px"}}>{e.map((x,i)=>{
    if(x.type==="gifv") return x.video?.url?<video key={i} src={x.video.url} autoPlay loop muted playsInline style={{maxWidth:"100%",maxHeight:"240px",display:"block"}}/>:null;
    if(x.type==="image"){const src=x.image?.url??x.thumbnail?.url;return src?<a key={i} href={x.url??src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" style={{maxWidth:"100%",maxHeight:"240px",objectFit:"contain",display:"block"}}/></a>:null;}
    const ac=x.color?`#${x.color.toString(16).padStart(6,"0")}`:"#5865F2";
    return <div key={i} style={{borderLeft:`3px solid ${ac}`,backgroundColor:"hsl(var(--surface-raised))",padding:"8px 10px",display:"flex",flexDirection:"column",gap:"3px"}}>
      {x.author&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"11px",fontWeight:600,color:"hsl(var(--muted-foreground))"}}>{x.author.url?<a href={x.author.url} target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"none"}}>{x.author.name}</a>:x.author.name}</div>}
      {x.title&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,color:"hsl(var(--foreground))"}}>{x.url?<a href={x.url} target="_blank" rel="noopener noreferrer" style={{color:"#5865F2",textDecoration:"none"}}>{x.title}</a>:x.title}</div>}
      {x.description&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"12px",color:"hsl(var(--foreground))",opacity:.8,lineHeight:1.45,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{x.description.slice(0,300)}{x.description.length>300?"…":""}</div>}
      {x.fields.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px",marginTop:"2px"}}>{x.fields.map((f,fi)=><div key={fi} style={{gridColumn:f.inline?undefined:"1 / -1"}}><div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",textTransform:"uppercase",letterSpacing:"0.08em",color:"hsl(var(--muted-foreground))",marginBottom:"1px"}}>{f.name}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"12px",color:"hsl(var(--foreground))"}}>{f.value}</div></div>)}</div>}
      {x.image&&<img src={x.image.url} alt="" style={{maxWidth:"100%",maxHeight:"200px",objectFit:"contain",marginTop:"2px"}} onError={(z)=>{(z.currentTarget as HTMLImageElement).style.display="none";}}/>}
      {!x.image&&x.thumbnail&&<img src={x.thumbnail.url} alt="" style={{maxWidth:"80px",maxHeight:"80px",objectFit:"contain",alignSelf:"flex-end"}}/>}
      {x.footer&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",marginTop:"2px"}}>{x.footer.text}</div>}
    </div>;
  })}</div>;
}

function StickerBlock({ s }: { s: Sticker[] }) {
  if (!s.length) return null;
  return <div style={{display:"flex",gap:"4px",marginTop:"4px"}}>{s.map((x)=>x.url?<img key={x.id} src={x.url} alt={x.name} title={x.name} style={{width:80,height:80,objectFit:"contain"}}/>:<span key={x.id} style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"hsl(var(--muted-foreground))",opacity:.5}}>[{x.name}]</span>)}</div>;
}

function ReactBlock({ r }: { r: Reaction[] }) {
  if (!r.length) return null;
  return <div style={{display:"flex",flexWrap:"wrap",gap:"4px",marginTop:"5px"}}>{r.map((x,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"2px 7px",backgroundColor:"hsl(var(--surface-raised))",border:"1px solid hsl(var(--surface-border))"}}>{x.emoji.url?<img src={x.emoji.url} alt={x.emoji.name} width={14} height={14}/>:<span style={{fontSize:"13px",lineHeight:1}}>{x.emoji.name}</span>}<span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"hsl(var(--muted-foreground))",fontWeight:600}}>{x.count}</span></span>)}</div>;
}

function DateDivider({ label }: { label: string }) {
  return <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",margin:"4px 0"}}><div style={{flex:1,height:"1px",backgroundColor:"hsl(var(--surface-border))"}}/><span style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:"0.12em",textTransform:"uppercase",color:"hsl(var(--muted-foreground))",whiteSpace:"nowrap"}}>{label}</span><div style={{flex:1,height:"1px",backgroundColor:"hsl(var(--surface-border))"}}/></div>;
}

// ─── Shared toolbar button ─────────────────────────────────────────────────────
function ToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      style={{ height:"24px", minWidth:"28px", padding:"0 5px", display:"flex", alignItems:"center", justifyContent:"center", gap:"3px", background: active ? "hsl(var(--surface-border))" : "none", border:"1px solid", borderColor: active ? "hsl(var(--surface-border))" : "transparent", cursor:"pointer", borderRadius:"2px", fontFamily:"'DM Mono',monospace", fontSize:"9px", fontWeight:700, letterSpacing:"0.06em", color:"hsl(var(--muted-foreground))", opacity: active ? 1 : 0.7, transition:"opacity 0.1s, background 0.1s" }}
      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.opacity="1";}}
      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity=active?"1":"0.7";}}>
      {children}
    </button>
  );
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect:(e:string)=>void; onClose:()=>void }) {
  const [cat, setCat] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const dn=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))onClose();};
    const kd=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
    document.addEventListener("mousedown",dn); document.addEventListener("keydown",kd);
    return()=>{document.removeEventListener("mousedown",dn);document.removeEventListener("keydown",kd);};
  },[onClose]);
  return <div ref={ref} style={{position:"absolute",bottom:"calc(100% + 4px)",left:0,width:"300px",backgroundColor:"hsl(var(--surface))",border:"1px solid hsl(var(--surface-border))",boxShadow:"0 -4px 20px rgba(10,20,40,0.18)",zIndex:20,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",borderBottom:"1px solid hsl(var(--surface-border))",padding:"4px 6px",gap:"2px",overflowX:"auto"}}>
      {EMOJI_CATS.map((c,i)=><button key={i} onClick={()=>setCat(i)} title={c.label} style={{width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",background:cat===i?"hsl(var(--surface-raised))":"none",border:cat===i?"1px solid hsl(var(--surface-border))":"1px solid transparent",cursor:"pointer",fontSize:"15px",flexShrink:0,borderRadius:"2px"}}>{c.icon}</button>)}
    </div>
    <div style={{padding:"4px 10px 2px",fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:"0.1em",textTransform:"uppercase",color:"hsl(var(--muted-foreground))"}}>{EMOJI_CATS[cat].label}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:"1px",padding:"4px 6px 8px",maxHeight:"200px",overflowY:"auto"}}>
      {EMOJI_CATS[cat].e.map((em,i)=><button key={i} onClick={()=>{onSelect(em);onClose();}} style={{width:"32px",height:"32px",display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",fontSize:"18px",borderRadius:"2px"}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor="hsl(var(--surface-raised))";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor="";}}>{em}</button>)}
    </div>
  </div>;
}

// ─── GIF Picker ───────────────────────────────────────────────────────────────
function GifPicker({ onSend, onClose }: { onSend:(url:string)=>void; onClose:()=>void }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true); setErr(false);
    try {
      const action = q.trim() ? `action=gif-search&q=${encodeURIComponent(q.trim())}` : "action=gif-trending";
      const res = await fetch(`${EDGE_URL}?${action}`, { headers: H });
      const body = await res.json();
      setGifs(body.gifs ?? []);
    } catch { setErr(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGifs(""); }, [fetchGifs]);
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => fetchGifs(query), 400);
    return () => clearTimeout(debRef.current);
  }, [query, fetchGifs]);
  useEffect(()=>{
    const dn=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))onClose();};
    const kd=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
    document.addEventListener("mousedown",dn); document.addEventListener("keydown",kd);
    return()=>{document.removeEventListener("mousedown",dn);document.removeEventListener("keydown",kd);};
  },[onClose]);

  return <div ref={ref} style={{position:"absolute",bottom:"calc(100% + 4px)",left:0,right:0,backgroundColor:"hsl(var(--surface))",border:"1px solid hsl(var(--surface-border))",boxShadow:"0 -4px 20px rgba(10,20,40,0.18)",zIndex:20,display:"flex",flexDirection:"column",maxHeight:"320px"}}>
    <div style={{padding:"8px 10px",borderBottom:"1px solid hsl(var(--surface-border))",display:"flex",alignItems:"center",gap:"6px"}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search GIFs…" autoFocus style={{flex:1,background:"none",border:"none",outline:"none",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",color:"hsl(var(--foreground))"}}/>
      {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",color:"hsl(var(--muted-foreground))",fontSize:"14px",padding:0,lineHeight:1}}>×</button>}
    </div>
    <div style={{padding:"4px 10px 2px",fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:"0.1em",textTransform:"uppercase",color:"hsl(var(--muted-foreground))"}}>
      {query.trim()?`Results for "${query.trim()}"` : "Trending"}
      <span style={{opacity:.5,marginLeft:"6px"}}>via Tenor</span>
    </div>
    <div style={{overflowY:"auto",flex:1,padding:"4px 8px 8px"}}>
      {loading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"80px",fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"hsl(var(--muted-foreground))"}}>Loading…</div>}
      {err&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"80px",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",color:"hsl(var(--destructive))"}}>Could not load GIFs.</div>}
      {!loading&&!err&&gifs.length===0&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"80px",fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"hsl(var(--muted-foreground))",opacity:.5}}>No results</div>}
      {!loading&&gifs.length>0&&(
        <div style={{columns:"3 auto",gap:"4px",columnFill:"balance"}}>
          {gifs.map(g=>(
            <button key={g.id} onClick={()=>{onSend(g.gifUrl);onClose();}} title={g.title||"GIF"} style={{display:"block",width:"100%",marginBottom:"4px",background:"none",border:"1px solid transparent",cursor:"pointer",padding:0,borderRadius:"2px",overflow:"hidden",breakInside:"avoid"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="hsl(var(--surface-border))";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="transparent";}}>
              <img src={g.previewUrl} alt={g.title||"GIF"} loading="lazy" style={{width:"100%",display:"block",objectFit:"cover"}}/>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>;
}

// ─── Message row ─────────────────────────────────────────────────────────────
function MsgRow({ msg, isSearch }: { msg: Message; isSearch?: boolean }) {
  const isSystem = msg.type !== 0 && msg.type !== 19 && msg.type !== 20 && msg.type !== 23;
  if (isSystem) return (
    <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"3px 14px"}}>
      <div style={{width:32,flexShrink:0,display:"flex",justifyContent:"center"}}><span style={{fontSize:"14px"}}>🔔</span></div>
      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"12px",color:"hsl(var(--muted-foreground))",opacity:.7}}>
        <strong>{msg.author}</strong>{msg.systemLabel?` ${msg.systemLabel}`:""}
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",marginLeft:"6px",opacity:.5}}>{fmtTime(msg.timestamp)}</span>
      </span>
    </div>
  );
  const gifOnly = isGifOnly(msg.content);
  const hasMedia = msg.attachments.length || msg.embeds.length || msg.stickers.length;
  return (
    <div style={{display:"flex",gap:"10px",padding:"4px 14px",alignItems:"flex-start",backgroundColor:isSearch?"hsl(var(--surface-raised))":undefined}}
      onMouseEnter={e=>{if(!isSearch)(e.currentTarget as HTMLDivElement).style.backgroundColor="hsl(var(--surface-raised))";}}
      onMouseLeave={e=>{if(!isSearch)(e.currentTarget as HTMLDivElement).style.backgroundColor="";}}>
      <Avatar author={msg.author} avatarUrl={msg.avatarUrl}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"baseline",gap:"6px",marginBottom:"1px"}}>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,color:"hsl(var(--foreground))"}}>{msg.author}</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",opacity:.5,letterSpacing:"0.04em",flexShrink:0}}>
            {fmtTime(msg.timestamp)}{msg.editedTimestamp?" (edited)":""}{msg.pinned?" 📌":""}
          </span>
          {isSearch&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",opacity:.4,marginLeft:"auto"}}>{fmtDate(msg.timestamp)}</span>}
        </div>
        {msg.replyTo&&<ReplyBanner r={msg.replyTo}/>}
        {gifOnly?<img src={msg.content.trim()} alt="GIF" style={{maxWidth:"100%",maxHeight:"240px",objectFit:"contain",display:"block",marginTop:"4px",border:"1px solid hsl(var(--surface-border))"}}/>
        :msg.content?<p style={{margin:0,fontFamily:"'DM Sans',sans-serif",fontSize:"13px",color:"hsl(var(--foreground))",lineHeight:1.5,wordBreak:"break-word",whiteSpace:"pre-wrap"}}>{parseMarkdown(msg.content)}</p>
        :(!hasMedia)?<span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"hsl(var(--muted-foreground))",opacity:.35,fontStyle:"italic"}}>[content hidden — enable Message Content Intent]</span>:null}
        <AttachBlock a={msg.attachments}/>
        <EmbedBlock e={msg.embeds}/>
        <StickerBlock s={msg.stickers}/>
        <ReactBlock r={msg.reactions}/>
      </div>
    </div>
  );
}

// ─── Message Input ────────────────────────────────────────────────────────────
function MessageInput({ onSent }: { onSent:(msg:Message)=>void }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string|null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [pendingFile, setPendingFile] = useState<File|null>(null);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function sendText(content: string) {
    const c = content.trim(); if (!c) return;
    setSending(true); setSendErr(null);
    try {
      const res = await fetch(EDGE_URL, { method:"POST", headers:{...H,"Content-Type":"application/json"}, body:JSON.stringify({content:c}) });
      const body = await res.json();
      if (!res.ok) { setSendErr(body?.error??`Failed (${res.status})`); return; }
      if (body.message) onSent(body.message);
    } catch { setSendErr("Network error."); }
    finally { setSending(false); }
  }

  async function sendFile(file: File, caption: string) {
    setUploading(true); setSendErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      if (caption.trim()) fd.append("caption", caption.trim());
      const res = await fetch(EDGE_URL, { method:"POST", headers: H, body: fd });
      const body = await res.json();
      if (!res.ok) { setSendErr(body?.error??`Upload failed (${res.status})`); return; }
      if (body.message) onSent(body.message);
      setPendingFile(null); setValue("");
      if (taRef.current) taRef.current.style.height = "auto";
    } catch { setSendErr("Upload failed."); }
    finally { setUploading(false); }
  }

  async function handleSend() {
    if (sending || uploading) return;
    if (pendingFile) { await sendFile(pendingFile, value); }
    else {
      const c = value.trim(); if (!c) return;
      await sendText(c);
      setValue(""); if (taRef.current) taRef.current.style.height = "auto";
    }
  }

  function insertEmoji(em: string) {
    const el = taRef.current;
    if (!el) { setValue(v=>v+em); return; }
    const s=el.selectionStart??value.length, e=el.selectionEnd??value.length;
    setValue(value.slice(0,s)+em+value.slice(e));
    requestAnimationFrame(()=>{ el.focus(); const p=s+em.length; el.setSelectionRange(p,p); });
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); handleSend(); }
  }
  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el=e.target; el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,120)+"px";
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPendingFile(f); e.target.value="";
    if (f) { setShowEmoji(false); setShowGif(false); }
  }

  const busy = sending || uploading;
  const canSend = !busy && (pendingFile !== null || value.trim().length > 0);

  return (
    <div style={{flexShrink:0, borderTop:"1px solid hsl(var(--surface-border))", backgroundColor:"hsl(var(--surface))", position:"relative"}}>
      {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={()=>setShowEmoji(false)}/>}
      {showGif && <GifPicker onSend={url=>sendText(url)} onClose={()=>setShowGif(false)}/>}
      {sendErr && <div style={{padding:"4px 12px 0",fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"hsl(var(--destructive))",lineHeight:1.4}}>{sendErr}</div>}
      {pendingFile && (
        <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 12px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px",flex:1,backgroundColor:"hsl(var(--surface-raised))",border:"1px solid hsl(var(--surface-border))",padding:"4px 8px",minWidth:0}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"hsl(var(--foreground))",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{pendingFile.name}</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",flexShrink:0,opacity:.6}}>{fmtBytes(pendingFile.size)}</span>
          </div>
          <button onClick={()=>setPendingFile(null)} aria-label="Remove file" style={{width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",color:"hsl(var(--muted-foreground))",flexShrink:0,padding:0,opacity:.6}}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/></svg>
          </button>
        </div>
      )}
      <div style={{padding:"8px 12px 0"}}>
        <div style={{backgroundColor:"hsl(var(--surface-raised))",border:"1px solid hsl(var(--surface-border))",padding:"7px 10px"}}>
          <textarea ref={taRef} value={value} onChange={onInput} onKeyDown={onKey}
            placeholder={pendingFile ? "Add a caption (optional)…" : "Message #general"}
            disabled={busy} rows={1}
            style={{display:"block",width:"100%",boxSizing:"border-box",resize:"none",background:"none",border:"none",outline:"none",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",color:"hsl(var(--foreground))",lineHeight:1.45,minHeight:"20px",maxHeight:"120px",overflowY:"auto",padding:0,opacity:busy?.5:1}}/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",padding:"5px 10px 8px",gap:"4px"}}>
        <ToolBtn active={showEmoji} onClick={()=>{setShowEmoji(s=>!s);setShowGif(false);}} title="Emoji">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3"/>
            <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3"/>
          </svg>
        </ToolBtn>
        <ToolBtn active={showGif} onClick={()=>{setShowGif(s=>!s);setShowEmoji(false);}} title="GIF">GIF</ToolBtn>
        <input ref={fileRef} type="file" onChange={onFileChange} style={{display:"none"}} accept="*/*"/>
        <ToolBtn active={pendingFile !== null} onClick={()=>fileRef.current?.click()} title="Attach file">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </ToolBtn>
        <div style={{flex:1}}/>
        <button onClick={handleSend} disabled={!canSend} aria-label="Send"
          style={{width:"28px",height:"28px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",backgroundColor:canSend?"#5865F2":"transparent",border:"none",borderRadius:"2px",cursor:canSend?"pointer":"default",padding:0,transition:"background-color 0.12s",opacity:canSend?1:.3}}>
          {busy
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="28 28"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#F8F6F1" strokeWidth="2.2" strokeLinecap="square"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#F8F6F1" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function DiscordFeed() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [newCount, setNewCount] = useState(0);
  const [intentGap, setIntentGap] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]|null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string|null>(null);
  const [searchTotal, setSearchTotal] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevIdRef = useRef<string|null>(null);
  const hasFetchedRef = useRef(false);
  const prependHeightRef = useRef(0);
  const isPrependRef = useRef(false);

  useLayoutEffect(() => {
    if (isPrependRef.current && scrollRef.current && prependHeightRef.current > 0) {
      const diff = scrollRef.current.scrollHeight - prependHeightRef.current;
      scrollRef.current.scrollTop = diff;
      prependHeightRef.current = 0; isPrependRef.current = false;
    }
  }, [messages]);

  async function fetchMessages(quiet = false) {
    if (!quiet) setLoading(true); setError(null);
    try {
      const res = await fetch(`${EDGE_URL}?limit=50`, { headers: H });
      const body = await res.json();
      if (!res.ok) {
        let d: {code?:number;message?:string}|null=null;
        try{d=JSON.parse(body.discord_detail);}catch{/**/}
        if(res.status===403||d?.code===50001) setError("Bot needs access to #general.");
        else setError(`Discord error ${res.status}${d?.message?`: ${d.message}`:""}`);
        return;
      }
      const msgs: Message[] = body.messages ?? [];
      if (msgs.some(m=>m.type===0&&!m.content&&!m.attachments.length&&!m.embeds.length&&!m.stickers.length)) setIntentGap(true);
      if (msgs.length > 0) {
        const latest = msgs[msgs.length-1].id;
        if (prevIdRef.current && latest !== prevIdRef.current && !open) setNewCount(n=>n+1);
        prevIdRef.current = latest;
      }
      setHasMore(body.hasMore ?? (msgs.length === 50)); setMessages(msgs);
    } catch { setError("Could not reach the Discord feed."); }
    finally { setLoading(false); }
  }

  async function loadMore() {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldest = messages[0].id; setLoadingMore(true);
    prependHeightRef.current = scrollRef.current?.scrollHeight ?? 0;
    isPrependRef.current = true;
    try {
      const res = await fetch(`${EDGE_URL}?limit=50&before=${oldest}`, { headers: H });
      const body = await res.json();
      if (!res.ok) { isPrependRef.current = false; return; }
      const older: Message[] = body.messages ?? [];
      if (older.length < 50) setHasMore(false);
      if (older.length > 0) setMessages(prev => [...older, ...prev]);
      else isPrependRef.current = false;
    } catch { isPrependRef.current = false; }
    finally { setLoadingMore(false); }
  }

  async function performSearch(q: string) {
    q = q.trim(); if (!q) { setSearchResults(null); setSearchErr(null); return; }
    setSearchLoading(true); setSearchErr(null);
    try {
      const res = await fetch(`${EDGE_URL}?action=search&q=${encodeURIComponent(q)}`, { headers: H });
      const body = await res.json();
      if (!res.ok) { setSearchErr(`Search failed (${res.status})`); setSearchResults([]); return; }
      setSearchResults(body.messages ?? []); setSearchTotal(body.total ?? 0);
    } catch { setSearchErr("Search request failed."); setSearchResults([]); }
    finally { setSearchLoading(false); }
  }

  const searchDebRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!searchOpen) return;
    clearTimeout(searchDebRef.current);
    if (searchQ.trim()) searchDebRef.current = setTimeout(() => performSearch(searchQ), 500);
    else setSearchResults(null);
    return () => clearTimeout(searchDebRef.current);
  }, [searchQ, searchOpen]);

  function handleSent(msg: Message) {
    setMessages(prev => { if (prev.some(m=>m.id===msg.id)) return prev; return [...prev, msg]; });
    prevIdRef.current = msg.id;
    setTimeout(() => { if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; }, 50);
  }

  useEffect(() => {
    if (!hasFetchedRef.current) { hasFetchedRef.current=true; fetchMessages(); }
    const id = setInterval(()=>fetchMessages(true), POLL_MS);
    return ()=>clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) { setNewCount(0); setTimeout(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},80); }
  }, [open]);

  useEffect(() => {
    if (open && !searchOpen && scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollHeight-el.scrollTop-el.clientHeight < 100) el.scrollTop=el.scrollHeight;
    }
  }, [messages, open, searchOpen]);

  const items: Array<{type:"div";label:string}|{type:"msg";msg:Message}> = [];
  const activeMsgs = searchOpen && searchResults !== null ? searchResults : messages;
  activeMsgs.forEach((msg,i) => {
    const prev = i>0?activeMsgs[i-1]:null;
    if (!prev || !sameDay(prev.timestamp, msg.timestamp)) items.push({type:"div",label:fmtDate(msg.timestamp)});
    items.push({type:"msg",msg});
  });
  const inSearch = searchOpen && searchResults !== null;

  return (
    <>
      <div style={{position:"fixed",top:"56px",right:0,bottom:0,width:"360px",zIndex:200,display:"flex",flexDirection:"column",backgroundColor:"hsl(var(--surface))",borderLeft:"1px solid hsl(var(--surface-border))",transform:open?"translateX(0)":"translateX(100%)",transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)",boxShadow:open?"-8px 0 32px rgba(10,20,40,0.22)":"none"}}>
        <div style={{height:"44px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",borderBottom:"1px solid hsl(var(--surface-border))",backgroundColor:"hsl(var(--nav-bg))"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.053a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:"0.12em",textTransform:"uppercase",color:"hsl(var(--nav-text))",fontWeight:500}}>#general</span>
            {!searchOpen&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",opacity:.45}}>— live</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"2px"}}>
            <button onClick={()=>{setSearchOpen(s=>{if(s){setSearchQ("");setSearchResults(null);setSearchErr(null);}return !s;});}} aria-label="Search" style={{width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",color:searchOpen?"hsl(var(--foreground))":"hsl(var(--muted-foreground))",background:searchOpen?"hsl(var(--surface-raised))":"none",border:"none",cursor:"pointer",padding:0,opacity:.75,borderRadius:"2px"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            <button onClick={()=>fetchMessages()} aria-label="Refresh" style={{width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",color:"hsl(var(--muted-foreground))",background:"none",border:"none",cursor:"pointer",padding:0,opacity:loading?.4:.65}}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{transition:"transform 0.4s",transform:loading?"rotate(180deg)":"none"}}><path d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.05-3.41L10 6h5V1l-1.35 1.35z" fill="currentColor"/></svg>
            </button>
            <button onClick={()=>setOpen(false)} aria-label="Close" style={{width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",color:"hsl(var(--muted-foreground))",background:"none",border:"none",cursor:"pointer",padding:0,opacity:.65}}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/></svg>
            </button>
          </div>
        </div>
        {searchOpen && (
          <div style={{padding:"8px 12px",borderBottom:"1px solid hsl(var(--surface-border))",backgroundColor:"hsl(var(--surface-raised))",display:"flex",flexDirection:"column",gap:"4px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:"hsl(var(--surface))",border:"1px solid hsl(var(--surface-border))",padding:"5px 10px"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search message history…" autoFocus
                style={{flex:1,background:"none",border:"none",outline:"none",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",color:"hsl(var(--foreground))"}}
                onKeyDown={e=>{if(e.key==="Enter")performSearch(searchQ);if(e.key==="Escape"){setSearchOpen(false);setSearchQ("");setSearchResults(null);}}}/>
              {searchQ&&<button onClick={()=>{setSearchQ("");setSearchResults(null);}} style={{background:"none",border:"none",cursor:"pointer",color:"hsl(var(--muted-foreground))",fontSize:"16px",padding:0,lineHeight:1}}>×</button>}
            </div>
            {searchLoading&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",letterSpacing:"0.08em"}}>Searching…</div>}
            {!searchLoading&&searchResults!==null&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"hsl(var(--muted-foreground))",letterSpacing:"0.08em"}}>{searchErr?<span style={{color:"hsl(var(--destructive))"}}>{searchErr}</span>:`${searchResults.length} result${searchResults.length!==1?"s":""} of ${searchTotal}`}</div>}
          </div>
        )}
        {intentGap && !searchOpen && (
          <div style={{padding:"7px 14px",backgroundColor:"rgba(196,98,45,0.08)",borderBottom:"1px solid rgba(196,98,45,0.2)",display:"flex",alignItems:"flex-start",gap:"8px"}}>
            <span style={{fontSize:"13px",flexShrink:0,marginTop:"1px"}}>⚠️</span>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"hsl(var(--muted-foreground))",lineHeight:1.45}}>Some messages are hidden. Enable <strong>Message Content Intent</strong>: Discord Developer Portal → Bot → Privileged Gateway Intents.</div>
          </div>
        )}
        <div ref={scrollRef} style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"4px 0 8px",display:"flex",flexDirection:"column"}}>
          {loading&&!messages.length&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"hsl(var(--muted-foreground))",letterSpacing:"0.08em"}}>Loading…</div>}
          {error&&<div style={{margin:"12px 14px",padding:"10px 12px",backgroundColor:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",lineHeight:1.5,color:"hsl(var(--destructive))"}}>{error}</div>}
          {!loading&&!error&&!messages.length&&!inSearch&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"hsl(var(--muted-foreground))",opacity:.45,letterSpacing:"0.08em"}}>No messages yet</div>}
          {!inSearch&&hasMore&&messages.length>0&&(
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0"}}>
              <button onClick={loadMore} disabled={loadingMore} style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:"0.1em",textTransform:"uppercase",color:"hsl(var(--muted-foreground))",background:"none",border:"1px solid hsl(var(--surface-border))",cursor:loadingMore?"default":"pointer",padding:"4px 12px",opacity:loadingMore?.5:1,borderRadius:"2px"}}>
                {loadingMore?"Loading…":"↑ Load older messages"}
              </button>
            </div>
          )}
          {inSearch&&searchResults?.length===0&&!searchLoading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"hsl(var(--muted-foreground))",opacity:.45,letterSpacing:"0.08em"}}>No messages found</div>}
          {items.map((item,idx) => {
            if (item.type==="div") return <DateDivider key={`d${idx}`} label={item.label}/>;
            return <MsgRow key={item.msg.id} msg={item.msg} isSearch={inSearch}/>;
          })}
        </div>
        {!searchOpen && <MessageInput onSent={handleSent}/>}
      </div>
      {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:199,backgroundColor:"rgba(10,20,40,0.2)"}}/>}
      {!open&&(
        <button onClick={()=>setOpen(true)} aria-label="Open Discord feed" style={{position:"fixed",bottom:"24px",right:"24px",zIndex:201,width:"46px",height:"46px",borderRadius:"0px",backgroundColor:"#1B3C6E",border:"1px solid rgba(248,246,241,0.25)",boxShadow:"0 3px 14px rgba(27,60,110,0.6)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.053a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#F8F6F1"/></svg>
          {newCount>0&&<span style={{position:"absolute",top:"-5px",right:"-5px",minWidth:"17px",height:"17px",padding:"0 3px",borderRadius:"0px",backgroundColor:"#C4622D",border:"2px solid hsl(var(--background))",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#F8F6F1",fontWeight:700,lineHeight:1,boxSizing:"border-box"}}>{newCount>9?"9+":newCount}</span>}
        </button>
      )}
    </>
  );
}
