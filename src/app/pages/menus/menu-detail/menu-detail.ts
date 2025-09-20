import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { EventService } from '../../../services/event.service';
import { EventItems } from '../parts/event-items/event-items';
import { Reservations } from '../parts/reservations/reservations';
import { Expenses } from '../parts/expenses/expenses';
import { Balances } from '../parts/balances/balances';

@Component({
  selector: 'app-menu-detail',
  standalone: true,
  imports: [CommonModule, EventItems, Reservations, Expenses, Balances],
  templateUrl: './menu-detail.html'
})
export class MenuDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private events = inject(EventService);

  eventId = '';
  tab: 'items'|'rsvp'|'exp'|'bal' = 'items';
  loading = signal(false);
  message = signal('');
  event = signal<any|null>(null);

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    await this.load();
  }

  async load() {
    this.loading.set(true); this.message.set('');
    try {
      const data = await this.events.getWithItems(this.eventId);
      this.event.set(data);
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento evento');
    } finally {
      this.loading.set(false);
    }
  }
}
 