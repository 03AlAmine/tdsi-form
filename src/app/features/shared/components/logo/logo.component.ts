// logo.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <div
      class="logo"
      [class.logo--lg]="size === 'lg'"
      [class.logo--sm]="size === 'sm'"
      [class.logo--glow]="glow"
    >
      <div class="logo__image-wrapper">
        <img [src]="logoPath" [alt]="alt" class="logo__image" />
        <div class="logo__pulse-ring"></div>
      </div>
      <div class="logo__text-wrapper">
        <span class="logo__text">Club</span>
        <span class="logo__text logo__text--gradient">TDSI</span>
        @if (showBadge) {
          <span class="logo__badge">Campus</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      position: relative;

      &__image-wrapper {
        position: relative;
        flex-shrink: 0;
      }

      &__image {
        width: 40px;
        height: 40px;
        object-fit: contain;
        filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.3));
        transition: all 0.3s ease;
      }

      &__pulse-ring {
        position: absolute;
        inset: -4px;
        border: 1px solid rgba(0, 212, 255, 0.3);
        border-radius: 50%;
        animation: pulseRing 2s ease-in-out infinite;
      }

      &__text-wrapper {
        display: flex;
        align-items: baseline;
        gap: 0.25rem;
        flex-wrap: wrap;
      }

      &__text {
        font-family: 'Space Grotesk', system-ui, sans-serif;
        font-weight: 700;
        font-size: 1.25rem;
        letter-spacing: -0.02em;
        color: var(--white);

        &--gradient {
          background: linear-gradient(135deg, var(--tech-cyan), var(--tech-blue));
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }
      }

      &__badge {
        font-size: 0.625rem;
        padding: 0.125rem 0.375rem;
        background: rgba(0, 212, 255, 0.15);
        border: 1px solid rgba(0, 212, 255, 0.3);
        border-radius: var(--radius-full);
        color: var(--tech-cyan);
        font-weight: 500;
        margin-left: 0.25rem;
      }

      // Sizes
      &--lg {
        gap: 1rem;

        .logo__image {
          width: 56px;
          height: 56px;
        }

        .logo__text {
          font-size: 1.75rem;
        }
      }

      &--sm {
        gap: 0.5rem;

        .logo__image {
          width: 32px;
          height: 32px;
        }

        .logo__text {
          font-size: 1rem;
        }
      }

      // Glow effect on hover
      &--glow:hover {
        .logo__image {
          filter: drop-shadow(0 0 15px rgba(0, 212, 255, 0.5));
        }
      }
    }

    @keyframes pulseRing {
      0%, 100% {
        opacity: 0.3;
        transform: scale(1);
      }
      50% {
        opacity: 1;
        transform: scale(1.1);
      }
    }
  `]
})
export class LogoComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() alt = 'Club TDSI Logo';
  @Input() glow = false;
  @Input() showBadge = false;

  logoPath = '/assets/images/logo.png';
}
