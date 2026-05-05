import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <div
      class="logo"
      [class.logo--lg]="size === 'lg'"
      [class.logo--sm]="size === 'sm'"
    >
      <img [src]="logoPath" [alt]="alt" />
      <span class="logo__text">Club TDSI</span>
    </div>
  `,
  styles: [
    `
      .logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .logo img {
        width: 36px;
        height: 36px;
        object-fit: contain;
      }

      .logo__text {
        font-family: 'Space Grotesk', system-ui, sans-serif;
        font-weight: 700;
        font-size: 1.25rem;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
      }

      .logo--lg img {
        width: 48px;
        height: 48px;
      }

      .logo--lg .logo__text {
        font-size: 1.5rem;
      }

      .logo--sm img {
        width: 28px;
        height: 28px;
      }

      .logo--sm .logo__text {
        font-size: 1rem;
      }
    `,
  ],
})
export class LogoComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() alt = 'Club TDSI Logo';

  // Remplace par le chemin de ton logo
  logoPath = '/assets/images/logo.png';
}
