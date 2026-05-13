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
      time += 0.002;
      
      const isDark = document.body.classList.contains("starry-mode");

      // Smooth transition for colors
      const targetColors = isDark 
        ? {
            bg: "#050510",
            blob1: "rgba(67, 56, 202, 0.45)", // deep indigo
            blob2: "rgba(124, 58, 237, 0.35)", // purple
            blob3: "rgba(14, 165, 233, 0.3)", // sky blue
            blob4: "rgba(236, 72, 153, 0.2)"  // pink
          }
        : {
            bg: "#F4F7FB", // softer blue-tinted white
            blob1: "rgba(147, 197, 253, 0.6)", // blue-300
            blob2: "rgba(196, 181, 253, 0.5)", // violet-300
            blob3: "rgba(167, 243, 208, 0.5)", // cyan-200
            blob4: "rgba(252, 165, 165, 0.4)"  // red-300
          };

      // Base background
      ctx.fillStyle = targetColors.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Beautiful animated gradient blobs (Rich & Vibrant)
      const w = canvas.width;
      const h = canvas.height;
      const minDim = Math.min(w, h);

      // Blob 1 (Indigo/Blue)
      const cx1 = w * 0.5 + Math.sin(time * 0.7) * (w * 0.3);
      const cy1 = h * 0.5 + Math.cos(time * 0.5) * (h * 0.3);
      const r1 = minDim * 0.9;
      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      g1.addColorStop(0, targetColors.blob1);
      g1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Blob 2 (Purple/Violet)
      const cx2 = w * 0.8 + Math.cos(time * 0.6) * (w * 0.2);
      const cy2 = h * 0.2 + Math.sin(time * 0.8) * (h * 0.3);
      const r2 = minDim * 0.8;
      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, targetColors.blob2);
      g2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Blob 3 (Sky/Cyan)
      const cx3 = w * 0.2 + Math.sin(time * 0.9) * (w * 0.25);
      const cy3 = h * 0.8 + Math.cos(time * 0.7) * (h * 0.25);
      const r3 = minDim * 0.85;
      const g3 = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, r3);
      g3.addColorStop(0, targetColors.blob3);
      g3.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      // Blob 4 (Pink/Red)
      const cx4 = w * 0.5 + Math.cos(time * 0.4) * (w * 0.4);
      const cy4 = h * 0.5 + Math.sin(time * 0.6) * (h * 0.4);
      const r4 = minDim * 0.7;
      const g4 = ctx.createRadialGradient(cx4, cy4, 0, cx4, cy4, r4);
      g4.addColorStop(0, targetColors.blob4);
      g4.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g4;
      ctx.fillRect(0, 0, w, h);

      // Draw Noise Pattern
      if (noiseCtx) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        for (let x = 0; x < canvas.width; x += 256) {
          for (let y = 0; y < canvas.height; y += 256) {
            ctx.drawImage(noiseCanvas, x, y);
          }
        }
        ctx.restore();
      }

      // Draw subtle grid (Modern dev tool vibe)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 64;
      
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
