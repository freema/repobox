"use client";

const ENVIRONMENTS = [
  { id: "default", name: "Default", description: "Node.js, npm, git" },
  { id: "nodejs-full", name: "Node.js Full", description: "Node.js, npm, yarn, pnpm" },
  { id: "php", name: "PHP", description: "PHP, Composer, Node.js" },
  { id: "python", name: "Python", description: "Python, pip, Node.js" },
  { id: "fullstack", name: "Full Stack", description: "Node.js, PHP, Python, Ruby, Go" },
] as const;

type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];

interface EnvironmentSelectorProps {
  value: EnvironmentId;
  onChange: (env: EnvironmentId) => void;
}

export function EnvironmentSelector({ value, onChange }: EnvironmentSelectorProps) {
  return (
    <div className="relative" data-testid="environment-selector">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EnvironmentId)}
        className="w-full h-10 rounded-lg px-3 text-sm appearance-none cursor-pointer transition-colors focus:outline-none"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        {ENVIRONMENTS.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4"
          style={{ color: "var(--text-muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export { ENVIRONMENTS };
export type { EnvironmentId };
