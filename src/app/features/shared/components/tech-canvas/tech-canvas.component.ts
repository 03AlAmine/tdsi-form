// tech-canvas.component.ts (version améliorée)
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-tech-canvas',
  standalone: true,
  template: '<canvas #techCanvas class="tech-canvas"></canvas>',
  styles: [`
    .tech-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      opacity: 0.4;
      pointer-events: none;
    }
  `]
})
export class TechCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('techCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private animationId: number | null = null;
  private particles: CanvasParticle[] = [];
  private mouseX = 0;
  private mouseY = 0;
  private readonly PARTICLE_COUNT = 60;

  ngAfterViewInit(): void {
    this.initCanvas();
    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      this.initParticles(canvas);
    };

    resizeCanvas();
    this.draw(ctx, canvas);
  }

  private initParticles(canvas: HTMLCanvasElement): void {
    this.particles = [];
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        alpha: Math.random() * 0.4 + 0.1,
        baseAlpha: Math.random() * 0.4 + 0.1
      });
    }
  }

  private handleResize(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.initParticles(canvas);
  }

  private draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    // Effacement avec traînée
    ctx.fillStyle = 'rgba(10, 14, 39, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mise à jour et dessin des particules
    this.particles.forEach(particle => {
      // Mise à jour position
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      // Wrap around
      if (particle.x < 0) particle.x = canvas.width;
      if (particle.x > canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = canvas.height;
      if (particle.y > canvas.height) particle.y = 0;

      // Interaction souris
      const dx = this.mouseX - particle.x;
      const dy = this.mouseY - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 150;

      if (distance < maxDistance) {
        const force = (maxDistance - distance) / maxDistance;
        particle.alpha = Math.min(particle.baseAlpha + force * 0.3, 0.8);
        const angle = Math.atan2(dy, dx);
        particle.x -= Math.cos(angle) * force * 3;
        particle.y -= Math.sin(angle) * force * 3;
      } else {
        particle.alpha = particle.baseAlpha;
      }

      // Dessin particule
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${particle.alpha})`;
      ctx.fill();
    });

    // Dessin des connexions
    this.particles.forEach((p1, i) => {
      this.particles.slice(i + 1).forEach(p2 => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 120;

        if (distance < maxDistance) {
          const opacity = (1 - distance / maxDistance) * 0.12;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
          ctx.stroke();
        }
      });
    });

    this.animationId = requestAnimationFrame(() => this.draw(ctx, canvas));
  }
}

interface CanvasParticle {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  alpha: number;
  baseAlpha: number;
}
