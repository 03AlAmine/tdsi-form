// member-dashboard.component.ts - Ajouter la méthode getUserFirstName()

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-member-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './member-dashboard.component.html',
  styleUrls: ['./member-dashboard.component.scss'],
})
export class MemberDashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);

  user = this.authService.currentUser;

  stats = signal({
    totalThemes: 0,
    upcomingWorkshops: 0,
    mySubmissions: 0,
    myRegistrations: 0,
  });

  recentThemes = signal<any[]>([]);
  upcomingWorkshops = signal<any[]>([]);
  loading = signal(true);

  private subscriptions: Subscription[] = [];

  // ✅ Nouvelle méthode pour obtenir le prénom en toute sécurité
  getUserFirstName(): string {
    if (!this.user?.displayName) return 'Membre';
    return this.user.displayName.split(' ')[0];
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  private loadData(): void {
    this.loading.set(true);

    // Charger les thématiques
    this.subscriptions.push(
      this.themeService.getThemes().subscribe(themes => {
        this.stats.update(s => ({ ...s, totalThemes: themes.length }));
        this.recentThemes.set(themes.slice(0, 4));
      })
    );

    // Charger les workshops
    this.subscriptions.push(
      this.workshopService.getWorkshops().subscribe(workshops => {
        const upcoming = workshops.filter(w => w.status === 'planifié');
        this.stats.update(s => ({ ...s, upcomingWorkshops: upcoming.length }));
        this.upcomingWorkshops.set(upcoming.slice(0, 3));
      })
    );

    // Charger les soumissions de l'utilisateur
    if (this.user?.uid) {
      this.subscriptions.push(
        this.themeService.getMySubmissions(this.user.uid).subscribe(subs => {
          this.stats.update(s => ({ ...s, mySubmissions: subs.length }));
        })
      );
    }

    // Charger les inscriptions de l'utilisateur
    if (this.user?.uid) {
      this.subscriptions.push(
        this.workshopService.getWorkshops().subscribe(workshops => {
          const registrations = workshops.filter(w => w.registrations?.includes(this.user!.uid));
          this.stats.update(s => ({ ...s, myRegistrations: registrations.length }));
          this.loading.set(false);
        })
      );
    }
  }
}
