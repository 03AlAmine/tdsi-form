// theme-detail.component.ts - Version améliorée
import { Component, Output, EventEmitter, signal, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Theme } from '../../../../core/model/models';

@Component({
  selector: 'app-theme-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-detail.component.html',
  styleUrls: ['./theme-detail.component.scss'],
})
export class ThemeDetailComponent {
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Theme>();
  @Output() delete = new EventEmitter<Theme>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private lastFocusedTrigger: HTMLElement | null = null;

  theme: Theme | null = null;
  isOpen = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.closeModal();
  }

  getDifficultyInfo(difficulty: string): { icon: string; color: string } {
    const map: Record<string, { icon: string; color: string }> = {
      débutant: {
        icon: 'fa-seedling',
        color: 'var(--tech-success)',
      },
      intermédiaire: {
        icon: 'fa-book',
        color: 'var(--tech-warning)',
      },
      avancé: {
        icon: 'fa-bolt',
        color: 'var(--tech-danger)',
      },
    };

    return (
      map[difficulty] || {
        icon: 'fa-circle-question',
        color: 'var(--gray-500)',
      }
    );
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      ouvert: 'success',
      complet: 'warning',
      fermé: 'danger',
    };
    return map[status] || 'neutral';
  }

  open(theme: Theme): void {
    this.theme = theme;
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.lastFocusedTrigger = document.activeElement as HTMLElement;
    setTimeout(() => {
      (this.host.nativeElement.querySelector('.modal-close') as HTMLElement | null)?.focus();
    });
  }

  closeModal(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
    this.lastFocusedTrigger?.focus();
    this.lastFocusedTrigger = null;
    this.close.emit();
  }

  onEdit(): void {
    if (this.theme) {
      this.edit.emit(this.theme);
      this.closeModal();
    }
  }

  onDelete(): void {
    if (this.theme) {
      this.delete.emit(this.theme);
      this.closeModal();
    }
  }
}
