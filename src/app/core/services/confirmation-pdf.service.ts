/**
 * ConfirmationPdfService

 */

import { Injectable } from '@angular/core';
import { Activity, ActivityRegistration } from '../model/activity.model';

// Import lazy pour ne pas alourdir le bundle initial
type JsPDF = import('jspdf').jsPDF;

@Injectable({ providedIn: 'root' })
export class ConfirmationPdfService {

  // ── Couleurs et constantes ────────────────────────────────
  private readonly COLORS = {
    primary:    [59,  130, 246] as [number, number, number],   // bleu TDSI
    dark:       [15,  23,  42]  as [number, number, number],   // fond foncé
    surface:    [30,  41,  59]  as [number, number, number],   // surface card
    text:       [248, 250, 252] as [number, number, number],   // texte principal
    textMuted:  [148, 163, 184] as [number, number, number],   // texte secondaire
    success:    [34,  197, 94]  as [number, number, number],   // vert confirmation
    white:      [255, 255, 255] as [number, number, number],
  };

  private readonly TYPE_COLORS: Record<string, [number, number, number]> = {
    conference: [59, 130, 246],
    journee:    [139, 92, 246],
    hackathon:  [245, 158, 11],
    atelier:    [16, 185, 129],
    autre:      [107, 114, 128],
  };

  // ── API publique ──────────────────────────────────────────

  /**
   * Génère et télécharge le PDF de confirmation.
   * @param registration  L'inscription validée
   * @param activity      L'activité concernée
   * @param qrDataUrl     Data URL du QR code (optionnel — généré si absent)
   */
  async generateAndDownload(
    registration: ActivityRegistration,
    activity: Activity,
    qrDataUrl?: string
  ): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    await this.buildPdf(pdf, registration, activity, qrDataUrl);

    const filename = this.sanitizeFilename(
      `confirmation-${activity.title}-${registration.name}`
    );
    pdf.save(`${filename}.pdf`);
  }

  /**
   * Retourne le PDF en base64 (pour email ou prévisualisation).
   */
  async generateBase64(
    registration: ActivityRegistration,
    activity: Activity,
    qrDataUrl?: string
  ): Promise<string> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await this.buildPdf(pdf, registration, activity, qrDataUrl);
    return pdf.output('datauristring');
  }

  // ── Construction du PDF ───────────────────────────────────

  private async buildPdf(
    pdf: JsPDF,
    reg: ActivityRegistration,
    activity: Activity,
    qrDataUrl?: string
  ): Promise<void> {
    const W = 210; // A4 width mm
    const H = 297; // A4 height mm

    // ── Fond ──────────────────────────────────────────────
    this.setFill(pdf, this.COLORS.dark);
    pdf.rect(0, 0, W, H, 'F');

    // ── Bande colorée type activité ──────────────────────
    const typeColor = this.TYPE_COLORS[activity.type] ?? this.COLORS.primary;
    this.setFill(pdf, typeColor);
    pdf.rect(0, 0, W, 6, 'F');

    // ── En-tête ───────────────────────────────────────────
    // Logo / nom du club
    this.setFill(pdf, this.COLORS.surface);
    this.roundedRect(pdf, 15, 12, W - 30, 32, 3, 'F');

    this.setTextColor(pdf, this.COLORS.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('CLUB TDSI', 25, 25);

    this.setTextColor(pdf, this.COLORS.textMuted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('École Supérieure Polytechnique de Dakar', 25, 32);
    pdf.text('Technologies, Données & Systèmes d\'Information', 25, 38);

    // Icône type (rectangle coloré)
    this.setFill(pdf, typeColor);
    this.roundedRect(pdf, W - 50, 16, 35, 10, 2, 'F');
    this.setTextColor(pdf, this.COLORS.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(
      this.typeLabel(activity.type).toUpperCase(),
      W - 32.5, 22.5,
      { align: 'center' }
    );

    // ── Titre "Confirmation d'inscription" ────────────────
    let y = 56;
    this.setTextColor(pdf, this.COLORS.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('Confirmation d\'inscription', W / 2, y, { align: 'center' });

    // Ligne décorative
    y += 6;
    this.setFill(pdf, typeColor);
    pdf.rect(W / 2 - 25, y, 50, 1, 'F');

    // ── Nom du participant ─────────────────────────────────
    y += 12;
    this.setTextColor(pdf, this.COLORS.textMuted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('Participant', W / 2, y, { align: 'center' });

    y += 7;
    this.setTextColor(pdf, this.COLORS.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(reg.name, W / 2, y, { align: 'center' });

    if (reg.organization) {
      y += 6;
      this.setTextColor(pdf, this.COLORS.textMuted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(reg.organization, W / 2, y, { align: 'center' });
    }

    // ── Card activité ─────────────────────────────────────
    y += 14;
    this.setFill(pdf, this.COLORS.surface);
    this.roundedRect(pdf, 15, y, W - 30, 52, 3, 'F');

    // Bordure gauche colorée
    this.setFill(pdf, typeColor);
    pdf.rect(15, y, 3, 52, 'F');

    // Titre de l'activité
    this.setTextColor(pdf, this.COLORS.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const titleLines = pdf.splitTextToSize(activity.title, W - 50) as string[];
    pdf.text(titleLines, 24, y + 12);

    // Infos date / lieu
    const infoY = y + 12 + titleLines.length * 6 + 4;
    this.setTextColor(pdf, this.COLORS.textMuted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    // Date
    pdf.text('DATE', 24, infoY);
    this.setTextColor(pdf, this.COLORS.text);
    pdf.setFontSize(10);
    pdf.text(this.formatDate(activity.date), 24, infoY + 5);

    if (activity.endDate) {
      this.setTextColor(pdf, this.COLORS.textMuted);
      pdf.setFontSize(9);
      pdf.text(`au ${this.formatDate(activity.endDate)}`, 24, infoY + 10);
    }

    // Lieu
    const locX = W / 2;
    this.setTextColor(pdf, this.COLORS.textMuted);
    pdf.setFontSize(9);
    pdf.text('LIEU', locX, infoY);
    this.setTextColor(pdf, this.COLORS.text);
    pdf.setFontSize(10);
    const locLines = pdf.splitTextToSize(activity.location, 70) as string[];
    pdf.text(locLines, locX, infoY + 5);

    // Online badge si applicable
    if (activity.isOnline) {
      y += 44;
      this.setFill(pdf, this.COLORS.primary);
      this.roundedRect(pdf, 24, y, 22, 6, 2, 'F');
      this.setTextColor(pdf, this.COLORS.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.text('EN LIGNE', 35, y + 4.2, { align: 'center' });
      y -= 44;
    }

    // ── QR code ───────────────────────────────────────────
    y += 60;

    if (qrDataUrl) {
      // QR fourni en paramètre
      this.setFill(pdf, this.COLORS.surface);
      this.roundedRect(pdf, W / 2 - 32, y, 64, 74, 3, 'F');

      pdf.addImage(qrDataUrl, 'PNG', W / 2 - 26, y + 5, 52, 52);

      this.setTextColor(pdf, this.COLORS.textMuted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Scannez pour confirmer votre présence', W / 2, y + 64, { align: 'center' });
    } else {
      // Placeholder QR
      this.setFill(pdf, this.COLORS.surface);
      this.roundedRect(pdf, W / 2 - 32, y, 64, 74, 3, 'F');
      this.setTextColor(pdf, this.COLORS.textMuted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('QR code de présence', W / 2, y + 37, { align: 'center' });
      pdf.text('disponible le jour J', W / 2, y + 44, { align: 'center' });
    }

    // ── Numéro de confirmation ────────────────────────────
    y += 82;
    this.setTextColor(pdf, this.COLORS.textMuted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Référence d\'inscription', W / 2, y, { align: 'center' });

    y += 5;
    this.setTextColor(pdf, this.COLORS.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(
      reg.confirmationToken.slice(0, 20).toUpperCase(),
      W / 2, y,
      { align: 'center' }
    );

    // ── Note bas de page ──────────────────────────────────
    y += 18;
    this.setFill(pdf, this.COLORS.surface);
    pdf.rect(0, y, W, 1, 'F');

    y += 8;
    this.setTextColor(pdf, this.COLORS.textMuted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(
      'Présentez ce document à l\'entrée de l\'événement.',
      W / 2, y,
      { align: 'center' }
    );

    y += 5;
    pdf.text(
      `Inscrit le ${this.formatDate(reg.registeredAt)} · ${reg.email}`,
      W / 2, y,
      { align: 'center' }
    );

    y += 5;
    pdf.text(
      'club-tdsi-sign.web.app · Club TDSI — ESP Dakar',
      W / 2, y,
      { align: 'center' }
    );
  }

  // ── Helpers de dessin ─────────────────────────────────────

  private setFill(pdf: JsPDF, color: [number, number, number]): void {
    pdf.setFillColor(color[0], color[1], color[2]);
  }

  private setTextColor(pdf: JsPDF, color: [number, number, number]): void {
    pdf.setTextColor(color[0], color[1], color[2]);
  }

  /**
   * Rectangle arrondi — jsPDF n'a pas de méthode native,
   * on simule avec des arcs et des lignes.
   */
  private roundedRect(
    pdf: JsPDF,
    x: number, y: number,
    w: number, h: number,
    r: number,
    style: 'F' | 'S' | 'FD' = 'F'
  ): void {
    pdf.roundedRect(x, y, w, h, r, r, style);
  }

  // ── Helpers utilitaires ───────────────────────────────────

  private formatDate(date: Date): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
      hour:    '2-digit',
      minute:  '2-digit',
    }).format(date instanceof Date ? date : new Date(date));
  }

  private typeLabel(type: string): string {
    const map: Record<string, string> = {
      conference: 'Conférence',
      journee:    'Journée',
      hackathon:  'Hackathon',
      atelier:    'Atelier',
      autre:      'Événement',
    };
    return map[type] ?? 'Événement';
  }

  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // supprimer accents
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
  }
}
