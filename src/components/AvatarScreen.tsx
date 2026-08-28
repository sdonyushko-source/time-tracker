import { useState } from "react";
import { useTheme } from "../ThemeContext";
import ButtonBar from "./ButtonBar";
import TitleBarSpacer from "./TitleBarSpacer";
import ClientAvatar, { AVATAR_COLORS, AVATAR_EMOJI } from "./ClientAvatar";

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

interface AvatarScreenProps {
  name: string | null;
  avatarColor: string | null;
  avatarEmoji: string | null;
  onCancel: () => void;
  onSave: (avatarColor: string | null, avatarEmoji: string | null) => void;
}

// Sub-editor of ClientScreen's own edit mode — Cancel/Save here just
// resolve this draft pick back up to ClientScreen's local state (avatarColor
// /avatarEmoji), the same as every other field there; nothing is written to
// the client row until ClientScreen's own Save runs updateClient/createClient.
export default function AvatarScreen({ name, avatarColor, avatarEmoji, onCancel, onSave }: AvatarScreenProps) {
  const { colors } = useTheme();
  // Defaults to the first palette color rather than staying null — so a
  // color is always available to persist the moment an emoji gets picked,
  // per ClientAvatar's "avatarEmoji set -> filled with avatarColor" contract.
  const [selectedColor, setSelectedColor] = useState(avatarColor ?? AVATAR_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(avatarEmoji);

  const ringStyle = (selected: boolean): React.CSSProperties =>
    selected ? { boxShadow: `0 0 0 2px ${colors.pageBg}, 0 0 0 4px ${colors.textPrimary}` } : {};

  const sectionLabelStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: colors.textSecondary,
  };

  const iconCellBase: React.CSSProperties = {
    aspectRatio: "1",
    borderRadius: 8,
    background: colors.inputBg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  const iconCellStyle = (selected: boolean): React.CSSProperties => ({
    ...iconCellBase,
    border: selected ? `2px solid ${colors.textPrimary}` : `1px solid ${colors.border}`,
  });

  return (
    <div style={{
      width: 440,
      height: "100vh",
      background: colors.pageBg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxSizing: "border-box",
      position: "relative",
    }}>
      <TitleBarSpacer />
      <div style={{ flexShrink: 0, padding: "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 20, lineHeight: "24px", color: colors.textPrimary }}>
          Avatar
        </span>
        <button onClick={onCancel} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <CloseIcon color={colors.textPrimary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 84px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
          <ClientAvatar name={name} avatarColor={selectedColor} avatarEmoji={selectedEmoji} size={72} />
        </div>

        <div style={{ background: colors.cardBg, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={sectionLabelStyle}>Color</span>
          <div style={{ display: "flex", gap: 8 }}>
            {AVATAR_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{ flex: 1, aspectRatio: "1", borderRadius: "50%", background: c, cursor: "pointer", ...ringStyle(selectedColor === c) }}
              />
            ))}
          </div>
        </div>

        <div style={{ background: colors.cardBg, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={sectionLabelStyle}>Icon</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {/* Letter option — not an emoji, returns to today's letter/dash
                avatar. Kept a first-class choice, not just what you get by
                never touching this screen. */}
            <div onClick={() => setSelectedEmoji(null)} style={iconCellStyle(selectedEmoji === null)}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>
                {name && name.trim() ? name.trim().charAt(0).toUpperCase() : "—"}
              </span>
            </div>
            {AVATAR_EMOJI.map((e) => (
              <div key={e} onClick={() => setSelectedEmoji(e)} style={iconCellStyle(selectedEmoji === e)}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{e}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ButtonBar cancelLabel="Cancel" saveLabel="Save" onCancel={onCancel} onSave={() => onSave(selectedColor, selectedEmoji)} />
    </div>
  );
}
