import { useState, useEffect, useRef } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Client, Task, getTasks, createTask, deleteTask, renameTask, createClient, updateClient, deleteClient } from "../db";
import { resolveClientId } from "../utils";
import { useTheme } from "../ThemeContext";
import ButtonBar from "./ButtonBar";
import Tooltip from "./Tooltip";
import TitleBarSpacer from "./TitleBarSpacer";
import ClientAvatar from "./ClientAvatar";
import AvatarScreen from "./AvatarScreen";

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ThreeDotsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="5" r="1.5" fill={color}/>
    <circle cx="12" cy="12" r="1.5" fill={color}/>
    <circle cx="12" cy="19" r="1.5" fill={color}/>
  </svg>
);

const ChevronDown = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 6L8 10L12 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.2"/>
    <rect x="7.3" y="6.8" width="1.4" height="4.2" rx="0.7" fill={color}/>
    <rect x="7.3" y="4.6" width="1.4" height="1.4" rx="0.7" fill={color}/>
  </svg>
);

interface ClientScreenProps {
  client: Client | null; // null = New client
  defaultClientId: string;
  onClose: () => void;
}

const nativeSelectStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  border: "none",
};

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 12,
  fontWeight: 400,
};

export default function ClientScreen({ client, defaultClientId, onClose }: ClientScreenProps) {
  const { colors } = useTheme();
  const isNew = client === null;
  const [editing, setEditing] = useState(isNew);

  const [name, setName] = useState(client?.name ?? "");
  const [isPaid, setIsPaid] = useState(client ? !!client.isPaid : true);
  const [rate, setRate] = useState(String(client?.rate ?? 0));
  const [commission, setCommission] = useState(String(client?.commission ?? 0));
  const [avatarColor, setAvatarColor] = useState<string | null>(client?.avatarColor ?? null);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(client?.avatarEmoji ?? null);
  const [openAvatar, setOpenAvatar] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  const refreshTasks = () => {
    if (!client) return;
    getTasks().then((t) => setTasks(t.filter((task) => resolveClientId(task, defaultClientId) === client.id)));
  };

  useEffect(() => { refreshTasks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const inputBase: React.CSSProperties = {
    height: 48,
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "0 16px",
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const compactInputStyle: React.CSSProperties = {
    height: 32,
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
  };

  const selectWrapStyle: React.CSSProperties = {
    ...compactInputStyle,
    cursor: "pointer",
    position: "relative",
    justifyContent: "space-between",
  };

  const resetEditFields = () => {
    setName(client?.name ?? "");
    setIsPaid(client ? !!client.isPaid : true);
    setRate(String(client?.rate ?? 0));
    setCommission(String(client?.commission ?? 0));
    setAvatarColor(client?.avatarColor ?? null);
    setAvatarEmoji(client?.avatarEmoji ?? null);
  };

  const handleEditCancel = () => {
    resetEditFields();
    if (isNew) onClose();
    else setEditing(false);
  };

  const handleEditSave = async () => {
    const trimmed = name.trim();
    const rateNum = Number(rate) || 0;
    const commissionNum = Number(commission) || 0;
    if (client) {
      await updateClient(client.id, trimmed || null, isPaid, rateNum, commissionNum, avatarColor, avatarEmoji);
      // View mode (below) reads these same local fields, not the `client`
      // prop — which stays the object this screen was opened with and
      // never refreshes itself. Normalize name/rate/commission to exactly
      // what was just persisted (trimmed, numeric) so the input's raw
      // string doesn't leak into the view-mode display — avatarColor/
      // avatarEmoji/isPaid need no normalization, they're already exact.
      setName(trimmed);
      setRate(String(rateNum));
      setCommission(String(commissionNum));
      setEditing(false);
    } else {
      if (!trimmed) return;
      await createClient(trimmed, isPaid, rateNum, commissionNum, avatarColor, avatarEmoji);
      onClose();
    }
  };

  // Only ever passed to ButtonBar for an existing, non-default client — see
  // below (never for isNew, and the default client is never deleted).
  const handleDeleteClient = async () => {
    if (!client) return;
    const ok = await confirm(
      "Are you sure you want to delete this client? Its tasks and tracked time stay — they just move to No client.",
      { title: "Delete client", kind: "warning" }
    );
    if (!ok) return;
    await deleteClient(client.id);
    onClose();
  };

  const handleAddTask = async () => {
    const taskName = (newTaskInputRef.current?.value ?? newTaskName).trim();
    if (!taskName || !client) return;
    try {
      await createTask(taskName, client.isDefault ? null : client.id);
      refreshTasks();
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
    const taskName = renameValue.trim();
    if (!taskName) return;
    await renameTask(id, taskName);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name: taskName } : t)));
    setRenamingId(null);
    setRenameValue("");
  };

  const rowLabel: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: 16, color: colors.textPrimary };

  // Sub-screen, not a DB write — Save here only resolves the draft pick
  // back into this screen's own local state; it's persisted later by this
  // screen's own Save, bundled with every other field (see handleEditSave).
  if (openAvatar) {
    return (
      <AvatarScreen
        name={name}
        avatarColor={avatarColor}
        avatarEmoji={avatarEmoji}
        onCancel={() => setOpenAvatar(false)}
        onSave={(color, emoji) => { setAvatarColor(color); setAvatarEmoji(emoji); setOpenAvatar(false); }}
      />
    );
  }

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
          {isNew ? "New client" : "Client"}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <CloseIcon color={colors.textPrimary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: editing ? "12px 24px 84px" : "12px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Card 1 — client info */}
        <div style={{ background: colors.cardBg, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {editing ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ClientAvatar
                  name={name}
                  avatarColor={avatarColor}
                  avatarEmoji={avatarEmoji}
                  size={36}
                  onClick={() => setOpenAvatar(true)}
                />
                <input
                  autoFocus
                  type="text"
                  placeholder={client?.isDefault ? "No client" : "Client name"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ ...compactInputStyle, flex: 1, minWidth: 0, padding: "0 16px" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ ...fieldLabelStyle, color: colors.textSecondary }}>Status</span>
                  <div style={selectWrapStyle}>
                    <span style={{ flex: 1, minWidth: 0 }}>{isPaid ? "Paid" : "Unpaid"}</span>
                    <ChevronDown color={colors.textPrimary} />
                    <select value={isPaid ? "paid" : "unpaid"} onChange={(e) => setIsPaid(e.target.value === "paid")} style={nativeSelectStyle}>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ ...fieldLabelStyle, color: colors.textSecondary }}>Rate</span>
                  {isPaid ? (
                    <div style={{ ...compactInputStyle, gap: 4, justifyContent: "space-between" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        style={{ flex: 1, minWidth: 0, border: "none", background: "none", fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", outline: "none" }}
                      />
                      <span style={{ fontSize: 16, color: colors.textSecondary }}>$</span>
                    </div>
                  ) : (
                    <div style={{ ...compactInputStyle, color: colors.textSecondary, justifyContent: "center" }}>—</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ ...fieldLabelStyle, color: colors.textSecondary }}>Commission</span>
                    <Tooltip content="Informational only — shows net earnings after deductions, doesn't affect tracked time">
                      <InfoIcon color={colors.textSecondary} />
                    </Tooltip>
                  </div>
                  {isPaid ? (
                    <div style={{ ...compactInputStyle, gap: 4, justifyContent: "space-between" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                        style={{ flex: 1, minWidth: 0, border: "none", background: "none", fontSize: 16, color: colors.textPrimary, fontFamily: "'Inter', sans-serif", outline: "none" }}
                      />
                      <span style={{ fontSize: 16, color: colors.textSecondary }}>%</span>
                    </div>
                  ) : (
                    <div style={{ ...compactInputStyle, color: colors.textSecondary, justifyContent: "center" }}>—</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <ClientAvatar
                    name={name}
                    avatarColor={avatarColor}
                    avatarEmoji={avatarEmoji}
                    size={36}
                  />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name && name.trim() ? name : "No client"}
                  </span>
                </div>
                <span onClick={() => setEditing(true)} style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", cursor: "pointer", flexShrink: 0 }}>
                  Edit
                </span>
              </div>
              <span style={rowLabel}>
                {isPaid ? (
                  <>
                    <span>Paid</span>
                    <span style={{ color: colors.textSecondary }}> · </span>
                    <span>${rate}/hr</span>
                    <span style={{ color: colors.textSecondary }}> · </span>
                    <span>{commission}% commission</span>
                  </>
                ) : (
                  <span>Unpaid</span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Card 2 — tasks (existing clients only) */}
        {!isNew && (
          <div style={{ background: colors.cardBg, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: colors.textPrimary }}>Tasks</span>
              {!isAddingTask && !renamingId ? (
                <span onClick={() => setIsAddingTask(true)} style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", cursor: "pointer" }}>
                  Add
                </span>
              ) : isAddingTask ? (
                <div style={{ display: "flex", gap: 20 }}>
                  <span onClick={handleCancelTask} style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#FF5429", cursor: "pointer" }}>Cancel</span>
                  <span onClick={handleAddTask} style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", cursor: "pointer" }}>Save</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 20 }}>
                  <span onClick={() => { setRenamingId(null); setRenameValue(""); }} style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#FF5429", cursor: "pointer" }}>Cancel</span>
                  <span onClick={() => handleRenameTask(renamingId!)} style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", cursor: "pointer" }}>Save</span>
                </div>
              )}
            </div>

            {isAddingTask && (
              <input
                ref={newTaskInputRef}
                autoFocus
                type="text"
                placeholder="Task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); if (e.key === "Escape") handleCancelTask(); }}
                style={{ ...inputBase, width: "100%" }}
              />
            )}

            {tasks.length === 0 && !isAddingTask && (
              <div style={{ padding: "4px 0", color: colors.textSecondary, fontSize: 15 }}>No tasks yet</div>
            )}

            {tasks.map((task) => (
              <div key={task.id}>
                {renamingId === task.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameTask(task.id); if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); } }}
                    style={{ ...inputBase, width: "100%" }}
                  />
                ) : (
                  <div
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", position: "relative" }}
                  >
                    <span style={{
                      fontFamily: "'Inter', sans-serif", fontSize: 16, color: colors.textPrimary,
                      maxWidth: 304, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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
                        <div onClick={() => setOpenMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
                        <div style={{
                          position: "absolute", top: 36, right: 0, background: colors.menuBg, borderRadius: 8, padding: 8,
                          boxShadow: colors.menuShadow, zIndex: 99, display: "flex", flexDirection: "column", minWidth: 120,
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
        )}
      </div>

      {editing && (
        <ButtonBar
          cancelLabel="Cancel"
          saveLabel="Save"
          onCancel={handleEditCancel}
          onSave={handleEditSave}
          onDelete={!isNew && client && !client.isDefault ? handleDeleteClient : undefined}
        />
      )}
    </div>
  );
}
