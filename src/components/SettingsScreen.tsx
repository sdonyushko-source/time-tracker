import { useState, useEffect, useRef } from "react";
import { Task, getSettings, saveSettings, getTasks, createTask, deleteTask } from "../db";


function currencySymbol(c: string): string {
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  if (c === "RUB") return "₽";
  return c;
}

const TrashIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 9.5L17.3448 16.3792C17.181 18.0994 17.0991 18.9595 16.5269 19.4797C15.9548 20 15.0908 20 13.3629 20H10.6371C8.90921 20 8.04524 20 7.47307 19.4797C6.9009 18.9595 6.81899 18.0994 6.65517 16.3792L6 9.5M5 7H9M19 7H15M15 7C15 6.06812 15 5.60218 14.8478 5.23463C14.6448 4.74458 14.2554 4.35523 13.7654 4.15224C13.3978 4 12.9319 4 12 4C11.0681 4 10.6022 4 10.2346 4.15224C9.74458 4.35523 9.35523 4.74458 9.15224 5.23463C9 5.60218 9 6.06812 9 7M15 7L9 7" stroke="#181A2C" strokeWidth="1.5" strokeLinecap="round"/>
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
  const [goalH, setGoalH] = useState("6");
  const [goalM, setGoalM] = useState("0");
  const [goalS, setGoalS] = useState("0");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [s, t] = await Promise.all([getSettings(), getTasks()]);
      setCurrency(s.currency);
      setHourlyRate(String(s.hourlyRate));
      setGoalH(String(Math.floor(s.dailyGoalSeconds / 3600)));
      setGoalM(String(Math.floor((s.dailyGoalSeconds % 3600) / 60)));
      setGoalS(String(s.dailyGoalSeconds % 60));
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
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    await saveSettings({
      hourlyRate: Number(hourlyRate),
      currency,
      dailyGoalSeconds: (parseInt(goalH) || 0) * 3600 + (parseInt(goalM) || 0) * 60 + (parseInt(goalS) || 0),
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
              <div style={{
                ...inputBase,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
              }}>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "none",
                    fontSize: 16,
                    color: "#181A2C",
                    fontFamily: "'Inter', sans-serif",
                    appearance: "none",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="RUB">RUB</option>
                </select>
                <ChevronDown />
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
              <style>{`.goal-num::-webkit-inner-spin-button,.goal-num::-webkit-outer-spin-button{display:none}`}</style>
              <span style={labelStyle}>Daily goal</span>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                height: 48,
                background: "white",
                border: "1px solid #E3E5EA",
                borderRadius: 8,
                padding: "12px 16px",
                boxSizing: "border-box",
              }}>
                <input
                  className="goal-num"
                  type="number"
                  min={0}
                  max={99}
                  value={goalH}
                  onChange={(e) => setGoalH(e.target.value)}
                  style={{ width: 40, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#181A2C", outline: "none", padding: 0 }}
                />
                <span style={{ color: "#181A2C", fontSize: 16, fontFamily: "'Inter', sans-serif" }}>:</span>
                <input
                  className="goal-num"
                  type="number"
                  min={0}
                  max={59}
                  value={goalM}
                  onChange={(e) => setGoalM(e.target.value)}
                  style={{ width: 40, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#181A2C", outline: "none", padding: 0 }}
                />
                <span style={{ color: "#181A2C", fontSize: 16, fontFamily: "'Inter', sans-serif" }}>:</span>
                <input
                  className="goal-num"
                  type="number"
                  min={0}
                  max={59}
                  value={goalS}
                  onChange={(e) => setGoalS(e.target.value)}
                  style={{ width: 40, border: "none", background: "transparent", textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 16, color: "#181A2C", outline: "none", padding: 0 }}
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
            {!isAddingTask ? (
              <span
                onClick={() => setIsAddingTask(true)}
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", lineHeight: "24px", cursor: "pointer" }}
              >
                Add
              </span>
            ) : (
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
            <div
              key={task.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}
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
                onClick={() => handleDeleteTask(task.id)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <TrashIcon />
              </button>
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
