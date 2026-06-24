import { TimeEntry, Settings } from "../db";
import { formatTime } from "../utils";

interface TodayProps {
  entries: TimeEntry[];
  settings: Settings;
  dailyGoalSeconds: number;
  onTaskClick?: (taskId: string) => void;
}

export default function Today({ entries, settings: _settings, dailyGoalSeconds, onTaskClick }: TodayProps) {
  const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const pct = dailyGoalSeconds > 0 ? Math.min(100, Math.round((totalSeconds / dailyGoalSeconds) * 100)) : 0;

  // Group entries by task
  const taskMap: Record<string, { name: string; totalSeconds: number; count: number; active: boolean }> = {};
  entries.forEach((e) => {
    if (!taskMap[e.taskId]) {
      taskMap[e.taskId] = { name: e.taskNameSnapshot, totalSeconds: 0, count: 0, active: false };
    }
    taskMap[e.taskId].count += 1;
    if (e.endTime) taskMap[e.taskId].totalSeconds += e.durationSeconds ?? 0;
    if (!e.endTime) taskMap[e.taskId].active = true;
  });
  const tasks = Object.entries(taskMap).map(([id, t]) => ({ id, ...t }));

  return (
    <>
    <style>{`.today-task-list::-webkit-scrollbar { display: none; }`}</style>
    <div style={{
      border: "1px solid #E3E5EA",
      borderRadius: 12,
      overflow: "hidden",
      paddingTop: 16,
      paddingLeft: 8,
      paddingRight: 8,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      width: 392,
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "0 12px",
        width: 376,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#181A2C", lineHeight: "24px" }}>
            Today
          </span>
          <span style={{
            fontSize: 16,
            color: "#181A2C",
            lineHeight: "24px",
            fontFamily: "'Inter', sans-serif",
            fontVariantNumeric: "tabular-nums",
          }}>
            {formatTime(totalSeconds)} / {formatTime(dailyGoalSeconds)} · {pct}%
          </span>
        </div>

        <div style={{
          height: 12,
          borderRadius: 40,
          background: "#F6F6F6",
          overflow: "hidden",
          width: "100%",
        }}>
          <div style={{
            height: 12,
            width: `${pct}%`,
            background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)",
            boxShadow: "0px 4px 20px 0px rgba(33,152,81,0.3)",
          }} />
        </div>
      </div>

      <div className="today-task-list" style={{ display: "flex", flexDirection: "column", width: "100%", maxHeight: 160, overflowY: "auto", scrollbarWidth: "none" }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: 8,
              background: "white",
              width: 376,
              cursor: onTaskClick ? "pointer" : "default",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              width: 264,
              flexShrink: 0,
              overflow: "hidden",
            }}>
              <span style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 16,
                color: "#181A2C",
                lineHeight: "24px",
                flexShrink: 1,
              }}>
                {task.name}
              </span>
              {task.count > 1 && (
                <span style={{
                  width: 16,
                  background: "#F6F6F6",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#908F8F",
                  flexShrink: 0,
                  textAlign: "center",
                  lineHeight: "16px",
                }}>
                  {task.count}
                </span>
              )}
              {task.active && (
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: "#34C759",
                  flexShrink: 0,
                  display: "inline-block",
                }} />
              )}
            </div>
            <span style={{
              width: 72,
              flexShrink: 0,
              textAlign: "right",
              fontSize: 16,
              color: "#181A2C",
              lineHeight: "24px",
              fontFamily: "'Inter', sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}>
              {formatTime(task.totalSeconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
