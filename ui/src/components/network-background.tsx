"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated network background — nodes representing AI agents, edges showing
 * connections. Ported from mudabbir.ai's hero canvas, adapted to size itself
 * to its container (so it works both scoped to a panel and fixed full-screen)
 * and to honour prefers-reduced-motion.
 *
 * Drop it inside a `relative`/`fixed` parent; it fills the parent via
 * `position: absolute; inset: 0`.
 */
export function NetworkBackground({
  className,
  interactive = true,
}: {
  className?: string;
  /** React to the pointer with a soft repulsion. Disable for ambient backdrops. */
  interactive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      pulse: number;
      type: "hub" | "agent";
    }[] = [];
    const mouse = { x: -1000, y: -1000 };
    let rafId = 0;

    const config = {
      nodeCount: 0,
      maxDistance: 160,
      nodeSpeed: 0.25,
      nodeRadius: 1.8,
      mouseRadius: 180,
    };

    function initNodes() {
      nodes = [];
      for (let i = 0; i < config.nodeCount; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * config.nodeSpeed,
          vy: (Math.random() - 0.5) * config.nodeSpeed,
          pulse: Math.random() * Math.PI * 2,
          type: Math.random() > 0.85 ? "hub" : "agent",
        });
      }
    }

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      // Size to the element's box, not the window, so the same component works
      // scoped to a panel or stretched across the viewport.
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = width * height;
      config.nodeCount = Math.min(110, Math.max(28, Math.floor(area / 14000)));
      initNodes();
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += 0.02;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        if (interactive) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < config.mouseRadius && dist > 0) {
            const force = (config.mouseRadius - dist) / config.mouseRadius;
            node.x += (dx / dist) * force * 1.5;
            node.y += (dy / dist) * force * 1.5;
          }
        }
      }

      // Connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.maxDistance) {
            const alpha = (1 - dist / config.maxDistance) * 0.35;
            const isHubConnection = a.type === "hub" || b.type === "hub";

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            if (isHubConnection) {
              ctx.strokeStyle = `rgba(124, 92, 255, ${alpha})`;
              ctx.lineWidth = 0.7;
            } else {
              ctx.strokeStyle = `rgba(180, 180, 220, ${alpha * 0.6})`;
              ctx.lineWidth = 0.5;
            }
            ctx.stroke();
          }
        }
      }

      // Nodes
      for (const node of nodes) {
        const pulseScale = 1 + Math.sin(node.pulse) * 0.2;
        const radius = (node.type === "hub" ? 3 : config.nodeRadius) * pulseScale;

        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          radius * 4,
        );
        if (node.type === "hub") {
          gradient.addColorStop(0, "rgba(124, 92, 255, 0.6)");
          gradient.addColorStop(1, "rgba(124, 92, 255, 0)");
        } else {
          gradient.addColorStop(0, "rgba(0, 212, 255, 0.3)");
          gradient.addColorStop(1, "rgba(0, 212, 255, 0)");
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = node.type === "hub" ? "#a78bfa" : "#e8e8f0";
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    resize();

    if (prefersReducedMotion) {
      // Render a single static frame — no animation loop.
      draw();
      cancelAnimationFrame(rafId);
    } else {
      draw();
      if (interactive) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseleave", handleMouseLeave);
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
