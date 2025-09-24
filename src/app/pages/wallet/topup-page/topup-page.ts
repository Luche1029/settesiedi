// src/app/pages/wallet/topup-page.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService } from '../../../services/payments.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { WalletService } from '../../../services/wallet.service';

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

  amount: number | null = null;     // € mostrati nell’input
  maxAmount = 0;                    // € massimo ricaricabile ora (dovuto - wallet)

  loading = signal(true);
  msg = signal('');

  async ngOnInit() {
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); this.amount = 0; this.loading.set(false); return; }

    // calcola quanto ricaricare (dovuto - wallet) e popola input
    await this.refreshAmounts(me.id);

    // ritorno da PayPal con ?token=<orderId>
    const orderId = this.route.snapshot.queryParamMap.get('token');
    if (orderId) {
      this.msg.set('Conferma pagamento in corso…');
      try {
        await this.capture(orderId);
        await this.refreshAmounts(me.id);                         // 👈 ricarica i valori dopo la capture
        this.msg.set('Pagamento completato ✅');
      } catch (e: any) {
        this.msg.set(e?.message ?? 'Errore durante la conferma del pagamento');
      } finally {
        // pulisci la query string per evitare doppie capture al refresh
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    }
  }

  /** Recupera dovuto e wallet e imposta amount/maxAmount (in €) */
  private async refreshAmounts(userId: string) {
    this.loading.set(true);
    try {
      const [dueCents, walletCents] = await Promise.all([
        this.getMyDueCents(userId),
        this.wallet.getBalanceCents(userId),
      ]);
      const remaining = Math.max(0, dueCents - walletCents);
      this.maxAmount = +(remaining / 100).toFixed(2);
      this.amount = this.maxAmount; // mostriamo quanto serve per azzerare il debito
      this.msg.set('');
    } catch (e: any) {
      this.msg.set(e?.message ?? 'Errore nel calcolo del saldo');
      this.amount = 0;
      this.maxAmount = 0;
    } finally {
      this.loading.set(false);
    }
  }

  /** Prova a usare metodi esistenti nel tuo PaymentsService, senza inventare backend */
  private async getMyDueCents(userId: string): Promise<number> {
    // 1) se esiste un metodo dedicato in cents
    const anySvc = this.svc as any;
    if (typeof anySvc.getMyDueCents === 'function') {
      const v = await anySvc.getMyDueCents(userId);
      return Number(v ?? 0);
    }
    // 2) se esiste getMyDue che ritorna { amount } in euro
    if (typeof anySvc.getMyDue === 'function') {
      const res = await anySvc.getMyDue(userId);
      const euro = Number(res?.amount ?? 0);
      return Math.round(euro * 100);
    }
    // 3) altrimenti 0 (non rompiamo il flusso)
    return 0;
  }

  private async capture(orderId: string) {
    await this.svc.capturePaypalOrder(orderId);
  }

  async pay() {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }
    if (this.amount === null || this.amount <= 0) { this.msg.set('Nessun importo da pagare'); return; }

    const toPay = Math.min(this.amount, this.maxAmount); // non superare il necessario
    this.loading.set(true); this.msg.set('');
    try {
      const { approvalUrl } = await this.svc.createPaypalTopup(me.id, Number(toPay.toFixed(2)));
      if (approvalUrl) window.location.href = approvalUrl;
      else this.msg.set('Errore: approval URL mancante');
    } catch (e: any) {
      this.msg.set(e?.message ?? 'Errore creazione pagamento');
    } finally {
      this.loading.set(false); // se l’utente resta qui
    }
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
