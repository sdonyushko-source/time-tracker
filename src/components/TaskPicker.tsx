import { Task } from "../db";
import { useTheme } from "../ThemeContext";

interface TaskPickerProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelect: (id: string) => void;
  color?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function TaskPicker({ tasks, selectedTaskId, onSelect, color, onMouseEnter, onMouseLeave }: TaskPickerProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.textPrimary;
  return (
    <select
      value={selectedTaskId}
      onChange={(e) => onSelect(e.target.value)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: 214,
        flexShrink: 0,
        fontSize: 16,
        color: resolvedColor,
        background: "none",
        border: "none",
        outline: "none",
        cursor: "pointer",
        padding: 0,
        fontFamily: "'Inter', sans-serif",
        WebkitAppearance: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "color 0.3s ease",
      }}
    >
      {tasks.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
