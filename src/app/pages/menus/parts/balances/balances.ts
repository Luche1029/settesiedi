// src/app/pages/menus/parts/balance.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesService } from '../../../../services/expenses.service';

type NetRow = { user_id: string; name: string; net: number };
type SettlementRow = { from: string; to: string; amount: number };

@Component({
  selector: 'app-balances',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./balances.html`
})
export class Balances implements OnInit {
  private svc = inject(ExpensesService);

  nets = signal<NetRow[]>([]);
  settlements = signal<SettlementRow[]>([]);
  message = signal('');

  async ngOnInit() {
    await this.compute();
  }

  async compute() {
    this.message.set('');
    try {
      // Bilanci complessivi (passo null/null per “tutto”)
      const [nets, setts] = await Promise.all([
        this.svc.nets(null, null),          // -> [{ user_id, display_name, paid, owed, net }]
        this.svc.settlements(null, null)    // -> [{ from_user, from_name, to_user, to_name, amount }]
      ]);

      // Adattiamo ai tipi attesi dal template (name/net e from/to/amount)
      const mappedNets: NetRow[] = (nets || []).map((n: any) => ({
        user_id: n.user_id,
        name: n.display_name,
        net: Number(n.net || 0)
      })).filter((n: { net: number; }) => Math.abs(n.net) > 0.001);

      const mappedSetts: SettlementRow[] = (setts || []).map((s: any) => ({
        from: s.from_name,
        to: s.to_name,
        amount: Number(s.amount || 0)
      }));

      this.nets.set(mappedNets);
      this.settlements.set(mappedSetts);

    } catch (e: any) {
      this.message.set(e.message ?? 'Errore calcolo bilanci');
    }
  }
}
