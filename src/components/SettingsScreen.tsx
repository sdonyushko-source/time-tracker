import { useState, useEffect } from "react";
import { Task, getSettings, saveSettings, getTasks, createTask, deleteTask } from "../db";

function parseDailyGoal(str: string): number {
  const parts = str.split(":");
  if (parts.length !== 3) return 0;
  return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0);
}

function formatDailyGoal(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

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

export default function SettingsScreen({ onClose, onSave }: SettingsScreenProps) {
  const [currency, setCurrency] = useState("USD");
  const [hourlyRate, setHourlyRate] = useState("30");
  const [dailyGoal, setDailyGoal] = useState("06:00:00");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  useEffect(() => {
    (async () => {
      const [s, t] = await Promise.all([getSettings(), getTasks()]);
      setCurrency(s.currency);
      setHourlyRate(String(s.hourlyRate));
      setDailyGoal(formatDailyGoal(s.dailyGoalSeconds));
      setTasks(t);
    })();
  }, []);

  const handleCreateTask = async () => {
    const name = newTaskName.trim();
    if (!name) return;
    await createTask(name);
    const updated = await getTasks();
    setTasks(updated);
    setIsAddingTask(false);
    setNewTaskName("");
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    await saveSettings({
      hourlyRate: Number(hourlyRate),
      currency,
      dailyGoalSeconds: parseDailyGoal(dailyGoal),
    });
    onSave();
  };

  return (
    <div style={{
      width: 440,
      minHeight: 520,
      background: "white",
      borderRadius: 16,
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Titlebar */}
      <div style={{
        height: 40,
        borderBottom: "1px solid #E3E5EA",
      }} />

      {/* Heading */}
      <span style={{
        position: "absolute",
        top: 64,
        left: 24,
        fontSize: 20,
        fontWeight: 500,
        color: "#181A2C",
        fontFamily: "'Inter', sans-serif",
        lineHeight: "28px",
      }}>
        Settings
      </span>

      {/* Tracking block */}
      <div style={{
        position: "absolute",
        top: 100,
        left: 24,
        width: 392,
        background: "#F6F6F6",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxSizing: "border-box",
      }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", fontFamily: "'Inter', sans-serif", lineHeight: "24px" }}>
          Tracking
        </span>

        <div style={{ display: "flex", gap: 8 }}>

          {/* Currency */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, color: "#181A2C", fontFamily: "'Inter', sans-serif", lineHeight: "20px" }}>
              Currency
            </span>
            <div style={{
              height: 48,
              background: "white",
              border: "1px solid #E3E5EA",
              borderRadius: 8,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
                  fontFamily: "'DM Sans', sans-serif",
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
            <span style={{ fontSize: 14, color: "#181A2C", fontFamily: "'Inter', sans-serif", lineHeight: "20px" }}>
              Hourly rate
            </span>
            <div style={{
              height: 48,
              background: "white",
              border: "1px solid #E3E5EA",
              borderRadius: 8,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  background: "none",
                  fontSize: 16,
                  color: "#181A2C",
                  fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                  width: 0,
                }}
              />
              <span style={{ fontSize: 16, color: "#908F8F", fontFamily: "'DM Sans', sans-serif" }}>
                {currencySymbol(currency)}
              </span>
            </div>
          </div>

          {/* Daily goal */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, color: "#181A2C", fontFamily: "'Inter', sans-serif", lineHeight: "20px" }}>
              Daily goal
            </span>
            <input
              type="text"
              placeholder="06:00:00"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              style={{
                height: 48,
                width: "100%",
                background: "white",
                border: "1px solid #E3E5EA",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 16,
                color: "#181A2C",
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

        </div>
      </div>

      {/* Tasks block */}
      <div style={{
        position: "absolute",
        top: 236,
        left: 24,
        width: 392,
        background: "#F6F6F6",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxSizing: "border-box",
      }}>

        {/* Tasks header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", fontFamily: "'Inter', sans-serif", lineHeight: "24px" }}>
            Tasks
          </span>
          {!isAddingTask ? (
            <span
              onClick={() => setIsAddingTask(true)}
              style={{ fontSize: 16, fontWeight: 500, color: "#7381D3", cursor: "pointer", fontFamily: "'Inter', sans-serif", lineHeight: "24px" }}
            >
              Add
            </span>
          ) : (
            <div style={{ display: "flex", gap: 20 }}>
              <span
                onClick={() => { setIsAddingTask(false); setNewTaskName(""); }}
                style={{ fontSize: 16, fontWeight: 500, color: "#FF5429", cursor: "pointer", fontFamily: "'Inter', sans-serif", lineHeight: "24px" }}
              >
                Cancel
              </span>
              <span
                onClick={handleCreateTask}
                style={{ fontSize: 16, fontWeight: 500, color: "#7381D3", cursor: "pointer", fontFamily: "'Inter', sans-serif", lineHeight: "24px" }}
              >
                Save
              </span>
            </div>
          )}
        </div>

        {/* New task input */}
        {isAddingTask && (
          <input
            autoFocus
            type="text"
            placeholder="Task name"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateTask();
              if (e.key === "Escape") { setIsAddingTask(false); setNewTaskName(""); }
            }}
            style={{
              height: 48,
              width: "100%",
              background: "white",
              border: "1px solid #E3E5EA",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 16,
              color: "#181A2C",
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}

        {/* Task list */}
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
            }}
          >
            <span style={{
              fontSize: 16,
              color: "#181A2C",
              fontFamily: "'Inter', sans-serif",
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

      {/* Cancel / Save buttons */}
      <div style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        display: "flex",
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
            color: "#181A2C",
            fontFamily: "'DM Sans', sans-serif",
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
            color: "white",
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>

    </div>
  );
}
