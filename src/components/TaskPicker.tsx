import { Task } from "../db";

interface TaskPickerProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelect: (id: string) => void;
  color?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function TaskPicker({ tasks, selectedTaskId, onSelect, color = "#181A2C", onMouseEnter, onMouseLeave }: TaskPickerProps) {
  return (
    <select
      value={selectedTaskId}
      onChange={(e) => onSelect(e.target.value)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: 182,
        flexShrink: 0,
        fontSize: 16,
        color,
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
      }}
    >
      {tasks.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
