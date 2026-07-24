// features/shared/components/ai-assistant/ai-assistant.component.ts
// ─────────────────────────────────────────────────────────────────────
// Assistant flottant du Club TDSI. Bulle en bas à droite → panneau de
// chat au clic. Contexte minimal (prochains workshops + thématiques)
// injecté dans le prompt système pour ancrer les réponses dans la
// réalité du club plutôt que de laisser le modèle inventer des dates
// ou des titres. Réutilise AiService.chatAssistant() (queue/throttle
// déjà en place, pas de nouvelle dépendance backend).
// ─────────────────────────────────────────────────────────────────────

import {
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../../../core/services/ai.service';
import { WorkshopService } from '../../../../core/services/workshop.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { take } from 'rxjs';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

const SUGGESTIONS = [
  'Quel est le prochain workshop ?',
  'Comment je rejoins le club ?',
  'Quelles thématiques sont proposées ?',
];

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss',
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  private readonly ai = inject(AiService);
  private readonly workshopService = inject(WorkshopService);
  private readonly themeService = inject(ThemeService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLElement>;

  readonly isOpen = signal(false);
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      text: "Salut 👋 Je suis l'assistant du Club TDSI. Je peux t'orienter vers un workshop, une thématique, ou t'expliquer comment rejoindre le club.",
    },
  ]);
  readonly loading = signal(false);
  readonly draft = signal('');
  readonly suggestions = SUGGESTIONS;
  readonly hasError = signal(false);

  private contextSummary = 'Aucune donnée live disponible pour le moment.';
  private shouldScroll = false;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadContext();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      this.shouldScroll = false;
    }
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  sendSuggestion(text: string): void {
    this.draft.set(text);
    this.send();
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.loading()) return;

    this.messages.update((list) => [...list, { role: 'user', text }]);
    this.draft.set('');
    this.hasError.set(false);
    this.loading.set(true);
    this.shouldScroll = true;

    const history = this.messages().map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.text,
    }));

    this.ai
      .chatAssistant([{ role: 'system', content: this.buildSystemPrompt() }, ...history])
      .then((reply) => {
        this.messages.update((list) => [
          ...list,
          { role: 'assistant', text: reply || "Je n'ai pas pu générer de réponse, réessaie dans un instant." },
        ]);
      })
      .catch(() => {
        this.hasError.set(true);
        this.messages.update((list) => [
          ...list,
          {
            role: 'assistant',
            text: "Petit souci de connexion avec le serveur IA — réessaie dans quelques secondes.",
          },
        ]);
      })
      .finally(() => {
        this.loading.set(false);
        this.shouldScroll = true;
      });
  }

  private buildSystemPrompt(): string {
    return (
      `Tu es l'assistant conversationnel du Club TDSI (Transmission de Données et Sécurité de l'Information), ` +
      `club étudiant de l'UCAD, Dakar (cybersécurité, IA, réseaux). ` +
      `Réponds en français, en 2 à 4 phrases maximum, ton chaleureux et direct, sans markdown. ` +
      `Tu aides à trouver un workshop, comprendre une thématique, ou t'inscrire au club. ` +
      `Si tu ne sais pas, dis-le et invite à consulter la page /workshops ou /thematiques. ` +
      `Voici le contexte réel actuel du club, à utiliser en priorité :\n${this.contextSummary}`
    );
  }

  private loadContext(): void {
    this.workshopService
      .getWorkshops()
      .pipe(take(1))
      .subscribe((workshops) => {
        const upcoming = [...workshops]
          .filter((w) => w.status === 'planifié' || w.status === 'en cours')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 4)
          .map(
            (w) =>
              `- "${w.themeTitle}" le ${new Date(w.date).toLocaleDateString('fr-FR')} (${w.location}, animé par ${w.presenter})`,
          )
          .join('\n');

        this.contextSummary =
          (upcoming ? `Prochains workshops :\n${upcoming}` : 'Aucun workshop planifié pour le moment.') +
          '\nPour rejoindre le club : page /inscription. Pour explorer les thématiques : page /thematiques.';
      });

    this.themeService
      .getThemes()
      .pipe(take(1))
      .subscribe((themes) => {
        const titles = themes.slice(0, 8).map((t) => t.title).join(', ');
        if (titles) {
          this.contextSummary += `\nThématiques disponibles : ${titles}.`;
        }
      });
  }
}
