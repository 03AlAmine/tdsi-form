import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
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
  @Input() theme: Theme | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Theme>();
  @Output() delete = new EventEmitter<Theme>();

  isOpen = signal(false);

  getDifficultyInfo(difficulty: string): { icon: string; color: string } {
    switch (difficulty) {
      case 'débutant':
        return { icon: '🌱', color: 'var(--accent-success)' };
      case 'intermédiaire':
        return { icon: '📘', color: 'var(--accent-warning)' };
      case 'avancé':
        return { icon: '⚡', color: 'var(--accent-danger)' };
      default:
        return { icon: '📚', color: 'var(--text-tertiary)' };
    }
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
    if (this.theme && confirm(`Supprimer définitivement "${this.theme.title}" ?`)) {
      this.delete.emit(this.theme);
      this.closeModal();
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ouvert': return 'success';
      case 'complet': return 'warning';
      case 'fermé': return 'danger';
      default: return 'neutral';
    }
  }
}
