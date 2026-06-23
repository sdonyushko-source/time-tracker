const tasks = [
  { name: "beSirius 2.0 Twin interface", active: true, badge: null, time: "02:34:47" },
  { name: "beSirius 2.0 Sharing interface", active: false, badge: null, time: "01:47:36" },
  { name: "Claim twin, invite to fill their twin", active: false, badge: "2", time: "00:54:43" },
];

export default function Today() {
  return (
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
            05:17:06 / 06:00:00 · 88%
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
            width: "88%",
            background: "linear-gradient(176deg, #8FD75F 24.6%, #31D877 69.3%)",
            boxShadow: "0px 4px 20px 0px rgba(33,152,81,0.3)",
          }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {tasks.map((task) => (
          <div
            key={task.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: 8,
              background: "white",
              width: 376,
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
              {task.badge && (
                <span style={{
                  background: "#F6F6F6",
                  borderRadius: 4,
                  padding: "0 4px",
                  fontSize: 12,
                  color: "#908F8F",
                  flexShrink: 0,
                  lineHeight: "16px",
                }}>
                  {task.badge}
                </span>
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
              {task.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
