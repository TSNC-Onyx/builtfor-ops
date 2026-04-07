import { useState } from "react";
import { signIn } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      <div
        className="w-full max-w-sm p-8"
        style={{
          backgroundColor: "hsl(var(--surface-raised))",
          border: "1px solid hsl(var(--surface-border))",
        }}
      >
        {/* Logo / wordmark */}
        <div className="mb-8">
          <div
            className="font-display text-[28px] tracking-[0.06em] leading-none mb-1"
            style={{ color: "hsl(var(--foreground))" }}
          >
            BUILTFOR
          </div>
          <div
            className="font-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Ops Console
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block font-mono text-[10px] tracking-[0.14em] uppercase mb-1.5"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 font-body text-[13px] bg-transparent outline-none focus:ring-0"
              style={{
                border: "1px solid hsl(var(--surface-border))",
                color: "hsl(var(--foreground))",
              }}
            />
          </div>

          <div>
            <label
              className="block font-mono text-[10px] tracking-[0.14em] uppercase mb-1.5"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 font-body text-[13px] bg-transparent outline-none focus:ring-0"
              style={{
                border: "1px solid hsl(var(--surface-border))",
                color: "hsl(var(--foreground))",
              }}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2 font-mono text-[10px] tracking-[0.1em]"
              style={{
                color: "hsl(var(--rust))",
                border: "1px solid hsl(var(--rust) / 0.3)",
                backgroundColor: "hsl(var(--rust) / 0.06)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 font-mono text-[11px] tracking-[0.16em] uppercase transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "hsl(var(--foreground))",
              color: "hsl(var(--background))",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
