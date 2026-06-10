// calendar.component.ts
import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorkshopService } from '../../core/services/workshop.service';
import { ActivityService } from '../../core/services/activity.service';
import { Subscription } from 'rxjs';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'workshop' | 'activity';
  location?: string;
  workshopId?: string;
  activityId?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  hasWorkshop: boolean;
  hasActivity: boolean;
}

@Component({
  selector: 'app-member-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class MemberCalendarComponent implements OnInit, OnDestroy {
  private workshopService = inject(WorkshopService);
  private activityService = inject(ActivityService);
  private router = inject(Router);
  private el = inject(ElementRef);

  currentDate  = signal(new Date());
  events       = signal<CalendarEvent[]>([]);
  selectedDay  = signal<CalendarDay | null>(null);

  // 'left' = on va vers le passé, 'right' = vers le futur, '' = initial
  slideDirection = signal<'left' | 'right' | ''>('');
  isSliding      = signal(false);

  private subscriptions: Subscription[] = [];

  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  currentMonthName = computed(() =>
    this.currentDate().toLocaleString('fr-FR', { month: 'long' })
  );

  currentYear = computed(() => this.currentDate().getFullYear());

  calendarDays = computed(() => {
    const date  = this.currentDate();
    const year  = date.getFullYear();
    const month = date.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth  = new Date(year, month + 1, 0);

    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(this.createCalendarDay(new Date(year, month - 1, prevMonthLastDay - i), false, today));
    }
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push(this.createCalendarDay(new Date(year, month, i), true, today));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(this.createCalendarDay(new Date(year, month + 1, i), false, today));
    }
    return days;
  });

  selectedDayEvents = computed(() => this.selectedDay()?.events ?? []);

  ngOnInit(): void { this.loadEvents(); }
  ngOnDestroy(): void { this.subscriptions.forEach(s => s.unsubscribe()); }

  // ── Navigation avec slide ──────────────────────────────────

  previousMonth(): void { this.navigateMonth('left'); }
  nextMonth():     void { this.navigateMonth('right'); }

  private navigateMonth(dir: 'left' | 'right'): void {
    if (this.isSliding()) return;

    this.slideDirection.set(dir);
    this.isSliding.set(true);
    this.selectedDay.set(null);

    // Laisse le temps à la classe CSS d'être appliquée (1 frame)
    requestAnimationFrame(() => {
      const newDate = new Date(this.currentDate());
      newDate.setMonth(newDate.getMonth() + (dir === 'right' ? 1 : -1));
      this.currentDate.set(newDate);

      // Retire la classe après la durée de l'animation
      setTimeout(() => {
        this.slideDirection.set('');
        this.isSliding.set(false);
      }, 320);
    });
  }

  // ── Sélection avec ripple ─────────────────────────────────

  selectDay(day: CalendarDay, event: MouseEvent): void {
    this.triggerRipple(event);
    if (this.selectedDay()?.date.toDateString() === day.date.toDateString()) {
      this.selectedDay.set(null);
    } else {
      this.selectedDay.set(day);
    }
  }

  private triggerRipple(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const ripple = document.createElement('span');
    const rect   = target.getBoundingClientRect();

    const size = Math.max(rect.width, rect.height) * 2;
    const x    = event.clientX - rect.left - size / 2;
    const y    = event.clientY - rect.top  - size / 2;

    ripple.className = 'ripple';
    ripple.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${x}px; top: ${y}px;
    `;

    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  // ── Navigation événement ──────────────────────────────────

  navigateToEvent(event: CalendarEvent): void {
    if (event.type === 'workshop' && event.workshopId) {
      this.router.navigate(['/workshops']);
      setTimeout(() => {
        const el = document.querySelector(`[data-workshop-id="${event.workshopId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } else if (event.type === 'activity' && event.activityId) {
      this.router.navigate(['/activites', event.activityId]);
    }
  }

  // ── Données ───────────────────────────────────────────────

  private createCalendarDay(date: Date, isCurrentMonth: boolean, today: Date): CalendarDay {
    const events = this.events().filter(e =>
      new Date(e.date).toDateString() === date.toDateString()
    );
    return {
      date, isCurrentMonth,
      isToday: date.toDateString() === today.toDateString(),
      events,
      hasWorkshop: events.some(e => e.type === 'workshop'),
      hasActivity: events.some(e => e.type === 'activity'),
    };
  }

  private async loadEvents(): Promise<void> {
    this.subscriptions.push(
      this.workshopService.getWorkshops().subscribe(workshops => {
        const workshopEvents: CalendarEvent[] = workshops
          .filter(w => w.status === 'planifié' || w.status === 'en cours')
          .map(w => ({
            id: w.id!, title: w.themeTitle, date: new Date(w.date),
            type: 'workshop' as const, location: w.location, workshopId: w.id,
          }));
        this.events.update(prev => [...prev.filter(e => e.type !== 'workshop'), ...workshopEvents]);
      })
    );
    this.subscriptions.push(
      this.activityService.getPublishedActivities().subscribe(activities => {
        const activityEvents: CalendarEvent[] = activities.map(a => ({
          id: a.id!, title: a.title, date: new Date(a.date),
          type: 'activity' as const, location: a.location, activityId: a.id,
        }));
        this.events.update(prev => [...prev.filter(e => e.type !== 'activity'), ...activityEvents]);
      })
    );
  }
}
