import { useEffect, useRef } from "react";

export default function AnimeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resize);
    resize();

    const draw = () => {
      time += 1;
      
      // Base background (Clean Light Blue-Gray)
      ctx.fillStyle = "#F2F7FA";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle halftone dot grid
      ctx.fillStyle = "#E4EDF4";
      const dotSpacing = 24;
      const offsetX = (time * 0.2) % dotSpacing;
      const offsetY = (time * 0.2) % dotSpacing;

      for (let x = -dotSpacing; x < canvas.width + dotSpacing; x += dotSpacing) {
        for (let y = -dotSpacing; y < canvas.height + dotSpacing; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x + offsetX, y + offsetY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw diagonal decorative stripes (Blue Archive style)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(canvas.width - 400, 0);
      ctx.lineTo(canvas.width, 0);
      ctx.lineTo(canvas.width, 600);
      ctx.lineTo(canvas.width - 600, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(300, canvas.height);
      ctx.lineTo(0, canvas.height - 300);
      ctx.fillStyle = "rgba(0, 161, 214, 0.03)";
      ctx.fill();
      ctx.restore();

      // Crosshairs / Tech marks
      ctx.strokeStyle = "#C9D9E8";
      ctx.lineWidth = 2;
      
      const drawCross = (cx: number, cy: number) => {
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
      };

      drawCross(100, 100);
      drawCross(canvas.width - 150, canvas.height - 120);

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[-1] pointer-events-none"
    />
  );
}
