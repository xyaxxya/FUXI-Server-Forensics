import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

interface ResizableTriPanelProps {
  scopeKey: string;
  minTop?: number;
  minMiddle?: number;
  minBottom?: number;
  className?: string;
  top: ReactNode;
  middle: ReactNode;
  bottom: ReactNode;
}

const DEFAULT_RATIOS: [number, number, number] = [0.34, 0.33, 0.33];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getStorageKey(scopeKey: string) {
  return `fuxi_tri_panel_${scopeKey}`;
}

export default function ResizableTriPanel({
  scopeKey,
  minTop = 220,
  minMiddle = 220,
  minBottom = 220,
  className = "",
  top,
  middle,
  bottom,
}: ResizableTriPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    splitter: 1 | 2;
    startY: number;
    startHeights: [number, number, number];
  } | null>(null);
  const [heights, setHeights] = useState<[number, number, number] | null>(null);

  const mins = useMemo(() => [minTop, minMiddle, minBottom] as const, [minTop, minMiddle, minBottom]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const total = node.clientHeight;
    const savedRaw = localStorage.getItem(getStorageKey(scopeKey));
    const saved = savedRaw ? (JSON.parse(savedRaw) as [number, number, number]) : null;
    const base = saved && saved.length === 3 ? saved : DEFAULT_RATIOS;
    const next: [number, number, number] = [
      Math.floor(total * base[0]),
      Math.floor(total * base[1]),
      Math.floor(total * base[2]),
    ];
    const sum = next[0] + next[1] + next[2];
    next[2] += total - sum;
    setHeights(next);
  }, [scopeKey]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const resize = () => {
      const total = node.clientHeight;
      if (!heights) {
        return;
      }
      const ratioSum = heights[0] + heights[1] + heights[2] || 1;
      const next: [number, number, number] = [
        Math.floor((heights[0] / ratioSum) * total),
        Math.floor((heights[1] / ratioSum) * total),
        Math.floor((heights[2] / ratioSum) * total),
      ];
      const sum = next[0] + next[1] + next[2];
      next[2] += total - sum;
      setHeights(next);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [heights]);

  useEffect(() => {
    if (!heights) {
      return;
    }
    const sum = heights[0] + heights[1] + heights[2] || 1;
    const ratios: [number, number, number] = [heights[0] / sum, heights[1] / sum, heights[2] / sum];
    localStorage.setItem(getStorageKey(scopeKey), JSON.stringify(ratios));
  }, [heights, scopeKey]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragStartRef.current) {
        return;
      }
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const delta = event.clientY - dragStartRef.current.startY;
      const [a, b, c] = dragStartRef.current.startHeights;
      const [minA, minB, minC] = mins;

      if (dragStartRef.current.splitter === 1) {
        const maxTop = node.clientHeight - minB - minC - 8;
        const nextA = clamp(a + delta, minA, maxTop);
        const nextB = b - (nextA - a);
        setHeights([nextA, nextB, c]);
      } else {
        const maxMid = node.clientHeight - minA - minC - 8;
        const nextB = clamp(b + delta, minB, maxMid);
        const nextC = c - (nextB - b);
        setHeights([a, nextB, nextC]);
      }
    };

    const onUp = () => {
      dragStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [mins]);

  const startDrag = (splitter: 1 | 2, event: React.MouseEvent<HTMLDivElement>) => {
    if (!heights) {
      return;
    }
    dragStartRef.current = {
      splitter,
      startY: event.clientY,
      startHeights: heights,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const resolved = heights ?? [320, 320, 320];

  return (
    <div ref={containerRef} className={`min-h-0 flex flex-col ${className}`}>
      <div style={{ height: resolved[0], minHeight: minTop }} className="min-h-0 overflow-auto">
        {top}
      </div>
      <div
        onMouseDown={(event) => startDrag(1, event)}
        className="h-2 cursor-row-resize rounded-full bg-slate-200/70 hover:bg-slate-300/80"
      />
      <div style={{ height: resolved[1], minHeight: minMiddle }} className="min-h-0 overflow-auto">
        {middle}
      </div>
      <div
        onMouseDown={(event) => startDrag(2, event)}
        className="h-2 cursor-row-resize rounded-full bg-slate-200/70 hover:bg-slate-300/80"
      />
      <div style={{ height: resolved[2], minHeight: minBottom }} className="min-h-0 overflow-auto">
        {bottom}
      </div>
    </div>
  );
}

