// src/app/pages/wallet/topup-page.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService } from '../../../services/payments.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { WalletService } from '../../../services/wallet.service';
import { ExpensesService } from '../../../services/expenses.service';

@Component({
  selector: 'app-topup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topup-page.html',
  styleUrl: './topup-page.scss'
})
export class TopupPage {
  private svc = inject(PaymentsService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wallet = inject(WalletService);
  private expenses = inject(ExpensesService);     

  amount: number | null = null;     // € mostrati nell’input
  maxAmount = 0;                    // € massimo ricaricabile ora (dovuto - wallet)

  loading = signal(true);
  msg = signal('');

  myDebts: Array<{ to_user_id: string; to_name: string; amount_eur: number }> = [];

  async ngOnInit() {
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); this.amount = 0; this.loading.set(false); return; }

    // calcola quanto ricaricare (dovuto - wallet) e popola input
    await this.loadMyDebts(me.id); 

    // ritorno da PayPal con ?token=<orderId>
    const orderId = this.route.snapshot.queryParamMap.get('token');
    if (orderId) {
      this.msg.set('Conferma pagamento in corso…');
      try {
        await this.capture(orderId);                  // 👈 ricarica i valori dopo la capture
        this.msg.set('Pagamento completato ✅');
      } catch (e: any) {
        this.msg.set(e?.message ?? 'Errore durante la conferma del pagamento');
      } finally {
        // pulisci la query string per evitare doppie capture al refresh
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    }
    this.loading.set(false);
  }

  /** Debiti per-creditore dove io sono il debitore */
  private async loadMyDebts(userId: string) {
    const all = await this.expenses.settlements(null, null);

    // base: debiti lordi (from_user → to_user)
    let debts = (all ?? [])
      .filter((r: any) => String(r.from_user) === userId)
      .map((r: any) => ({
        to_user_id: String(r.to_user),
        to_name: String(r.to_name ?? r.to ?? '').trim(),
        amount_eur: Number(r.amount ?? 0)
      }));

    // sottraggo i payout 'paid' per coppia (from=userId → to_user)
    const paidPairs = await this.expenses.payoutsPairs(userId, null, null);
    debts = debts.map((d: { to_user_id: string; amount_eur: number; }) => {
      const already = paidPairs.get(d.to_user_id) ?? 0;
      const remaining = Math.max(0, d.amount_eur - already);
      return { ...d, amount_eur: +remaining.toFixed(2) };
    }).filter((d: { amount_eur: number; }) => d.amount_eur > 0);

    this.myDebts = debts;
  }


    /** Paga un singolo debito usando il wallet (PayPal Payout in edge) */
  async payDebt(d: { to_user_id: string; to_name: string; amount_eur: number }) {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }

    this.loading.set(true);
    try {
      const amount_cents = Math.round(d.amount_eur * 100);
      const walletCents  = await this.wallet.getBalanceCents(me.id);

      if (walletCents < amount_cents) {
        const delta = ((amount_cents - walletCents) / 100).toFixed(2);
        this.msg.set(`Saldo insufficiente. Ti mancano € ${delta}. Ricarica prima di pagare.`);
        this.loading.set(false);
        return;
      }

      // chiama edge function: scrive payout + wallet_tx negativo
      await this.wallet.payout(me.id, '', amount_cents, `Saldo a ${d.to_name}`, d.to_user_id);

      // refresh UI (saldo, input, lista pendenze)
      await this.loadMyDebts(me.id);

      this.msg.set(`Pagamento inviato a ${d.to_name} ✅`);
    } catch (e:any) {
      this.msg.set(e?.message ?? 'Errore payout');
    } finally {
      this.loading.set(false);
    }
  }
  
  private async capture(orderId: string) {
    await this.svc.capturePaypalOrder(orderId);
  }

  // Hard cap e validazione live dell’input
  onKeyDown(e: KeyboardEvent) {
    const allowed = ['Backspace','Tab','ArrowLeft','ArrowRight','Delete','Enter',',','.'];
    if (!/[0-9]/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  }
  onKeyUp(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value.replace(',', '.'));
    if (isNaN(value)) value = 0;
    if (value > this.maxAmount) {
      value = this.maxAmount;
      input.value = value.toFixed(2);
    }
    this.amount = value;
  }
}
