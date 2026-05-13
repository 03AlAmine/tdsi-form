// activity-presence.component.ts - Version améliorée
import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivityService } from '../../../../core/services/activity.service';
import { QrService } from '../../../../core/services/qr.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Activity, ActivityRegistration } from '../../../../core/model/activity.model';
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';

@Component({
  selector: 'app-activity-presence',
  standalone: true,
  imports: [CommonModule, RouterLink, QrScannerComponent],
  templateUrl: './activity-presence.component.html',
  styleUrls: ['./activity-presence.component.scss'],
})
export class ActivityPresenceComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private activityService = inject(ActivityService);
  private toast = inject(ToastService);
  readonly qrService = inject(QrService);

  activity = signal<Activity | null>(null);
  registrations = signal<ActivityRegistration[]>([]);
  loading = signal(true);
  filterType = signal<'all' | 'member' | 'guest'>('all');
  searchTerm = signal('');
  activeTab = signal<'liste' | 'scanner'>('liste');

  private subscription: Subscription | null = null;

  stats = computed(() => {
    const regs = this.registrations();
    return {
      total: regs.length,
      members: regs.filter(r => r.type === 'member').length,
      guests: regs.filter(r => r.type === 'guest').length,
      checkedIn: regs.filter(r => r.checkedIn).length,
      rate: regs.length ? Math.round((regs.filter(r => r.checkedIn).length / regs.length) * 100) : 0,
    };
  });

  filteredRegistrations = computed(() => {
    const type = this.filterType();
    const term = this.searchTerm().toLowerCase().trim();
    return this.registrations().filter(r => {
      const matchType = type === 'all' || r.type === type;
      const matchSearch = !term
        || r.name.toLowerCase().includes(term)
        || r.email.toLowerCase().includes(term)
        || (r.organization ?? '').toLowerCase().includes(term);
      return matchType && matchSearch;
    });
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.params['id'];

    const activity = await this.activityService.getActivity(id);
    this.activity.set(activity);

    this.subscription = this.activityService.getRegistrations(id).subscribe(regs => {
      this.registrations.set(regs);
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async checkIn(registration: ActivityRegistration): Promise<void> {
    try {
      await this.activityService.checkInGuest(registration.id!);
      this.toast.success(`${registration.name} — présence confirmée`);
    } catch (e: any) {
      this.toast.error(e.message ?? 'Erreur lors du check-in');
    }
  }

  onScannerCheckIn(registration: ActivityRegistration): void {
    this.toast.success(`✓ ${registration.name ?? 'Participant'} checké`);
  }

  exportCsv(): void {
    const headers = ['Nom', 'Email', 'Type', 'Organisation', 'Inscrit le', 'Présent', 'Heure check-in'];
    const rows = this.registrations().map(r => [
      r.name,
      r.email,
      r.type === 'member' ? 'Membre' : 'Invité',
      r.organization ?? '',
      r.registeredAt ? new Date(r.registeredAt).toLocaleString('fr-FR') : '',
      r.checkedIn ? 'Oui' : 'Non',
      r.checkedInAt ? new Date(r.checkedInAt).toLocaleString('fr-FR') : '',
    ]);

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presences-${this.activity()?.title ?? 'activite'}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.toast.success('Export CSV effectué');
  }

  getPresenceQr(id: string): string {
    return this.qrService.getQrUrl(`/activites/${id}/check-in`, 180);
  }

  async downloadPresenceQr(): Promise<void> {
    const activity = this.activity();
    if (!activity) return;
    const url = this.qrService.getQrUrl(`/activites/${activity.id}/check-in`, 400);
    const name = `qr-checkin-${activity.title.toLowerCase().replace(/\s+/g, '-')}`;
    await this.qrService.downloadQr(url, name);
    this.toast.success('QR code téléchargé');
  }
}
