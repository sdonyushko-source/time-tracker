const rows = [
  { label: "Today",      time: "05:17:06",  amount: "$158.55",   bold: false },
  { label: "This week",  time: "24:56:32",  amount: "$748.27",   bold: false },
  { label: "This month", time: "120:34:47", amount: "$3,617.39", bold: true  },
];

export default function Summary() {
  return (
    <div style={{
      background: "#F6F6F6",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: 392,
    }}>
      {rows.map((row) => (
        <div key={row.label} style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: 16,
          color: "#181A2C",
          lineHeight: "24px",
          fontWeight: row.bold ? 500 : 400,
        }}>
          <span style={{ width: 111, flexShrink: 0 }}>
            {row.label}
          </span>
          <span style={{
            width: 102,
            flexShrink: 0,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            fontFamily: "'Inter', sans-serif",
          }}>
            {row.time}
          </span>
          <span style={{ width: 99, flexShrink: 0, textAlign: "right" }}>
            {row.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
