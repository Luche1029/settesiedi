import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService } from '../../../services/payments.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpensesService } from '../../../services/expenses.service';
import { WalletService, PayoutRow, ReceivableRow } from '../../../services/wallet.service';

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

  // --- Sezioni UI ---
  pendingDebts: Array<{ to_user_id: string; to_name: string; amount_eur: number; max_amount: number }> = [];
  paidOut = signal<PayoutRow[]>([]);       
  incoming = signal<ReceivableRow[]>([]);  // da ricevere (PENDING/PROCESSING)
  received = signal<PayoutRow[]>([]);      // ricevuti (SUCCESS)

  async ngOnInit() {
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); this.loading.set(false); return; }

    await this.refreshAll(me.id);

    // ritorno da PayPal
    const orderId = this.route.snapshot.queryParamMap.get('token');
    if (orderId) {
      this.msg.set('Conferma pagamento in corso…');
      try {
        await this.capture(orderId);
        await this.refreshAll(me.id);
        this.msg.set('Pagamento completato ✅');
      } catch (e: any) {
        this.msg.set(e?.message ?? 'Errore durante la conferma del pagamento');
      } finally {
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    }
  }

  private async refreshAll(userId: string) {
    this.loading.set(true); this.msg.set('');
    try {
      await Promise.all([
        this.loadMyDebts(userId),
        this.loadPaidOut(userId),
        this.loadIncoming(userId),
        this.loadReceived(userId),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  /** Debiti residui = settlements_min – payout usciti non FAILED */
  private async loadMyDebts(userId: string) {
    const [all, outByCreditorCents] = await Promise.all([
      this.expenses.settlementsMin(),                  
      this.wallet.getOutgoingPayoutsByCreditor(userId) 
    ]);

    const getPaidCents = (to: string): number => {
      if (!outByCreditorCents) return 0;
      // compat Map|object
      // @ts-ignore
      return outByCreditorCents instanceof Map
        ? Number(outByCreditorCents.get(to) ?? 0) || 0
        // @ts-ignore
        : Number(outByCreditorCents[to] ?? 0) || 0;
    };

    this.pendingDebts = (all ?? [])
      .filter((r: any) => String(r.from_user) === userId)
      .map((r: any) => {
        const to = String(r.to_user);
        const debtCents = Math.round((Number(r.amount) || 0) * 100);
        const paidCents = getPaidCents(to);
        const residCents = Math.max(0, debtCents - paidCents);
        const residEur = +(residCents / 100).toFixed(2);
        return {
          to_user_id: to,
          to_name: String(r.to_name || '').trim(),
          amount_eur: residEur,
          max_amount: residEur,
        };
      })
      .filter(r => r.amount_eur > 0)
      .sort((a, b) => b.amount_eur - a.amount_eur);
  }

  /** Storico dei miei payout usciti */
private async loadPaidOut(userId: string) {
  // compat: alcuni progetti usano getMyPaidOut, altri listPaidOut
  // @ts-ignore
  const fn = this.wallet.getMyPaidOut?.bind(this.wallet) || this.wallet.listPaidOut?.bind(this.wallet);
  if (!fn) { this.paidOut.set([]); return; }

  const rows = await fn(userId);
  const normalized: PayoutRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,

    // se il servizio non li restituisce, deriviamo:
    from_user_id: r.from_user_id ?? userId,
    from_user_name: r.from_name ?? r.from_user_name ?? null,

    to_user_id: r.to_user_id ?? null,
    to_name: r.to_name ?? null,

    // calcolo bidirezionale cents/eur
    amount_cents: r.amount_cents ?? Math.round((+r.amount_eur || 0) * 100),
    amount_eur:   r.amount_eur   ?? +( (r.amount_cents || 0) / 100 ).toFixed(2),

    currency: r.currency ?? 'EUR',
    status: r.status,
    paypal_batch_id: r.paypal_batch_id ?? r.batch_id ?? null,
  }));

  this.paidOut.set(normalized);
}

  /** Payout da ricevere (PENDING/PROCESSING) */
  private async loadIncoming(userId: string) {
    const rows = await this.wallet.listForUser(userId);
    this.incoming.set(rows || []);
  }

  /** Payout ricevuti (SUCCESS) */
  private async loadReceived(userId: string) {
    const rows = await this.wallet.listReceivedPayouts(userId);
    this.received.set(rows || []);
  }

  /** Crea ordine PayPal per saldare un singolo debito */
  async payDebt(d: { to_user_id: string; to_name: string; amount_eur: number; max_amount: number }) {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }

    const amount = Math.max(0, Math.min(d.amount_eur, d.max_amount));
    this.loading.set(true); this.msg.set('');
    try {
      const order = await this.svc.createDebtSettlementOrder(me.id, d.to_user_id, amount, 'EUR');
      if (order?.approvalUrl) window.location.href = order.approvalUrl;
      else throw new Error('Impossibile ottenere URL di approvazione PayPal.');
    } catch (e: any) {
      this.msg.set(e?.message ?? 'Errore creazione ordine');
    } finally {
      this.loading.set(false);
    }
  }

  /** Flusso PayPal capture */
  private async capture(orderId: string) {
    await this.svc.capturePaypalOrder(orderId);
  }

  // input helpers
  onKeyDown(e: KeyboardEvent) {
    const allowed = ['Backspace','Tab','ArrowLeft','ArrowRight','Delete','Enter',',','.'];
    if (!/[0-9]/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  }
  onKeyUp(e: Event, d: { amount_eur: number; max_amount: number }) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value.replace(',', '.'));
    if (isNaN(value)) value = 0;
    if (value > d.max_amount) { value = d.max_amount; input.value = value.toFixed(2); }
    d.amount_eur = value;
  }

  /** Conferma manuale lato creditore */
  async confirmReceived(p: PayoutRow) {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }
    this.loading.set(true); this.msg.set('');
    try {
      await this.wallet.confirmPayout(p.id, me.id);
      await this.refreshAll(me.id);
      this.msg.set('Pagamento confermato ✅');
    } catch (e:any) {
      this.msg.set(e?.message ?? 'Errore conferma pagamento');
    } finally {
      this.loading.set(false);
    }
  }

  /** Segna come pagato (flusso “fittizio”: payment + payout PENDING) */
  async markDebtAsPaid(d: { to_user_id: string; to_name: string; amount_eur: number; max_amount: number }) {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }
    const amount = Math.max(0, Math.min(d.amount_eur, d.max_amount));

    this.loading.set(true); this.msg.set('');
    try {
      await this.wallet.markDebtAsPaid(me.id, d.to_user_id, amount, `Marked paid to ${d.to_name}`);
      await this.refreshAll(me.id);
      this.msg.set(`Segnato come pagato: €${amount.toFixed(2)} a ${d.to_name}`);
    } catch (e:any) {
      this.msg.set(e?.message ?? 'Errore segnatura pagamento');
    } finally {
      this.loading.set(false);
    }
  }
}
