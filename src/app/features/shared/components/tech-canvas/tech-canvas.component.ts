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

  ngAfterViewInit(): void {
    this.initTechCanvas();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private initTechCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = '01';
    const fontSize = 16;
    let columns = canvas.width / fontSize;
    let drops: number[] = [];

    const initDrops = () => {
      columns = canvas.width / fontSize;
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
      }
    };
    initDrops();

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 15, 26, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      this.animationId = requestAnimationFrame(draw);
    };

    draw();

    window.addEventListener('resize', () => {
      initDrops();
    });
  }
}
