import { useState } from "react";
import { useTheme } from "../ThemeContext";

// Theme-independent, like #34C759 and the Play/Stop gradients — an
// avatar's color reads the same in light and dark, so it lives here as a
// flat constant rather than in theme.ts. Picked to stay legible on both
// #FFFFFF and #101010. The teal is deliberately pulled toward blue so it
// never reads as the same green as #34C759 (the active-task dot) —
// don't "fix" it toward a greener teal.
export const AVATAR_COLORS = [
  "#A8B4E8", "#FFA694", "#FFCC7A", "#A8DD8F",
  "#7FD6D6", "#8FC4F0", "#C2A9F0", "#FFA3C4",
];

// Emoji only — SF Symbols aren't usable as a webview font (private,
// undocumented codepoints that drift between macOS versions), and this
// avoids pulling in an icon library or network font.
export const AVATAR_EMOJI = [
  "💼", "🏢", "🎨", "💻", "📱", "🚀", "⚡", "🔧", "📊", "🎯", "🧩", "🌱",
  "📚", "🎬", "🎸", "🔬", "🗿", "👽", "🦊", "🤖", "🌟", "✨", "🔥",
];

const EditIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.72 11.76L18.0625 11.4175C19.3542 10.1258 20 9.48002 20 8.67749C20 7.87496 19.3542 7.22913 18.0625 5.93748C16.7709 4.64583 16.125 4 15.3225 4C14.52 4 13.8742 4.64583 12.5825 5.93748L6.70669 11.8133C5.88314 12.6368 5.47137 13.0486 5.20064 13.5545C4.9299 14.0604 4.8157 14.6314 4.58729 15.7734L4.24742 17.4728C3.98965 18.7616 3.86077 19.406 4.22737 19.7726C4.59397 20.1392 5.2384 20.0104 6.52725 19.7526L8.22657 19.4127C9.36863 19.1843 9.93965 19.0701 10.4455 18.7994C10.9514 18.5286 11.3632 18.1169 12.1867 17.2933L17.72 11.76ZM17.72 11.76L14.98 9.01999" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

interface ClientAvatarProps {
  // Decoupled from Client (db.ts) so this also renders a live draft
  // selection on AvatarScreen before it's ever saved to a client row.
  name: string | null;
  avatarColor: string | null;
  avatarEmoji: string | null;
  size: 36 | 72;
  onClick?: () => void;
}

export default function ClientAvatar({ name, avatarColor, avatarEmoji, size, onClick }: ClientAvatarProps) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const hasName = !!name && !!name.trim();
  const emojiSize = size === 72 ? 34 : 18;
  const letterSize = Math.round(size * 0.42);
  const editIconSize = Math.round(size * 0.56);

  // A plain div (not <button>) either way — a disabled button can pick up
  // browser default dimming, and the view-mode (no onClick) rendering must
  // look pixel-identical to the clickable one, just inert.
  const circleStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: onClick ? "pointer" : "default",
    position: "relative",
    ...(avatarEmoji
      ? { background: avatarColor ?? AVATAR_COLORS[0] }
      : {
          // Letter/dash mode — keyed on whether the client actually has a
          // name, not on isDefault: a renamed default client ("No client"
          // -> a real name, see ClientScreen) gets its own letter too,
          // same as a named client, and isDefault never flips back off
          // for it (see backfillClients in db.ts).
          background: hasName ? colors.inputBg : "none",
          border: hasName ? `1px solid ${colors.border}` : `1px dashed ${colors.border}`,
        }),
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={circleStyle}
    >
      {avatarEmoji ? (
        <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{avatarEmoji}</span>
      ) : (
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: letterSize,
          fontWeight: hasName ? 600 : 500,
          color: hasName ? colors.textPrimary : colors.textSecondary,
          lineHeight: 1,
        }}>
          {hasName ? (name as string).trim().charAt(0).toUpperCase() : "—"}
        </span>
      )}
      {/* Always mounted (when clickable) rather than conditionally
          rendered, so opacity can transition instead of popping in/out —
          view mode never gets an onClick, so it never gets this at all. */}
      {onClick && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s ease",
          pointerEvents: "none",
        }}>
          <EditIcon size={editIconSize} />
        </div>
      )}
    </div>
  );
}
