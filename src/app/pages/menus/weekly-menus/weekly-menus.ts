import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventService, EventCardVM } from '../../../services/event.service';
import { ReservationService, RsvpStatus } from '../../../services/reservation.service';
import { AuthService } from '../../../services/auth.service';

function mondayOfWeek(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;       // Sun=0 -> 7
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  x.setUTCHours(0,0,0,0);
  return x;
}
function addDays(date: Date, n: number) {
  const x = new Date(date); x.setUTCDate(x.getUTCDate() + n); return x;
}
function toISODate(date: Date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

@Component({
  selector: 'app-weekly-menus',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekly-menus.html'
})
export class WeeklyMenus implements OnInit {
  private eventsSvc = inject(EventService);
  private rsvpSvc = inject(ReservationService);
  private auth = inject(AuthService);

  monday = signal<Date>(mondayOfWeek(new Date()));
  startISO = computed(() => toISODate(this.monday()));
  endISO   = computed(() => toISODate(addDays(this.monday(), 6)));

  loading = signal(false);
  message = signal('');
  items   = signal<EventCardVM[]>([]);

  user = computed(() => this.auth.user());

  async ngOnInit() {
    this.auth.restore();
    await this.load();
  }

  async load() {
    this.loading.set(true); this.message.set('');
    try {
      const data = await this.eventsSvc.listByWeekWithStats(this.startISO(), this.endISO());
      this.items.set(data);
    } catch (e: any) {
      this.message.set(e.message ?? 'Errore caricamento');
    } finally {
      this.loading.set(false);
    }
  }

  prevWeek() {
    this.monday.set(addDays(this.monday(), -7));
    this.load();
  }
  nextWeek() {
    this.monday.set(addDays(this.monday(), 7));
    this.load();
  }

  async rsvp(ev: EventCardVM, status: RsvpStatus) {
    if (!this.user()) { this.message.set('Fai login'); return; }
    try {
      await this.rsvpSvc.setStatus(ev.id, this.user()!.id, status);
      // aggiorna conteggi localmente per UX snappy
      const delta = { going: 1, maybe: 0, not_going: 0 }[status] ?? 0;
      // per semplicità, non sappiamo il vecchio stato → ricarichiamo la lista
      await this.load();
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore RSVP');
    }
  }

  weekLabel() {
    const s = this.startISO(), e = this.endISO();
    const sd = new Date(s); const ed = new Date(e);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { day:'2-digit', month:'short' });
    return `${fmt(sd)} → ${fmt(ed)}`;
  }
}
