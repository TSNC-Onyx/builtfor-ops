import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "hsl(var(--background))" }}>
      <div className="text-center">
        <h1 className="font-display text-6xl mb-4" style={{ color: "hsl(var(--navy))" }}>404</h1>
        <p className="font-body mb-8" style={{ color: "hsl(var(--foreground))" }}>Page not found.</p>
        <Link to="/" className="font-body underline" style={{ color: "hsl(var(--rust))" }}>Back to dashboard</Link>
      </div>
    </div>
  );
}
