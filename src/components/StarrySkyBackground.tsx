import { useEffect, useRef } from 'react';

export default function StarrySkyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width: number;
    let height: number;
    let cx: number;
    let cy: number;

    // Star settings
    const STAR_COUNT = 800;
    const STAR_BASE_SIZE = 0.5;

    let stars: Star[] = [];

    // Mouse interaction
    let mouse = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };

    class Star {
      x: number = 0;
      y: number = 0;
      z: number = 0;
      size: number = 0;
      opacity: number = 0;
      sx: number = 0;
      sy: number = 0;
      r: number = 0;

      constructor() {
        this.reset();
      }

      reset() {
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = Math.random() * 2000; // Depth
        this.size = Math.random() * STAR_BASE_SIZE + 0.5;
        this.opacity = Math.random();
      }

      update() {
        // Perspective calculation
        const fov = 500;
        const scale = fov / (fov + this.z);

        // Mouse influence with smoothing
        const moveX = (target.x - cx) * (2000 - this.z) * 0.0005;
        const moveY = (target.y - cy) * (2000 - this.z) * 0.0005;

        this.sx = cx + (this.x - moveX) * scale;
        this.sy = cy + (this.y - moveY) * scale;
        this.r = this.size * scale * 3;
      }

      draw() {
        if (!ctx) return;
        // Only draw if on screen
        if (this.sx < 0 || this.sx > width || this.sy < 0 || this.sy > height) return;

        ctx.beginPath();
        ctx.arc(this.sx, this.sy, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.fill();

        // Twinkle
        if (Math.random() > 0.99) {
          this.opacity = Math.random();
        }
      }
    }

    function resize() {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      cx = width / 2;
      cy = height / 2;

      // Re-initialize stars
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push(new Star());
      }
    }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse movement
      target.x += (mouse.x - target.x) * 0.05;
      target.y += (mouse.y - target.y) * 0.05;

      stars.forEach(star => {
        star.update();
        star.draw();
      });

      requestAnimationFrame(animate);
    }

    // Initialize
    resize();
    
    // Initial mouse pos
    mouse.x = window.innerWidth / 2;
    mouse.y = window.innerHeight / 2;
    target.x = mouse.x;
    target.y = mouse.y;

    // Event Listeners
    const handleResize = () => resize();
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    const animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom,_#0d1d31_0%,_#0c0d13_100%)]">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
      />
      {/* Background Grid Overlay from reference */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: 'perspective(500px) rotateX(2deg) scale(1.1)',
          transformOrigin: 'center top',
        }}
      />
      {/* Cinematic God Rays / Volumetric Fog Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at top, rgba(0, 243, 255, 0.03), transparent 70%),
            radial-gradient(ellipse at bottom, rgba(188, 19, 254, 0.03), transparent 70%)
          `
        }}
      />
    </div>
  );
}
