import { useState, useEffect, useRef } from "react";
import { Task, getSettings, saveSettings, getTasks, createTask, deleteTask, renameTask } from "../db";


function currencySymbol(c: string): string {
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  if (c === "RUB") return "₽";
  return c;
}

const ThreeDotsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="5" r="1.5" fill="#181A2C"/>
    <circle cx="12" cy="12" r="1.5" fill="#181A2C"/>
    <circle cx="12" cy="19" r="1.5" fill="#181A2C"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 6L8 10L12 6" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface SettingsScreenProps {
  onClose: () => void;
  onSave: () => void;
}

const inputBase: React.CSSProperties = {
  height: 48,
  background: "white",
  border: "1px solid #E3E5EA",
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 16,
  color: "#181A2C",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  fontWeight: 400,
  color: "#181A2C",
  lineHeight: "20px",
};

export default function SettingsScreen({ onClose, onSave }: SettingsScreenProps) {
  const [currency, setCurrency] = useState("USD");
  const [hourlyRate, setHourlyRate] = useState("30");
  const [goalH, setGoalH] = useState("06");
  const [goalM, setGoalM] = useState("00");
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
      const [s, t] = await Promise.all([getSettings(), getTasks()]);
      setCurrency(s.currency);
      setHourlyRate(String(s.hourlyRate));
      setGoalH(String(Math.floor(s.dailyGoalSeconds / 3600)).padStart(2, "0"));
      setGoalM(String(Math.floor((s.dailyGoalSeconds % 3600) / 60)).padStart(2, "0"));
      setTasks(t);
    })();
  }, []);

  const handleSaveTask = async () => {
    const name = (newTaskInputRef.current?.value ?? newTaskName).trim();
    if (!name) return;
    try {
      await createTask(name);
      const updated = await getTasks();
      setTasks(updated);
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
    if (!window.confirm("Delete this task?")) return;
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

  const handleSave = async () => {
    await saveSettings({
      hourlyRate: Number(hourlyRate),
      currency,
      dailyGoalSeconds: (parseInt(goalH) || 0) * 3600 + (parseInt(goalM) || 0) * 60,
    });
    onSave();
  };

  return (
    <div style={{
      width: 440,
      minHeight: 520,
      background: "white",
      borderRadius: 16,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>

        {/* Heading */}
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: 20,
          lineHeight: "24px",
          color: "#181A2C",
        }}>
          Settings
        </span>

        {/* ── Tracking block ── */}
        <div style={{
          marginTop: 12,
          background: "#F6F6F6",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#181A2C", lineHeight: "24px" }}>
            Tracking
          </span>

          <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>

            {/* Currency */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>Currency</span>
              <div style={{ position: "relative" }}>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{
                    height: 48,
                    width: "100%",
                    background: "white",
                    border: "1px solid #E3E5EA",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 16,
                    color: "#181A2C",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="RUB">RUB</option>
                  <option value="GBP">GBP</option>
                </select>
                <div style={{ position: "absolute", right: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", pointerEvents: "none" }}>
                  <ChevronDown />
                </div>
              </div>
            </div>

            {/* Hourly rate */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>Hourly rate</span>
              <div style={{
                ...inputBase,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 16px",
              }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{
                    flex: 1,
                    width: 0,
                    border: "none",
                    background: "none",
                    fontSize: 16,
                    color: "#181A2C",
                    fontFamily: "'Inter', sans-serif",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: 16, color: "#908F8F", fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>
                  {currencySymbol(currency)}
                </span>
              </div>
            </div>

            {/* Daily goal */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>Daily goal</span>
              <div style={{
                display: "flex",
                alignItems: "center",
                height: 48,
                background: "white",
                border: "1px solid #E3E5EA",
                borderRadius: 8,
                padding: "0 16px",
                boxSizing: "border-box",
              }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={goalH}
                  onChange={(e) => setGoalH(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={() => setGoalH((v) => v.padStart(2, "0"))}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ width: 28, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#181A2C", outline: "none", padding: 0 }}
                />
                <span style={{ color: "#181A2C", fontSize: 16, fontFamily: "'Inter', sans-serif" }}>:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={goalM}
                  onChange={(e) => setGoalM(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={() => setGoalM((v) => v.padStart(2, "0"))}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ width: 28, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#181A2C", outline: "none", padding: 0 }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* ── Tasks block ── */}
        <div style={{
          marginTop: 12,
          background: "#F6F6F6",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#181A2C", lineHeight: "24px" }}>
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
                /* Rename inline UI — buttons are in the header */
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
                /* Normal row */
                <div
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", position: "relative" }}
                >
                  <span style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 16,
                    color: "#181A2C",
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
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, opacity: hoveredTaskId === task.id || openMenuId === task.id ? 1 : 0 }}
                  >
                    <ThreeDotsIcon />
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
                        background: "white",
                        borderRadius: 8,
                        padding: 8,
                        boxShadow: "0px 8px 12px rgba(24,26,44,0.12)",
                        zIndex: 99,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 120,
                      }}>
                        <div
                          onClick={() => { setOpenMenuId(null); setRenamingId(task.id); setRenameValue(task.name); }}
                          style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#181A2C" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#F6F6F6")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          Rename
                        </div>
                        <div
                          onClick={() => { setOpenMenuId(null); handleDeleteTask(task.id); }}
                          style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#FF5429" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#F6F6F6")}
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

        {/* ── Cancel / Save buttons ── */}
        <div style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
        }}>
          <button
            onClick={onClose}
            style={{
              width: 96,
              height: 48,
              background: "#F6F6F6",
              borderRadius: 8,
              border: "none",
              fontSize: 16,
              fontWeight: 400,
              color: "#181A2C",
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              width: 96,
              height: 48,
              background: "linear-gradient(168deg, #8FD75F 15.3%, #31D877 85.2%)",
              boxShadow: "0px 4px 10px rgba(33,152,81,0.3)",
              borderRadius: 8,
              border: "none",
              fontSize: 16,
              fontWeight: 400,
              color: "white",
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>

      </div>
    </div>
  );
}
