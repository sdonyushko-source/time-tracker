import { useState } from "react";
import { Task } from "../db";

interface TaskPickerProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelect: (id: string) => void;
}

export default function TaskPicker({ tasks, selectedTaskId, onSelect }: TaskPickerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{
      position: "absolute",
      top: 108,
      left: 8,
      width: 424,
      background: "white",
      borderRadius: 12,
      padding: 8,
      boxShadow: "0px 8px 12px rgba(0,0,0,0.12)",
      zIndex: 100,
    }}>
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onSelect(task.id)}
          onMouseEnter={() => setHoveredId(task.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: 8,
            width: "100%",
            background: hoveredId === task.id ? "#F6F6F6" : "white",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          <span style={{
            fontSize: 16,
            color: "#181A2C",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            fontFamily: "'Inter', sans-serif",
          }}>
            {task.name}
          </span>
          {task.id === selectedTaskId && (
            <span style={{
              color: "#181A2C",
              fontSize: 16,
              flexShrink: 0,
              marginLeft: 8,
              fontFamily: "'Inter', sans-serif",
            }}>
              ✓
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
