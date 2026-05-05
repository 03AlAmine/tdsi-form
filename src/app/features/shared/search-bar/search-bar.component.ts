import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-bar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        [ngModel]="searchTerm()"
        (ngModelChange)="onSearch($event)"
        placeholder="Rechercher..."
        class="search-input"
      />
      @if (searchTerm()) {
        <button class="search-clear" (click)="clear()">
          ✕
        </button>
      }
    </div>
  `,
  styles: [`
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);

      &:focus-within {
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      svg {
        color: var(--text-tertiary);
        flex-shrink: 0;
      }
    }

    .search-input {
      flex: 1;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 0.8125rem;

      &:focus {
        outline: none;
      }

      &::placeholder {
        color: var(--text-tertiary);
      }
    }

    .search-clear {
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 0.125rem;
      border-radius: var(--radius-sm);

      &:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.05);
      }
    }
  `]
})
export class SearchBarComponent {
  searchTerm = signal('');
  searchChange = output<string>();

  onSearch(value: string): void {
    this.searchTerm.set(value);
    this.searchChange.emit(value);
  }

  clear(): void {
    this.searchTerm.set('');
    this.searchChange.emit('');
  }
}
