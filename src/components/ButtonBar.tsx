import { useTheme } from "../ThemeContext";

interface ButtonBarProps {
  cancelLabel?: string;
  saveLabel?: string;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  // When true, renders only the save/action button, stretched to fill the
  // whole bar. Used by screens (e.g. Statistics) that have nothing to
  // cancel — there's no draft to discard, just one action to take.
  hideCancel?: boolean;
}

const TrashIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 9.5L17.3448 16.3792C17.181 18.0994 17.0991 18.9595 16.5269 19.4797C15.9548 20 15.0908 20 13.3629 20H10.6371C8.90921 20 8.04524 20 7.47307 19.4797C6.9009 18.9595 6.81899 18.0994 6.65517 16.3792L6 9.5M5 7H9M19 7H15M15 7C15 6.06812 15 5.60218 14.8478 5.23463C14.6448 4.74458 14.2554 4.35523 13.7654 4.15224C13.3978 4 12.9319 4 12 4C11.0681 4 10.6022 4 10.2346 4.15224C9.74458 4.35523 9.35523 4.74458 9.15224 5.23463C9 5.60218 9 6.06812 9 7M15 7L9 7" stroke="#FF5429" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Sticks to the bottom of a 440-wide screen and floats over scrollable
// content (the screen must be `position: relative` and its scroll area
// needs bottom padding >= this bar's height so content can clear it).
export default function ButtonBar({ cancelLabel = "Cancel", saveLabel = "Save", onCancel, onSave, onDelete, hideCancel }: ButtonBarProps) {
  const { colors } = useTheme();

  const buttonStyle: React.CSSProperties = {
    flex: "1 0 0",
    minWidth: 0,
    height: 32,
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    // A bare <button> with just a fixed height relies on the browser's
    // default line-height/padding to center its text, which drifts the
    // label off-center — flex centering makes it exact regardless of UA
    // defaults.
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };

  return (
    <div style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      background: colors.pageBg,
      display: "flex",
      alignItems: "center",
      justifyContent: onDelete ? "space-between" : "flex-end",
      padding: "8px 24px 20px",
      boxSizing: "border-box",
    }}>
      {onDelete && (
        <button onClick={onDelete} style={{ width: 32, height: 32, padding: 4, background: "none", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <TrashIcon />
        </button>
      )}
      {hideCancel ? (
        <button onClick={onSave} style={{ ...buttonStyle, background: "linear-gradient(170deg, #8FD75F 15.3%, #31D877 85.2%)", color: "white" }}>
          {saveLabel}
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, width: 168, flexShrink: 0 }}>
          <button onClick={onCancel} style={{ ...buttonStyle, background: colors.cardBg, color: colors.textPrimary }}>
            {cancelLabel}
          </button>
          <button onClick={onSave} style={{ ...buttonStyle, background: "linear-gradient(170deg, #8FD75F 15.3%, #31D877 85.2%)", color: "white" }}>
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}
