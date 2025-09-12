import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../../../services/expense.service';
import { AuthService } from '../../../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl:'./expenses.html'
})
export class Expenses implements OnInit {
  @Input() eventId!: string;

  private svc = inject(ExpenseService);
  private auth = inject(AuthService);

  rows = signal<any[]>([]);
  message = signal('');
  amount = 0;
  description = '';

  async ngOnInit(){ await this.load(); }

  async load() {
    try {
      const list = await this.svc.listByEvent(this.eventId);
      this.rows.set(list);
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento spese');
    }
  }

  async add() {
    this.auth.restore();
    const user = this.auth.user();
    if (!user) { this.message.set('Fai login'); return; }
    if (!this.amount || this.amount <= 0) { this.message.set('Importo non valido'); return; }
    try {
      await this.svc.addEqualSplit(this.eventId, user.id, Number(this.amount), this.description || '');
      this.amount = 0; this.description = '';
      await this.load();
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore inserimento spesa');
    }
  }
}
