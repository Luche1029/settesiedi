// src/app/pages/balances/balances-global.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpensesService } from '../../../services/expenses.service';
import { SettlementsList } from '../../../shared/ui/settlements-list/settlements-list';
import { WalletService } from '../../../services/wallet.service';

type NetRow = {
  user_id?: string;           // deve esserci se possibile
  display_name: string;
  paid: number;               // € (numero)
  owed: number;               // € (numero)  <-- valore lordo
  net: number;                // € (numero)  <-- paid - owed (lordo)
};

type SettlementRow = {
  from: string;               // display name
  to: string;                 // display name
  amount: number;             // € (numero)
  from_user_id?: string;      // 👈 se disponibile la usiamo
  to_user_id?: string;
};

@Component({
  selector: 'app-balances-global',
  standalone: true,
  imports: [CommonModule, FormsModule, SettlementsList],
  templateUrl: './balances-global.html',
  styleUrl: './balances-global.scss'
})



export class BalancesGlobal implements OnInit {
  private svc = inject(ExpensesService);
  private wallet = inject(WalletService);

  from = signal<string | null>(firstDayOfMonthISO());
  to   = signal<string | null>(todayISO());

  nets = signal<any[]>([]);
  settlements = signal<SettlementRow[]>([]);
  loading = signal(false);
  msg = signal('');

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    this.loading.set(true); this.msg.set('');
    try {
      // 1) prendo balances (contiene user_id e display_name) e settlements min (solo IDs)
      const [balances, settles] = await Promise.all([
        this.svc.userBalances(),   // deve restituire: { user_id, display_name, paid_expenses, owed_expenses, balance, ... }
        this.svc.settlementsMin(), // restituisce: { from_user, to_user, amount }
      ]);

      // 2) mappa ID -> Nome
      const idToName = new Map<string, string>(
        (balances || []).map((b: any) => [String(b.user_id), String(b.display_name)])
      );

      // 3) Netti per tabella in alto
      this.nets.set((balances || []).map((r: any) => ({
        user_id:      String(r.user_id),
        display_name: String(r.display_name),
        paid:         Number(r.paid_expenses ?? r.paid ?? 0),
        owed:         Number(r.owed_expenses ?? r.owed ?? 0),
        payouts_sent:         Number(r.payout_sent_eur ?? r.paid ?? 0),
        payouts_recv:         Number(r.payout_recv_eur ?? r.owed ?? 0),
        net:          Number(r.balance ?? 0),
      })));

      // 4) Chi deve a chi (mappo ID → nome qui, così la SettlementsList non dipende più da from_name/to_name)
      const rows = (settles || []).map((s: any) => ({
        from:        idToName.get(String(s.from_user)) ?? String(s.from_user),
        to:          idToName.get(String(s.to_user))   ?? String(s.to_user),
        amount:      Number(s.amount ?? 0),
        from_user_id: String(s.from_user),
        to_user_id:   String(s.to_user),
      }));
      this.settlements.set(rows);

    } catch (e: any) {
      this.msg.set(e.message ?? 'Errore caricamento bilanci');
    } finally {
      this.loading.set(false);
    }
  }


/** Netti: Dovuto' = max(0, Dovuto - wallet[user]) ; Netto' = Pagato - Dovuto' */
private alignNetsWithWallet(rows: any[], balances: Map<string, number>) {
  return rows.map(r => {
    const w = balances.get(r.user_id) ?? 0; // euro
    const owedAdj = Math.max(0, Number(r.owed ?? 0) - w);
    const netAdj  = Number(r.paid ?? 0) - owedAdj;
    return { ...r, owed: +owedAdj.toFixed(2), net: +netAdj.toFixed(2) };
  });
}

/** Chi deve a chi: consuma il wallet del DEBITORE.
 *  Se manca from_user_id, risaliamo dall'omonimia con i Netti (nameToId).
 */
private alignSettlementsWithWallet(
  rows: any[],
  balances: Map<string, number>,
  nameToId: Map<string, string>
) {
  // clona la mappa (consumiamo solo qui)
  const walletByDebtor = new Map(balances);

  const out: any[] = [];
  for (const r of rows) {
    // prendi l'id del debitore: priorità a from_user_id, altrimenti risali dal nome
    const debtorId =
      r.from_user_id ||
      nameToId.get(String(r.from ?? r.from_name ?? '').trim());

    if (!debtorId) { out.push(r); continue; }   // impossibile allineare

    const avail = walletByDebtor.get(debtorId) ?? 0; // € disponibili
    if (avail <= 0) { out.push(r); continue; }

    const amt = Number(r.amount ?? 0);
    const use = Math.min(amt, avail);
    const newAmt = +(Math.max(0, amt - use)).toFixed(2);

    walletByDebtor.set(debtorId, +(avail - use).toFixed(2));

    if (newAmt > 0) out.push({ ...r, amount: newAmt });
    // se newAmt === 0, la riga scompare (debito coperto dal wallet)
  }
  return out;
}


}

/* helpers date */
function firstDayOfMonthISO() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0,10);
}
function todayISO() { return new Date().toISOString().slice(0,10); }
