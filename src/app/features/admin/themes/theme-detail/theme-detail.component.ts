// theme-detail.component.ts - Version améliorée
import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Theme } from '../../../../core/model/models';

@Component({
  selector: 'app-theme-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-detail.component.html',
  styleUrls: ['./theme-detail.component.scss']
})
export class ThemeDetailComponent {
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Theme>();
  @Output() delete = new EventEmitter<Theme>();

  theme: Theme | null = null;
  isOpen = signal(false);

  getDifficultyInfo(difficulty: string): { icon: string; color: string } {
    const map: Record<string, { icon: string; color: string }> = {
      'débutant': { icon: '🌱', color: 'var(--tech-success)' },
      'intermédiaire': { icon: '📘', color: 'var(--tech-warning)' },
      'avancé': { icon: '⚡', color: 'var(--tech-danger)' },
    };
    return map[difficulty] || { icon: '📚', color: 'var(--gray-500)' };
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      'ouvert': 'success',
      'complet': 'warning',
      'fermé': 'danger',
    };
    return map[status] || 'neutral';
  }

  open(theme: Theme): void {
    this.theme = theme;
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
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
