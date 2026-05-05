import { Component } from '@angular/core';
import { TechCanvasComponent } from '../tech-canvas/tech-canvas.component';

@Component({
  selector: 'app-tech-background',
  standalone: true,
  imports: [TechCanvasComponent],
  template: `
    <app-tech-canvas />
    <div class="tech-overlay"></div>
    <div class="grid-overlay"></div>
  `,
  styles: [`
    .tech-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 60%);
      z-index: 1;
      pointer-events: none;
    }

    .grid-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      z-index: 1;
      pointer-events: none;
    }
  `]
})
export class TechBackgroundComponent {}
