import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ExpensesService } from '../../../services/expenses.service';

function todayISO() { return new Date().toISOString().slice(0,10); }
function firstDayOfMonthISO() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0,10);
}

@Component({
  selector: 'app-expenses-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './expenses-home.html',
  styleUrl: './expenses-home.scss'
})
export class ExpensesHome implements OnInit {
  private svc = inject(ExpensesService);

  from = signal(firstDayOfMonthISO());
  to   = signal(todayISO());

  total = signal(0);
  perPayer = signal<any[]>([]);
  loading = signal(false);
  msg = signal('');

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    this.loading.set(true); this.msg.set('');
    try {
      const [t, per] = await Promise.all([
        this.svc.total(this.from(), this.to()),
        this.svc.totalsByPayer(this.from(), this.to())
      ]);
      this.total.set(t);
      this.perPayer.set(per || []);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento totali');
    } finally {
      this.loading.set(false);
    }
  }
}
