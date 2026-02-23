import { useEffect, useRef } from "react";

export default function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // Configuration
    const particleCount = 40; // Fewer but more distinct
    const connectionDistance = 150;
    const mouseDistance = 250;
    const scanLineSpeed = 2;

    // Mouse interaction
    const mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Particle Class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      baseX: number;
      baseY: number;
      density: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.baseX = this.x;
        this.baseY = this.y;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
        this.density = (Math.random() * 30) + 1;
        const colors = ["#3b82f6", "#06b6d4", "#94a3b8"]; 
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        // Mouse repulsion
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mouseDistance) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (mouseDistance - distance) / mouseDistance;
            const directionX = forceDirectionX * force * this.density * 0.1;
            const directionY = forceDirectionY * force * this.density * 0.1;
            
            if (distance < mouseDistance) {
                this.x -= directionX;
                this.y -= directionY;
            }
        } else {
            // Return to original trajectory slightly
            if (this.x !== this.baseX) {
                const dx = this.x - this.baseX;
                this.x -= dx / 50;
            }
            if (this.y !== this.baseY) {
                const dy = this.y - this.baseY;
                this.y -= dy / 50;
            }
        }
      }

      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fillStyle = this.color;
        ctx!.fill();
      }
    }

    // Hexagon Grid Class
    class Hexagon {
        x: number;
        y: number;
        size: number;
        opacity: number;
        life: number;
        maxLife: number;

        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 30 + 10;
            this.opacity = 0;
            this.life = 0;
            this.maxLife = Math.random() * 200 + 100;
        }

        update() {
            this.life++;
            if (this.life < 50) {
                this.opacity += 0.005;
            } else if (this.life > this.maxLife - 50) {
                this.opacity -= 0.005;
            }

            if (this.life > this.maxLife) {
                this.life = 0;
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.opacity = 0;
            }
        }

        draw() {
            if (this.opacity <= 0) return;
            ctx!.beginPath();
            const angle = Math.PI / 3;
            for (let i = 0; i < 6; i++) {
                ctx!.lineTo(this.x + this.size * Math.cos(angle * i), this.y + this.size * Math.sin(angle * i));
            }
            ctx!.closePath();
            ctx!.strokeStyle = `rgba(6, 182, 212, ${this.opacity * 0.3})`;
            ctx!.lineWidth = 1;
            ctx!.stroke();
            
            // Inner dot
            ctx!.beginPath();
            ctx!.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx!.fillStyle = `rgba(6, 182, 212, ${this.opacity * 0.5})`;
            ctx!.fill();
        }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const hexagons: Hexagon[] = [];
    for (let i = 0; i < 15; i++) {
        hexagons.push(new Hexagon());
    }

    // Scan Line
    let scanY = 0;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Grid (Perspective-ish)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 80;
      
      // Vertical lines
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Hexagons
      hexagons.forEach(hex => {
          hex.update();
          hex.draw();
      });

      // Update and Draw Particles
      particles.forEach(p => {
          p.update();
          p.draw();
      });

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.15 * (1 - distance / connectionDistance)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Scan Line Effect
      scanY += scanLineSpeed;
      if (scanY > height) scanY = 0;

      const gradient = ctx.createLinearGradient(0, scanY, 0, scanY + 100);
      gradient.addColorStop(0, "rgba(56, 189, 248, 0)");
      gradient.addColorStop(0.5, "rgba(56, 189, 248, 0.1)");
      gradient.addColorStop(1, "rgba(56, 189, 248, 0)");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanY, width, 100);

      // Mouse Glow
      if (mouse.x > 0) {
          const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 300);
          glow.addColorStop(0, "rgba(56, 189, 248, 0.05)");
          glow.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#F8FAFC]">
      <canvas ref={canvasRef} className="absolute inset-0 block" />
    </div>
  );
}
