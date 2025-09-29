// src/app/pages/wallet/topup-page.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService } from '../../../services/payments.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PayoutRow, WalletService, ReceivableRow } from '../../../services/wallet.service';
import { ExpensesService } from '../../../services/expenses.service';
import { AuthCallbackComponent } from "../../../services/auth-callback.component";

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
 

  loading = signal(true);
  msg = signal('');

  myDebts: Array<{ to_user_id: string; to_name: string; amount_eur: number, max_amount: number }> = [];
  mySettled: Array<{ to_user_id: string; to_name: string; amount_eur: number, max_amount: number }> = [];
  received = signal<PayoutRow[]>([]);
  incoming = signal<ReceivableRow[]>([]);

  async ngOnInit() {
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); this.loading.set(false); return; }

    await this.loadMyDebts(me.id); 
    await this.loadReceived(me.id);
    await this.loadIncoming(me.id);

    const orderId = this.route.snapshot.queryParamMap.get('token');
    if (orderId) {
      this.msg.set('Conferma pagamento in corso…');
      try {
        await this.capture(orderId);                  
        this.msg.set('Pagamento completato ✅');
      } catch (e: any) {
        this.msg.set(e?.message ?? 'Errore durante la conferma del pagamento');
      } finally {
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    }
  }

  private async loadMyDebts(userId: string) {
    this.loading.set(true);
    try {
      const [all, outByCreditorCents] = await Promise.all([
        this.expenses.settlementsMin(),                 // [{ from_user, to_user, to_name, amount }]
        this.wallet.getOutgoingPayoutsByCreditor(userId) // Map<string,number> (cents) oppure { [to_user]: cents }
      ]);

      // helper per leggere i centesimi già pagati verso un creditore
      const getPaidCents = (to: string): number => {
        if (!outByCreditorCents) return 0;
        if (outByCreditorCents instanceof Map) {
          return Number(outByCreditorCents.get(to) ?? 0) || 0;
        }
        // plain object
        // @ts-ignore
        return Number(outByCreditorCents[to] ?? 0) || 0;
      };

      const mine = (all ?? [])
        .filter((r: any) => String(r.from_user) === userId) // io sono il debitore
        .map((r: any) => {
          const to = String(r.to_user);
          const debtCents = Math.round((Number(r.amount) || 0) * 100);
          const paidCents = getPaidCents(to);
          const residCents = Math.max(0, debtCents - paidCents);

          const residEur = +(residCents / 100).toFixed(2);
          return {
            to_user_id: to,
            to_name: String(r.to_name || '').trim(),
            amount_eur: residEur,   // residuo da mostrare/pagare
            max_amount: residEur    // hard cap per input
          };
        })
        .filter((r: any) => r.amount_eur > 0)             // se già coperto da payout, sparisce
        .sort((a: any, b: any) => b.amount_eur - a.amount_eur); // opzionale: importi maggiori in alto

      this.myDebts = mine;
    } catch (e:any) {
      console.error('loadMyDebts error', e);
      this.msg.set(e?.message ?? 'Errore nel calcolo dei debiti');
      this.myDebts = [];
    } finally {
      this.loading.set(false);
    }
  }



  private async loadIncoming(userId: string) {
    this.loading.set(true); 
    this.msg.set('');
    try {
      const rows = await this.wallet.listForUser(userId);
      this.incoming.set(rows);
    } catch (e: any) {
      this.msg.set(e?.message ?? 'Errore caricamento pagamenti ricevuti');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadReceived(userId: string) {
    this.loading.set(true); 
    this.msg.set('');
    try {
      const rows = await this.wallet.listReceivedPayouts(userId);
      this.received.set(rows);
    } catch (e: any) {
      this.msg.set(e?.message ?? 'Errore caricamento pagamenti ricevuti');
    } finally {
      this.loading.set(false);
    }
  }

  /** Paga un singolo debito usando il wallet (PayPal Payout in edge) */
  async payDebt(d: { to_user_id: string; to_name: string; amount_eur: number; max_amount: number }) {
      const me = this.auth.user();
      if (!me) { this.msg.set('Fai login'); return; }

      // (Validazione e clamp omesse per brevità, sono corrette)
      let amount = d.amount_eur; 

      this.loading.set(true);
        try {
          // 1. CHIAMATA: Crea l'Ordine PayPal (Debitore -> Business)
          const order = await this.svc.createDebtSettlementOrder( // NOME AGGIORNATO
              me.id, 
              d.to_user_id, // PASSATO: L'ID del Creditore
              amount, 
              'EUR'
          );

          // 2. REINDIRIZZAMENTO: (Non servono query params, l'orderId è nel token)
          if (order.approvalUrl) {
              window.location.href = order.approvalUrl;
          } else {
              throw new Error('Impossibile ottenere URL di approvazione PayPal.');
          }

      } catch (e: any) {
          this.msg.set(e?.message ?? 'Errore creazione ordine');
          this.loading.set(false);
      }
  }

  
  private async capture(orderId: string) {
    await this.svc.capturePaypalOrder(orderId);
  }

  onKeyDown(e: KeyboardEvent) {
    const allowed = ['Backspace','Tab','ArrowLeft','ArrowRight','Delete','Enter',',','.'];
    if (!/[0-9]/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  }

  onKeyUp(e: Event, d: { amount_eur: number; max_amount: number }) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value.replace(',', '.'));
    if (isNaN(value)) value = 0;

    if (value > d.max_amount) {
      value = d.max_amount;
      input.value = value.toFixed(2);
    }
    d.amount_eur = value;
  }

  async confirmReceived(p: PayoutRow) {
    try {
      const me = this.auth.user();
      
      if (me) {
        await this.wallet.confirmPayout(p.id, me.id);        
        this.msg.set(`Pagamento confermato`);
        await this.loadReceived(me.id);
      }
    } catch (e: any) {
      this.msg.set(e?.message ?? 'Errore conferma pagamento');
    }
  }

  async markDebtAsPaid(d: { to_user_id: string; to_name: string; amount_eur: number, max_amount:number }) {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }

    this.loading.set(true);
    try {
      const res = await this.wallet.markDebtAsPaid(me.id, d.to_user_id, d.amount_eur, `Marked paid to ${d.to_name}`);
      console.log("markPaid res", res);   
      await this.loadMyDebts(me.id);
      this.msg.set(`Segnato come pagato: €${d.amount_eur.toFixed(2)} a ${d.to_name}`);
      setTimeout(() => window.location.reload(), 3000);
    } catch (e:any) {
      this.msg.set(e?.message ?? 'Errore segnatura pagamento');
    } finally {
      this.loading.set(false);
    }
  }

}
