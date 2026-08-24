import { useState, useRef, useLayoutEffect, ReactNode } from "react";

// Window is fixed at 440px (see CLAUDE.md) — hardcoding avoids a window.innerWidth
// read that would need its own effect/listener for a value that never changes.
// Height is NOT fixed (compact main screen is 126px, everything else 500px),
// so that one is read live via window.innerHeight instead.
const WINDOW_WIDTH = 440;
const EDGE_MARGIN = 12;
const SHOW_DELAY_MS = 400;
const GAP = 8;

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

// Fixed black/white regardless of theme, like the "Report copied" toast —
// both are short-lived overlays that need to read the same in light and dark.
//
// The bubble is positioned in two passes: it first renders invisible so its
// size can be measured, then a layout effect computes an offset clamped to
// stay EDGE_MARGIN inside the window horizontally. Vertically it prefers
// opening above the trigger, but flips below when there isn't enough room —
// e.g. the compact main screen's progress bar sits right under the title
// bar with almost no space above it. The arrow stays glued to the trigger's
// true horizontal center regardless of that clamp, so it always points
// exactly at the trigger even when the bubble itself had to shift.
export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number; placement: "top" | "bottom" } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !bubbleRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const bubbleWidth = bubbleRef.current.offsetWidth;
    const bubbleHeight = bubbleRef.current.offsetHeight;
    const centerX = anchorRect.left + anchorRect.width / 2;
    const left = Math.max(EDGE_MARGIN, Math.min(centerX - bubbleWidth / 2, WINDOW_WIDTH - EDGE_MARGIN - bubbleWidth));
    const arrowLeft = Math.max(10, Math.min(centerX - left, bubbleWidth - 10));

    const spaceAbove = anchorRect.top;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const fitsAbove = spaceAbove >= bubbleHeight + GAP;
    const fitsBelow = spaceBelow >= bubbleHeight + GAP;
    const placement: "top" | "bottom" =
      fitsAbove ? "top" : fitsBelow ? "bottom" : spaceAbove >= spaceBelow ? "top" : "bottom";
    const top = placement === "top" ? anchorRect.top - GAP : anchorRect.bottom + GAP;

    setPos({ left, top, arrowLeft, placement });
  }, [visible]);

  const placement = pos?.placement ?? "top";

  return (
    <span
      ref={anchorRef}
      onMouseEnter={() => {
        showTimerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      }}
      onMouseLeave={() => {
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        setVisible(false);
        setPos(null);
      }}
      style={{ position: "relative", display: "flex", alignItems: "center" }}
    >
      {children}
      {visible && (
        <span
          ref={bubbleRef}
          style={{
            position: "fixed",
            left: pos ? pos.left : 0,
            top: pos ? pos.top : 0,
            transform: placement === "top" ? "translateY(-100%)" : "none",
            visibility: pos ? "visible" : "hidden",
            background: "#000000",
            color: "#FFFFFF",
            fontSize: 12,
            lineHeight: "16px",
            padding: "4px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 50,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {content}
          <span
            style={{
              position: "absolute",
              ...(placement === "top"
                ? { top: "100%", borderTop: "5px solid #000000" }
                : { bottom: "100%", borderBottom: "5px solid #000000" }),
              left: pos ? pos.arrowLeft : "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
            }}
          />
        </span>
      )}
    </span>
  );
}
