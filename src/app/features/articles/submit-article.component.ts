// features/articles/submit-article.component.ts
import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArticleService } from '../../core/services/article.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ArticleCategory } from '../../core/model/article.model';

@Component({
  selector: 'app-submit-article',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './submit-article.component.html',
  styleUrls: ['./submit-article.component.scss'],
})
export class SubmitArticleComponent {
  @ViewChild('contentArea') contentArea!: ElementRef<HTMLTextAreaElement>;

  private articleService = inject(ArticleService);
  private authService    = inject(AuthService);
  private toast          = inject(ToastService);

  submitting = signal(false);
  submitted  = signal(false);

  categories: ArticleCategory[] = [
    'Cybersécurité',
    'Intelligence Artificielle',
    'Développement Web',
    'Cloud & DevOps',
    'Cryptographie',
    'Réseaux',
    'Autre',
  ];

  form = {
    title:       '',
    summary:     '',
    content:     '',
    category:    '' as ArticleCategory,
    tagsRaw:     '',
    authorName:  '',
    authorEmail: '',
  };

  constructor() {
    const user = this.authService.currentUser;
    if (user) {
      this.form.authorName  = user.displayName || '';
      this.form.authorEmail = user.email || '';
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  get isLoggedIn(): boolean {
    return !!this.authService.currentUser;
  }

  get wordCount(): number {
    return this.form.content.trim().split(/\s+/).filter(Boolean).length;
  }

  get parsedTags(): string[] {
    return this.form.tagsRaw
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
  }

  get isValid(): boolean {
    return !!(
      this.form.title.trim() &&
      this.form.summary.trim() &&
      this.form.content.trim().length >= 100 &&
      this.form.category &&
      this.form.authorName.trim() &&
      this.form.authorEmail.trim()
    );
  }

  /** Completion % for the sidebar progress bar (4 steps) */
  get completionPercent(): number {
    let done = 0;
    if (this.form.authorName && this.form.authorEmail) done++;
    if (this.form.title && this.form.category)         done++;
    if (this.form.summary)                              done++;
    if (this.wordCount >= 100)                          done++;
    return Math.round((done / 4) * 100);
  }

  // ── Markdown toolbar helper ────────────────────────────────────────────────
  insertMd(prefix: string, suffix = ''): void {
    const ta = this.contentArea?.nativeElement;
    if (!ta) return;

    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const selected = this.form.content.substring(start, end);
    const replacement = `${prefix}${selected || 'texte'}${suffix}`;

    this.form.content =
      this.form.content.substring(0, start) +
      replacement +
      this.form.content.substring(end);

    // Restore cursor inside inserted text
    setTimeout(() => {
      ta.focus();
      const cursor = start + prefix.length;
      ta.setSelectionRange(cursor, cursor + (selected || 'texte').length);
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async submit(): Promise<void> {
    if (!this.isValid || this.submitting()) return;

    this.submitting.set(true);
    try {
      const user = this.authService.currentUser;
      await this.articleService.submitArticle({
        title:       this.form.title.trim(),
        summary:     this.form.summary.trim(),
        content:     this.form.content.trim(),
        category:    this.form.category,
        tags:        this.parsedTags,
        authorId:    user?.uid,
        authorName:  this.form.authorName.trim(),
        authorEmail: this.form.authorEmail.trim(),
      });
      this.submitted.set(true);
      this.toast.success('Article soumis avec succès !');
    } catch {
      this.toast.error('Erreur lors de la soumission. Réessayez.');
    } finally {
      this.submitting.set(false);
    }
  }
}
