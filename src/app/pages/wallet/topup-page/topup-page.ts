// src/app/pages/wallet/topup-page.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService } from '../../../services/payments.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-topup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topup-page.html' ,
  styleUrl: './topup-page.scss' 
})
export class TopupPage {
  private svc = inject(PaymentsService);
  private auth = inject(AuthService);

  amount = 10;
  loading = signal(false);
  msg = signal('');

  async pay() {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }
    this.loading.set(true); this.msg.set('');
    try {
      const { approvalUrl } = await this.svc.createPaypalTopup(me.id, this.amount);
      if (approvalUrl) window.location.href = approvalUrl;
      else this.msg.set('Errore: approval URL mancante');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore pagamento');
    } finally {
      this.loading.set(false);
    }
  }
}
