import { useState, useEffect, useRef } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Task, getTasks, createTask, deleteTask, renameTask } from "../db";
import { useTheme } from "../ThemeContext";
import TitleBarSpacer from "./TitleBarSpacer";

const ThreeDotsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="5" r="1.5" fill={color}/>
    <circle cx="12" cy="12" r="1.5" fill={color}/>
    <circle cx="12" cy="19" r="1.5" fill={color}/>
  </svg>
);

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

interface TaskManagerScreenProps {
  onClose: () => void;
}

export default function TaskManagerScreen({ onClose }: TaskManagerScreenProps) {
  const { colors } = useTheme();
  const inputBase: React.CSSProperties = {
    height: 48,
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setTasks(await getTasks());
    })();
  }, []);

  const handleSaveTask = async () => {
    const name = (newTaskInputRef.current?.value ?? newTaskName).trim();
    if (!name) return;
    try {
      await createTask(name);
      setTasks(await getTasks());
      setNewTaskName("");
      setIsAddingTask(false);
    } catch (err) {
      console.error("createTask failed:", err);
    }
  };

  const handleCancelTask = () => {
    setNewTaskName("");
    setIsAddingTask(false);
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await confirm("Are you sure you want to delete this task?", { title: "Delete task", kind: "warning" });
    if (!ok) return;
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRenameTask = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    await renameTask(id, name);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div style={{
      width: 440,
      height: "100vh",
      background: colors.pageBg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxSizing: "border-box",
    }}>
      <TitleBarSpacer />
      {/* Heading */}
      <div style={{ flexShrink: 0, padding: "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: 20,
          lineHeight: "24px",
          color: colors.textPrimary,
        }}>
          Task manager
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <CloseIcon color={colors.textPrimary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 24px" }}>
        {/* ── Tasks block ── */}
        <div style={{
          background: colors.cardBg,
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: colors.textPrimary, lineHeight: "24px" }}>
              Tasks
            </span>
            {!isAddingTask && !renamingId ? (
              <span
                onClick={() => setIsAddingTask(true)}
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", lineHeight: "24px", cursor: "pointer" }}
              >
                Add
              </span>
            ) : isAddingTask ? (
              <div style={{ display: "flex", gap: 20 }}>
                <span
                  onClick={handleCancelTask}
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#FF5429", lineHeight: "24px", cursor: "pointer" }}
                >
                  Cancel
                </span>
                <span
                  onClick={handleSaveTask}
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", lineHeight: "24px", cursor: "pointer" }}
                >
                  Save
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 20 }}>
                <span
                  onClick={() => { setRenamingId(null); setRenameValue(""); }}
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#FF5429", lineHeight: "24px", cursor: "pointer" }}
                >
                  Cancel
                </span>
                <span
                  onClick={() => handleRenameTask(renamingId!)}
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", lineHeight: "24px", cursor: "pointer" }}
                >
                  Save
                </span>
              </div>
            )}
          </div>

          {/* New task input */}
          {isAddingTask && (
            <input
              ref={newTaskInputRef}
              autoFocus
              type="text"
              placeholder="Task name"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTask();
                if (e.key === "Escape") handleCancelTask();
              }}
              style={{ ...inputBase, width: "100%" }}
            />
          )}

          {/* Task list */}
          {tasks.map((task) => (
            <div key={task.id}>
              {renamingId === task.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameTask(task.id);
                    if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                  }}
                  style={{ ...inputBase, width: "100%" }}
                />
              ) : (
                <div
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", position: "relative" }}
                >
                  <span style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 16,
                    color: colors.textPrimary,
                    lineHeight: "24px",
                    maxWidth: 304,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {task.name}
                  </span>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, opacity: hoveredTaskId === task.id || openMenuId === task.id ? 1 : 0, transition: "opacity 0.3s ease" }}
                  >
                    <ThreeDotsIcon color={colors.textPrimary} />
                  </button>
                  {openMenuId === task.id && (
                    <>
                      <div
                        onClick={() => setOpenMenuId(null)}
                        style={{ position: "fixed", inset: 0, zIndex: 98 }}
                      />
                      <div style={{
                        position: "absolute",
                        top: 36,
                        right: 0,
                        background: colors.menuBg,
                        borderRadius: 8,
                        padding: 8,
                        boxShadow: colors.menuShadow,
                        zIndex: 99,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 120,
                      }}>
                        <div
                          onClick={() => { setOpenMenuId(null); setRenamingId(task.id); setRenameValue(task.name); }}
                          style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: colors.textPrimary, transition: "background 0.3s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = colors.menuItemHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          Rename
                        </div>
                        <div
                          onClick={() => { setOpenMenuId(null); handleDeleteTask(task.id); }}
                          style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#FF5429", transition: "background 0.3s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = colors.menuItemHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          Delete
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
