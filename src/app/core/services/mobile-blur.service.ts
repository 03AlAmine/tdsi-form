// core/services/mobile-blur.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileBlurService {
  private renderer: Renderer2;
  private overlay: HTMLElement | null = null;
  private isMobile = false;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.checkScreenSize();
    window.addEventListener('resize', () => this.checkScreenSize());
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth <= 768;
    if (this.isMobile) {
      this.enableBlur();
    } else {
      this.disableBlur();
    }
  }

  private enableBlur(): void {
    if (!this.overlay) {
      this.overlay = this.renderer.createElement('div');
      this.renderer.addClass(this.overlay, 'mobile-blur-overlay');
      this.renderer.addClass(this.overlay, 'active');
      this.renderer.appendChild(document.body, this.overlay);
    }
  }

  private disableBlur(): void {
    if (this.overlay) {
      this.renderer.removeChild(document.body, this.overlay);
      this.overlay = null;
    }
  }
}
