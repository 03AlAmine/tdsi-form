import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="nf-page">
      <div class="nf-bg">
        <div class="nf-grid"></div>
        <div class="nf-glow"></div>
      </div>

      <div class="nf-container">
        <div class="nf-card">
          <!-- Code erreur animé -->
          <div class="nf-code font-mono">
            <span class="nf-code__digit" style="--i:0">4</span>
            <span class="nf-code__digit nf-code__digit--accent" style="--i:1">0</span>
            <span class="nf-code__digit" style="--i:2">4</span>
          </div>

          <!-- Terminal-style message -->
          <div class="nf-terminal font-mono">
            <span class="nf-terminal__prompt">$ </span>
            <span class="nf-terminal__cmd">GET {{ path }}</span>
            <span class="nf-terminal__cursor" [class.blink]="cursorVisible">█</span>
            <br />
            <span class="nf-terminal__err">Error: Route not found — 404</span>
          </div>

          <h1 class="nf-title">Page introuvable</h1>
          <p class="nf-sub">
            Cette page n'existe pas ou a été déplacée. Vérifie l'URL ou retourne à l'accueil.
          </p>

          <div class="nf-actions">
            <a routerLink="/" class="btn btn--primary">
              ← Retour à l'accueil
            </a>
            <a routerLink="/connexion" class="btn btn--outline">
              Se connecter
            </a>
          </div>

          <!-- Liens rapides -->
          <div class="nf-links">
            <span class="nf-links__label font-mono">Liens utiles :</span>
            <a routerLink="/thematiques">Thématiques</a>
            <span>·</span>
            <a routerLink="/workshops">Workshops</a>
            <span>·</span>
            <a routerLink="/espace-membre">Mon espace</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .nf-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      background: var(--bg-primary);
    }

    /* Background grid + glow */
    .nf-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .nf-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(var(--border-light) 1px, transparent 1px),
        linear-gradient(90deg, var(--border-light) 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: 0.4;
    }

    .nf-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 400px;
      background: radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%);
      filter: blur(40px);
    }

    /* Card */
    .nf-container {
      position: relative;
      z-index: 2;
      width: 100%;
      padding: 2rem var(--spacing-lg);
      display: flex;
      justify-content: center;
    }

    .nf-card {
      background: var(--bg-card);
      backdrop-filter: var(--backdrop-blur);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      padding: 3rem 2.5rem;
      max-width: 520px;
      width: 100%;
      text-align: center;
      animation: fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* 404 digits */
    .nf-code {
      display: flex;
      justify-content: center;
      gap: 0.25rem;
      margin-bottom: 1.75rem;
    }

    .nf-code__digit {
      font-size: clamp(5rem, 15vw, 7rem);
      font-weight: 800;
      line-height: 1;
      color: var(--text-primary);
      opacity: 0;
      animation: digitIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      animation-delay: calc(var(--i) * 0.1s + 0.2s);

      &--accent {
        color: var(--accent-primary);
        text-shadow: 0 0 40px rgba(59,130,246,0.5);
      }
    }

    @keyframes digitIn {
      from { opacity: 0; transform: translateY(-16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Terminal */
    .nf-terminal {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.75rem 1rem;
      font-size: 0.8rem;
      text-align: left;
      margin-bottom: 1.75rem;
      line-height: 1.7;
      animation: fadeUp 0.4s 0.5s both;
    }

    .nf-terminal__prompt { color: var(--accent-success); }
    .nf-terminal__cmd    { color: var(--text-secondary); }
    .nf-terminal__err    { color: var(--accent-danger); display: block; margin-top: 0.25rem; }

    .nf-terminal__cursor {
      color: var(--accent-primary);
      &.blink { animation: blink 1s step-end infinite; }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }

    /* Text */
    .nf-title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.625rem;
      animation: fadeUp 0.4s 0.55s both;
    }

    .nf-sub {
      font-size: 0.9375rem;
      color: var(--text-secondary);
      line-height: 1.6;
      margin-bottom: 2rem;
      animation: fadeUp 0.4s 0.6s both;
    }

    /* Actions */
    .nf-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 2rem;
      animation: fadeUp 0.4s 0.65s both;
    }

    /* Quick links */
    .nf-links {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
      font-size: 0.8125rem;
      animation: fadeUp 0.4s 0.7s both;

      &__label {
        color: var(--text-tertiary);
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        margin-right: 0.25rem;
      }

      a {
        color: var(--accent-primary);
        transition: color var(--transition-fast);
        &:hover { color: var(--accent-primary-hover); }
      }

      span { color: var(--text-tertiary); }
    }
  `]
})
export class NotFoundComponent implements OnInit, OnDestroy {
  path = window.location.pathname;
  cursorVisible = true;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    // Démarre le curseur clignotant après un court délai
    this.timer = setTimeout(() => { this.cursorVisible = true; }, 800);
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }
}
