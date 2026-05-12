// search-bar.component.ts
import { Component, output, signal, HostListener, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-bar" [class.focused]="isFocused">
      <div class="search-icon">
        <i class="fas fa-search"></i>
      </div>
      <input
        #searchInput
        type="text"
        [ngModel]="searchTerm()"
        (ngModelChange)="onSearch($event)"
        (focus)="isFocused = true"
        (blur)="isFocused = false"
        placeholder="Rechercher..."
        class="search-input"
      />
      @if (searchTerm()) {
        <button class="search-clear" (click)="clear()" title="Effacer">
          <i class="fas fa-times"></i>
        </button>
      }
      <div class="search-border"></div>
    </div>
  `,
  styles: [`
    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background: rgba(21, 30, 45, 0.8);
      border: 1px solid rgba(0, 212, 255, 0.15);
      border-radius: var(--radius-lg);
      transition: all var(--transition-fast);

      &.focused {
        border-color: var(--tech-cyan);
        box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
      }
    }

    .search-icon {
      display: flex;
      align-items: center;

      i {
        font-size: 0.875rem;
        color: var(--gray-500);
        transition: color var(--transition-fast);
      }
    }

    .search-bar.focused .search-icon i {
      color: var(--tech-cyan);
    }

    .search-input {
      flex: 1;
      background: none;
      border: none;
      color: var(--white);
      font-size: 0.875rem;
      outline: none;

      &::placeholder {
        color: var(--gray-500);
      }
    }

    .search-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: var(--gray-500);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);

      i {
        font-size: 0.75rem;
      }

      &:hover {
        background: rgba(239, 68, 68, 0.15);
        color: var(--tech-danger);
      }
    }

    .search-border {
      position: absolute;
      bottom: 0;
      left: 50%;
      width: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--tech-cyan), var(--tech-purple));
      transition: all 0.3s ease;
      border-radius: var(--radius-full);
      pointer-events: none;
    }

    .search-bar.focused .search-border {
      width: 100%;
      left: 0;
    }
  `]
})
export class SearchBarComponent {
  searchTerm = signal('');
  searchChange = output<string>();
  isFocused = false;

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  onSearch(value: string): void {
    this.searchTerm.set(value);
    this.searchChange.emit(value);
  }

  clear(): void {
    this.searchTerm.set('');
    this.searchChange.emit('');
    this.searchInput()?.nativeElement.focus();
  }
}
