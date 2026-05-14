import { useEffect, useRef } from "react";

export default function ModernBackground() {
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

    // Create a subtle noise pattern offscreen
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = 256;
    noiseCanvas.height = 256;
    const noiseCtx = noiseCanvas.getContext("2d");
    if (noiseCtx) {
      const imageData = noiseCtx.createImageData(256, 256);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.random() * 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 8; // Very subtle noise
      }
      noiseCtx.putImageData(imageData, 0, 0);
    }

    const draw = () => {
      time += 0.0012;
      
      const isDark = document.body.classList.contains("starry-mode");

      // Smooth transition for colors
      const targetColors = isDark 
        ? {
            bg: "#07111f",
            blob1: "rgba(0, 120, 212, 0.3)",
            blob2: "rgba(80, 230, 255, 0.16)",
            blob3: "rgba(148, 163, 184, 0.12)",
            blob4: "rgba(17, 163, 106, 0.1)"
          }
        : {
            bg: "#FFFFFF",
            blob1: "rgba(0, 120, 212, 0.13)",
            blob2: "rgba(80, 230, 255, 0.16)",
            blob3: "rgba(244, 250, 255, 0.9)",
            blob4: "rgba(0, 120, 212, 0.06)"
          };

      // Base background
      const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      base.addColorStop(0, targetColors.bg);
      base.addColorStop(0.5, isDark ? "#0B1627" : "#F7FBFF");
      base.addColorStop(1, isDark ? "#050A13" : "#EEF7FF");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Soft Mica ambient light fields.
      const w = canvas.width;
      const h = canvas.height;
      const minDim = Math.min(w, h);

      const cx1 = w * 0.12 + Math.sin(time * 0.7) * (w * 0.07);
      const cy1 = h * 0.12 + Math.cos(time * 0.5) * (h * 0.05);
      const r1 = minDim * 0.8;
      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      g1.addColorStop(0, targetColors.blob1);
      g1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const cx2 = w * 0.88 + Math.cos(time * 0.6) * (w * 0.06);
      const cy2 = h * 0.2 + Math.sin(time * 0.8) * (h * 0.07);
      const r2 = minDim * 0.74;
      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, targetColors.blob2);
      g2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      const cx3 = w * 0.28 + Math.sin(time * 0.9) * (w * 0.05);
      const cy3 = h * 0.86 + Math.cos(time * 0.7) * (h * 0.05);
      const r3 = minDim * 0.96;
      const g3 = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, r3);
      g3.addColorStop(0, targetColors.blob3);
      g3.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      const cx4 = w * 0.62 + Math.cos(time * 0.4) * (w * 0.04);
      const cy4 = h * 0.52 + Math.sin(time * 0.6) * (h * 0.04);
      const r4 = minDim * 0.82;
      const g4 = ctx.createRadialGradient(cx4, cy4, 0, cx4, cy4, r4);
      g4.addColorStop(0, targetColors.blob4);
      g4.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g4;
      ctx.fillRect(0, 0, w, h);

      // Draw Noise Pattern
      if (noiseCtx) {
        ctx.save();
      ctx.globalCompositeOperation = isDark ? "multiply" : "soft-light";
        for (let x = 0; x < canvas.width; x += 256) {
          for (let y = 0; y < canvas.height; y += 256) {
            ctx.drawImage(noiseCanvas, x, y);
          }
        }
        ctx.restore();
      }

      // Draw subtle grid for control-center structure.
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.035)" : "rgba(0, 120, 212, 0.022)";
      ctx.lineWidth = 1;
      const gridSize = 72;
      
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // Large translucent app arcs echo the reference control-center canvas.
      ctx.save();
      ctx.strokeStyle = isDark ? "rgba(80, 230, 255, 0.08)" : "rgba(0, 120, 212, 0.055)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(w * 0.56, h * 0.55, w * 0.34, h * 0.12, -0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = isDark ? "rgba(17, 163, 106, 0.06)" : "rgba(17, 163, 106, 0.06)";
      ctx.beginPath();
      ctx.ellipse(w * 0.74, h * 0.76, w * 0.24, h * 0.08, 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

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
