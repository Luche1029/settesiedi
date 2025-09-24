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
    const [nRaw, sRaw] = await Promise.all([
      this.svc.nets(this.from(), this.to()),
      this.svc.settlements(this.from(), this.to())
    ]);

    const n = nRaw || [];
    const s = sRaw || [];

    // mappa display_name -> user_id dai Netti (serve per i settlements che non hanno from_user_id)
    const nameToId = new Map<string, string>();
    for (const r of n) {
      if (r?.display_name && r?.user_id) {
        nameToId.set(String(r.display_name).trim(), String(r.user_id));
      }
    }

    // ids da cui leggere i saldi:
    // - tutti gli user_id presenti nei netti
    // - e gli id ricavati dai nomi dei debitori nei settlements
    const netIds: string[] = n.map((r: any) => r.user_id).filter(Boolean);
    const settDebtorIdsByName: string[] = s
      .map((r: any) => (r.from_user_id || nameToId.get(String(r.from ?? r.from_name ?? '').trim())))
      .filter(Boolean) as string[];
    const allIds = Array.from(new Set([...netIds, ...settDebtorIdsByName]));

    // una sola lettura dei saldi
    const balances = await this.wallet.getBalancesMap(allIds); // Map<user_id, euro>

    // allinea Netti (NON consuma)
    const alignedNets = this.alignNetsWithWallet(n, balances);
    this.nets.set(alignedNets);

    // allinea Settlements (CONSUMA il wallet del debitore)
    const alignedSetts = this.alignSettlementsWithWallet(s, balances, nameToId);
    this.settlements.set(alignedSetts);
  } catch (e:any) {
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
