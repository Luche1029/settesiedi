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
 

  loading = signal(true);
  msg = signal('');

  myDebts: Array<{ to_user_id: string; to_name: string; amount_eur: number, max_amount: number }> = [];

  async ngOnInit() {
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); this.loading.set(false); return; }

    await this.loadMyDebts(me.id); 

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

  /** Debiti per-creditore dove io sono il debitore */
  private async loadMyDebts(userId: string) {
    const all = await this.expenses.settlementsMin();
    this.myDebts = (all ?? [])
      .filter((r: any) => String(r.from_user) === userId)   // io debitore
      .map((r: any) => ({
        to_user_id: String(r.to_user),
        to_name:    String(r.to_name || '').trim(),
        amount_eur: Number(r.amount || 0),
        max_amount: Number(r.amount || 0),
      }))
      .filter((r:any) => r.amount_eur > 0);
      this.loading.set(false);
  }


  /** Paga un singolo debito usando il wallet (PayPal Payout in edge) */
  async payDebt(d: { to_user_id: string; to_name: string; amount_eur: number; max_amount: number }) {
    const me = this.auth.user(); 
    if (!me) { this.msg.set('Fai login'); return; }

    // clamp & validazione
    let amount = Number.isFinite(d.amount_eur) ? d.amount_eur : 0;
    amount = Math.max(0, Math.min(amount, d.max_amount));        // cap per-riga
    amount = Math.floor(amount * 100) / 100;                      // max 2 decimali
    if (amount <= 0) { this.msg.set('Importo non valido.'); return; }

    const amount_cents = Math.round(amount * 100);
    console.log("amount_cents", amount_cents);

    this.loading.set(true);
    try {


      // Edge Function: crea payout + wallet_tx(-)
      await this.wallet.payout({
        from_user_id: me.id,
        to_user_id: d.to_user_id,          // oppure to_paypal_email: 'dest@example.com'
        amount_cents: Math.round(d.amount_eur * 100),
        note: `Saldo a ${d.to_name}`
      });

      // Aggiorna UI: riduci il residuo della riga e ricarica elenco
      d.max_amount = Math.max(0, +(d.max_amount - amount).toFixed(2));
      d.amount_eur = Math.min(d.amount_eur, d.max_amount);
      await this.loadMyDebts(me.id);

      this.msg.set(`Pagamento di € ${amount.toFixed(2)} inviato a ${d.to_name} ✅`);
    } catch (e: any) {
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
  onKeyUp(e: Event, d: { amount_eur: number; max_amount: number }) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value.replace(',', '.'));
    if (isNaN(value)) value = 0;

    // hard cap
    if (value > d.max_amount) {
      value = d.max_amount;
      input.value = value.toFixed(2);
    }

    // aggiorna il modello
    d.amount_eur = value;
  }

}
