import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class QrService {

  // ✅ URL de base dynamique : on utilise le domaine réellement utilisé par
  // l'utilisateur (window.location.origin) au lieu d'une URL Firebase
  // Hosting figée en dur. Ainsi, si l'app est déployée sur un autre projet
  // Firebase, un domaine personnalisé, ou consultée en local, les QR codes
  // générés pointent toujours vers le bon endroit — plus besoin de
  // régénérer les QR codes après chaque changement d'hébergement.
  private get BASE_URL(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost:4200';
  }

  /**
   * Génère l'URL du QR code via QuickChart.io (plus fiable que Google Charts)
   */
  getQrUrl(path: string, size = 200): string {
    const fullUrl = `${this.BASE_URL}${path}`;
    const encoded = encodeURIComponent(fullUrl);
    // QuickChart.io est plus rapide et plus fiable
    return `https://quickchart.io/qr?text=${encoded}&size=${size}`;
  }

  /** QR vers le formulaire de présence d'un workshop */
  presenceQrUrl(workshopId: string, size = 200): string {
    return this.getQrUrl(`/espace-membre/presence/${workshopId}`, size);
  }

  /** QR vers la page publique d'un workshop */
  workshopPublicQrUrl(workshopId: string, size = 200): string {
    return this.getQrUrl(`/workshops/${workshopId}/register`, size);
  }

  /** QR vers une thématique */
  themeQrUrl(themeId: string, size = 200): string {
    return this.getQrUrl(`/thematiques?theme=${themeId}`, size);
  }

  /** Télécharge le QR code comme image PNG */
  async downloadQr(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Erreur téléchargement QR:', error);
    }
  }
}
