import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpensesService } from '../../../services/expenses.service';
import { SettlementsList } from '../../../shared/ui/settlements-list/settlements-list';

type Settlement = { from: string; to: string; amount: number };

function firstDayOfMonthISO() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0,10);
}
function todayISO() { return new Date().toISOString().slice(0,10); }

@Component({
  selector: 'app-balances-global',
  standalone: true,
  imports: [CommonModule, FormsModule, SettlementsList],
  templateUrl: './balances-global.html',
  styleUrl: './balances-global.scss'
})
export class BalancesGlobal implements OnInit {
  private svc = inject(ExpensesService);

  from = signal<string | null>(firstDayOfMonthISO());
  to   = signal<string | null>(todayISO());

  nets = signal<any[]>([]);
  settlements = signal<any[]>([]);
  loading = signal(false);
  msg = signal('');

  async ngOnInit() {  
    try {
      const [n, s] = await Promise.all([
        this.svc.nets(this.from(), this.to()),
        this.svc.settlements(this.from(), this.to())
      ]);
      this.nets.set(n || []);
      this.settlements.set(s || []);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento bilanci');
    } finally {
      this.loading.set(false);
    }
  }

  async refresh() {
    this.loading.set(true); this.msg.set('');
    try {
      const [n, s] = await Promise.all([
        this.svc.nets(this.from(), this.to()),
        this.svc.settlements(this.from(), this.to())
      ]);
      this.nets.set(n || []);
      this.settlements.set(s || []);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento bilanci');
    } finally {
      this.loading.set(false);
    }
  }
}
