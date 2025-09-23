// src/app/pages/wallet/topup-page.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService } from '../../../services/payments.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

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

  amount: number | null = null; // null = loading saldo
  maxAmount = 0;

  loading = signal(false);
  msg = signal('');

  async ngOnInit() {
    // 1) recupera amount dovuto (già fatto in precedenza con la tua RPC)
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); this.amount = 0; return; }
    try {
      // chiamata alla tua RPC get_user_due_from_nets (o similare)
      // qui ipotizzo un metodo esistente:
      const due = await (this as any).svc.getMyDue?.(me.id);
      const amt = Number(due?.amount ?? 0);
      this.amount = amt;
      this.maxAmount = amt;
      this.loading.set(false);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore saldo');
      this.amount = 0;
    }

    // 2) se torni da PayPal con ?token=<orderId>, fai CAPTURE
    const orderId = this.route.snapshot.queryParamMap.get('token'); // PayPal usa "token" per l'order id
    if (orderId) {
      console.log("orderId", orderId);
      await this.handleReturnFromPayPal(orderId);
    }
  }

  async handleReturnFromPayPal(orderId: string) {
    this.loading.set(true);
    this.msg.set('Conferma pagamento in corso…');
    console.log('Conferma pagamento in corso…');
    try {
      const capture = await this.svc.capturePaypalOrder(orderId);
      // opzionale: verifica capture.status === 'COMPLETED'
      this.msg.set('Pagamento completato ✅');
      console.log('Pagamento completato');
      // pulisci la querystring per evitare doppie capture al refresh
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
      // opzionale: ricarica saldo / amount
      // await this.ngOnInit();
    } catch (e:any) {
      console.error('CAPTURE error', e);
      this.msg.set(e.message ?? 'Errore nella conferma del pagamento');
    } finally {
      this.loading.set(false);
    }
  }

  async pay() {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }
    if (this.amount === null || this.amount <= 0) { this.msg.set('Nessun importo da pagare'); return; }

    // non permettere di superare maxAmount
    const toPay = Math.min(this.amount, this.maxAmount);

    this.loading.set(true); this.msg.set('');
    try {
      const { approvalUrl } = await this.svc.createPaypalTopup(me.id, Number(toPay.toFixed(2)));
      if (approvalUrl) {
        window.location.href = approvalUrl; // redirect a PayPal
      } else {
        this.msg.set('Errore: approval URL mancante');
      }
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore creazione pagamento');
    } finally {
      // NB: dopo il redirect non serve, ma se l’utente resta qui…
      this.loading.set(false);
    }
  }

  // (opzionali) i due handler input che avevi chiesto:
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
