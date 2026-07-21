// core/services/email.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────
// EmailService — envoie les emails transactionnels via le backend
// Node (SMTP OVH, voir tdsi-backend/mailer.js). Miroir de
// NotificationService mais pour le canal email : mêmes déclencheurs,
// best-effort côté appelant (un échec d'envoi ne doit jamais faire
// échouer l'action métier). Le HTML est entièrement généré côté
// serveur à partir d'un nom de template whitelisté — ce service ne
// fait que poser la requête.
// ─────────────────────────────────────────────────────────────
type EmailTemplate =
  | 'welcome'
  | 'theme_created'
  | 'workshop_created'
  | 'workshop_cancelled'
  | 'waitlist_promoted'
  | 'submission_received_student'
  | 'submission_received_admin'
  | 'submission_approved'
  | 'submission_refused'
  | 'theme_interest_threshold';

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly API_URL = `${environment.apiUrl}/api/email`;

  // ── Coeur générique ─────────────────────────────────────────
  // `to` : une adresse ou un tableau (le backend gère le Bcc groupé).
  // Ne rejette jamais côté appelant : on logue et on avale l'erreur,
  // car l'email est un bonus par rapport à la notification in-app
  // (déjà écrite en base au moment où ce service est appelé).
  private async send(
    template: EmailTemplate,
    to: string | string[],
    data: Record<string, unknown> = {},
  ): Promise<void> {
    if (!to || (Array.isArray(to) && to.length === 0)) return;

    try {
      const res = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-email-key': environment.emailApiKey,
        },
        body: JSON.stringify({ template, to, data }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[Email] ${template} → ${res.status}: ${errText}`);
      }
    } catch (e) {
      console.error(`[Email] Échec envoi "${template}":`, e);
    }
  }

  // ── Compte / inscription ────────────────────────────────────
  sendWelcome(to: string, displayName: string): Promise<void> {
    return this.send('welcome', to, { displayName });
  }

  // ── Thématiques ──────────────────────────────────────────────
  sendThemeCreated(to: string[], themeTitle: string): Promise<void> {
    return this.send('theme_created', to, { themeTitle });
  }

  sendThemeInterestThreshold(
    to: string[],
    themeTitle: string,
    count: number,
  ): Promise<void> {
    return this.send('theme_interest_threshold', to, { themeTitle, count });
  }

  // ── Workshops ────────────────────────────────────────────────
  sendWorkshopCreated(
    to: string[],
    themeTitle: string,
    presenter: string,
    date: Date,
  ): Promise<void> {
    return this.send('workshop_created', to, {
      themeTitle,
      presenter,
      date: date.toISOString(),
    });
  }

  sendWorkshopCancelled(to: string[], themeTitle: string): Promise<void> {
    return this.send('workshop_cancelled', to, { themeTitle });
  }

  sendWaitlistPromoted(to: string, themeTitle: string): Promise<void> {
    return this.send('waitlist_promoted', to, { themeTitle });
  }

  // ── Soumissions de thématiques ──────────────────────────────
  sendSubmissionReceivedStudent(to: string, proposedTitle: string): Promise<void> {
    return this.send('submission_received_student', to, { proposedTitle });
  }

  sendSubmissionReceivedAdmin(
    to: string[],
    studentName: string,
    proposedTitle: string,
  ): Promise<void> {
    return this.send('submission_received_admin', to, { studentName, proposedTitle });
  }

  sendSubmissionApproved(to: string, proposedTitle: string): Promise<void> {
    return this.send('submission_approved', to, { proposedTitle });
  }

  sendSubmissionRefused(
    to: string,
    proposedTitle: string,
    comment?: string,
  ): Promise<void> {
    return this.send('submission_refused', to, { proposedTitle, comment });
  }
}
