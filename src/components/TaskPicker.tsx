import { invoke } from "@tauri-apps/api/core";
import { Task } from "../db";
import { useTheme } from "../ThemeContext";

export interface TaskPickerGroup {
  label: string;
  tasks: Task[];
}

interface TaskPickerProps {
  tasks: Task[];
  // Present (2+ entries) only when there are 2+ visible clients — see
  // computeVisibleClients in utils.ts. Below that threshold this stays
  // null/undefined and the picker renders as the plain flat <select> it
  // always was, unchanged.
  clientGroups?: TaskPickerGroup[] | null;
  selectedTaskId: string;
  onSelect: (id: string) => void;
  color?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const pickerTextStyle: React.CSSProperties = {
  width: 214,
  flexShrink: 0,
  fontSize: 16,
  background: "none",
  border: "none",
  outline: "none",
  cursor: "pointer",
  padding: 0,
  fontFamily: "'Inter', sans-serif",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  transition: "color 0.3s ease",
  textAlign: "left",
};

export default function TaskPicker({ tasks, clientGroups, selectedTaskId, onSelect, color, onMouseEnter, onMouseLeave }: TaskPickerProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.textPrimary;

  if (clientGroups && clientGroups.length >= 2) {
    const selectedName = tasks.find((t) => t.id === selectedTaskId)?.name ?? "";
    return (
      <button
        onClick={() =>
          invoke("show_task_picker_menu", {
            groups: clientGroups.map((g) => ({
              label: g.label,
              tasks: g.tasks.map((t) => ({ id: t.id, name: t.name })),
            })),
          })
        }
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ ...pickerTextStyle, color: resolvedColor, WebkitAppearance: "none" }}
      >
        {selectedName}
      </button>
    );
  }

  return (
    <select
      value={selectedTaskId}
      onChange={(e) => onSelect(e.target.value)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ ...pickerTextStyle, color: resolvedColor, WebkitAppearance: "none" }}
    >
      {tasks.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
