const PALETTE = [
  { bg: "rgba(59,130,246,0.15)",   color: "#60A5FA" },
  { bg: "rgba(139,92,246,0.15)",   color: "#A78BFA" },
  { bg: "rgba(236,72,153,0.15)",   color: "#F472B6" },
  { bg: "rgba(250,204,21,0.15)",   color: "#FBBF24" },
  { bg: "rgba(34,211,238,0.15)",   color: "#22D3EE" },
  { bg: "rgba(245,158,11,0.15)",   color: "#F59E0B" },
  { bg: "rgba(168,85,247,0.15)",   color: "#C084FC" },
  { bg: "rgba(52,211,153,0.15)",   color: "#34D399" },
];

function getStyle(seed: string) {
  const index = (seed.charCodeAt(0) + (seed.charCodeAt(1) || 0)) % PALETTE.length;
  return PALETTE[index];
}

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ name, size = 36, className = "" }: AvatarProps) {
  const { bg, color } = getStyle(name);
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const fontSize = size * 0.38;
  const radius = size * 0.5;

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center font-bold ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        color,
        fontSize,
      }}
    >
      {initials}
    </div>
  );
}

/** Overlapping stack of up to 3 avatars + overflow badge */
export function AvatarStack({ names, size = 30 }: { names: string[]; size?: number }) {
  const visible = names.slice(0, 3);
  const overflow = names.length - visible.length;

  return (
    <div className="flex items-center" style={{ marginLeft: size * 0.3 }}>
      {visible.map((name, i) => (
        <div
          key={i}
          style={{ marginLeft: i === 0 ? 0 : -(size * 0.3), zIndex: visible.length - i }}
        >
          <Avatar
            name={name}
            size={size}
            className="ring-2 ring-[var(--bg-surface-1)]"
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center text-xs font-bold ring-2"
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.5,
            background: "var(--bg-surface-3)",
            color: "var(--text-muted)",
            marginLeft: -(size * 0.3),
            zIndex: 0,
            fontSize: size * 0.34,
            border: "2px solid var(--bg-surface-1)",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
