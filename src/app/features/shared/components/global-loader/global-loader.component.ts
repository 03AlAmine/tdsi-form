import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../../core/services/loading.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loadingService.isLoading()) {
      <div class="global-loader-overlay">
        <div class="loader-container">
          <div class="spinner-ring"></div>
          <div class="spinner-ring-inner"></div>
          <div class="loader-logo">
            <img src="/assets/images/logo.png" alt="TDSI Club" />
          </div>
        </div>
        <div class="loader-text">{{ loadingService.getMessage() }}</div>
      </div>
    }
  `,
  styles: [`
    .global-loader-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 15, 26, 0.95);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      animation: fadeIn 0.2s ease-out;
    }

    .loader-container {
      position: relative;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spinner-ring {
      position: absolute;
      width: 80px;
      height: 80px;
      border: 3px solid rgba(59, 130, 246, 0.1);
      border-top-color: #3b82f6;
      border-right-color: #60a5fa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner-ring-inner {
      position: absolute;
      width: 55px;
      height: 55px;
      border: 3px solid rgba(96, 165, 250, 0.1);
      border-bottom-color: #3b82f6;
      border-left-color: #60a5fa;
      border-radius: 50%;
      animation: spin-reverse 0.6s linear infinite;
    }

    .loader-logo {
      width: 32px;
      height: 32px;
      animation: pulse 1s ease-in-out infinite;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }

    .loader-text {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      color: var(--accent-primary);
      letter-spacing: 2px;
      animation: blink 1.5s ease-in-out infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes spin-reverse {
      to { transform: rotate(-360deg); }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class GlobalLoaderComponent {
  loadingService = inject(LoadingService);
}
