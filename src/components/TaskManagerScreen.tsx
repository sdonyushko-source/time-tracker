import { useState, useEffect } from "react";
import { Task, Client, TimeEntry, getTasks, getClients, getAllTasks, getMonthEntries } from "../db";
import { computeVisibleClients, clientDisplayName, resolveClientId, formatTimeRU, formatAmount } from "../utils";
import { useTheme } from "../ThemeContext";
import TitleBarSpacer from "./TitleBarSpacer";
import ClientScreen from "./ClientScreen";
import ClientAvatar from "./ClientAvatar";

const CloseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

interface TaskManagerScreenProps {
  onClose: () => void;
}

// Every task belongs to a client — the default ("No client") included, see
// resolveClientId in utils.ts — so this screen is a pure clients list, no
// flat task list at the root: there's no such thing as a task outside a
// client. Tasks are only ever seen/added/renamed/deleted from inside
// ClientScreen, one client at a time — including the sole client, so this
// list always renders even when there's just one card to show.
export default function TaskManagerScreen({ onClose }: TaskManagerScreenProps) {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);
  const [hoveredClientId, setHoveredClientId] = useState<string | null>(null);

  // Non-null opens ClientScreen: an existing client to view/edit, or
  // {client: null} for "New client".
  const [openClient, setOpenClient] = useState<{ client: Client | null } | null>(null);

  const refreshAll = () => {
    getTasks().then(setTasks);
    getClients().then(setClients);
    getAllTasks().then(setAllTasks);
    getMonthEntries().then(setMonthEntries);
  };

  useEffect(() => { refreshAll(); }, []);

  if (openClient) {
    const defaultClientId = clients.find((c) => c.isDefault)?.id ?? "";
    return (
      <ClientScreen
        client={openClient.client}
        defaultClientId={defaultClientId}
        onClose={() => { setOpenClient(null); refreshAll(); }}
      />
    );
  }

  const visibleClients = computeVisibleClients(clients, tasks);
  const defaultClientId = clients.find((c) => c.isDefault)?.id ?? "";

  const renderClientCard = (client: Client) => {
    const clientTaskIds = new Set(
      allTasks.filter((t) => resolveClientId(t, defaultClientId) === client.id).map((t) => t.id)
    );
    const activeTaskCount = tasks.filter((t) => resolveClientId(t, defaultClientId) === client.id).length;
    const clientEntries = monthEntries.filter((e) => e.endTime && clientTaskIds.has(e.taskId));
    const seconds = clientEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
    const amount = clientEntries.reduce((s, e) => s + ((e.durationSeconds ?? 0) / 3600) * (e.hourlyRateSnapshot ?? 0), 0);
    const displayName = clientDisplayName(client);

    return (
      <div
        key={client.id}
        onClick={() => setOpenClient({ client })}
        onMouseEnter={() => setHoveredClientId(client.id)}
        onMouseLeave={() => setHoveredClientId(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px",
          borderRadius: 8,
          background: hoveredClientId === client.id ? colors.cardRowHover : "transparent",
          cursor: "pointer",
          boxSizing: "border-box",
          transition: "background 0.2s ease",
        }}
      >
        <ClientAvatar
          name={client.name}
          avatarColor={client.avatarColor}
          avatarEmoji={client.avatarEmoji}
          size={36}
        />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontSize: 15, color: colors.textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>
              {displayName}
            </span>
            <span style={{
              padding: "0 4px", background: colors.badgeBg, borderRadius: 4, fontSize: 12,
              fontWeight: 500, color: colors.badgeText, flexShrink: 0, lineHeight: "16px",
            }}>
              {client.isPaid ? `$${client.rate}/hr` : "Unpaid"}
            </span>
          </div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: colors.textSecondary }}>
            {activeTaskCount} {activeTaskCount === 1 ? "task" : "tasks"} · {formatTimeRU(seconds)}
            {client.isPaid ? ` · ${formatAmount(amount, "USD")} this month` : " this month"}
          </span>
        </div>
      </div>
    );
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
          Task management
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <CloseIcon color={colors.textPrimary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: colors.cardBg, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: colors.textPrimary, lineHeight: "24px" }}>
              Clients
            </span>
            <span
              onClick={() => setOpenClient({ client: null })}
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, color: "#7381D3", lineHeight: "24px", cursor: "pointer" }}
            >
              Add client
            </span>
          </div>

          {visibleClients.map((client) => renderClientCard(client))}
        </div>
      </div>
    </div>
  );
}
