// src/app/pages/menus/parts/expenses.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpensesService } from '../../../../services/expenses.service';
import { AuthService } from '../../../../services/auth.service';

function todayISO() { return new Date().toISOString().slice(0,10); }

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expenses.html'
})
export class Expenses implements OnInit {
  private svc = inject(ExpensesService);
  private auth = inject(AuthService);

  rows = signal<any[]>([]);
  message = signal('');
  amount = 0;
  description = '';
  notes = '';
  include_payer = true;

  async ngOnInit() {
    await this.load();
  }

  async load() {
    try {
      // lista generica (puoi passare from/to se vuoi limitarla)
      const list = await this.svc.list();
      this.rows.set(list);
    } catch (e: any) {
      this.message.set(e.message ?? 'Errore caricamento spese');
    }
  }

  async add() {
    this.auth.restore();
    const user = this.auth.user();
    if (!user) { this.message.set('Fai login'); return; }
    if (!this.amount || this.amount <= 0) { this.message.set('Importo non valido'); return; }

    try {
      await this.svc.create({
        user_id: user.id,
        amount: Number(this.amount),
        description: this.description?.trim() || '',
        expense_date: todayISO(),
        notes: this.notes?.trim() || null as any,
        include_payer: this.include_payer
      });

      // reset form + ricarica
      this.amount = 0;
      this.description = '';
      this.notes = '';
      this.include_payer = true;
      await this.load();
    } catch (e: any) {
      this.message.set(e.message ?? 'Errore inserimento spesa');
    }
  }
}
