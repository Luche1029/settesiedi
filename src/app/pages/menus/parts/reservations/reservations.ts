import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService, RsvpStatus } from '../../../../services/reservation.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservations.html',
  styleUrl: './reservations.scss'
})
export class Reservations implements OnInit {
  @Input() eventId!: string;

  private svc = inject(ReservationService);
  private auth = inject(AuthService);

  rows = signal<any[]>([]);
  message = signal('');

  async ngOnInit(){ await this.load(); }

  async load() {
    try {
      const list = await this.svc['listByEvent']?.(this.eventId); // se hai aggiunto il metodo nel service
      if (list) this.rows.set(list);
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento prenotazioni');
    }
  }

  async set(status: RsvpStatus) {
    this.auth.restore();
    const user = this.auth.user();
    if (!user) { this.message.set('Fai login'); return; }
    try {
      await this.svc.setStatus(this.eventId, user.id, status);
      await this.load();
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore aggiornamento');
    }
  }
}
