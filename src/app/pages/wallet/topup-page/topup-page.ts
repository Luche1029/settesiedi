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

  amount: number | null = null;  
  maxAmount = 0;
  loading = signal(true);
  msg = signal('');

  async ngOnInit() {
    const me = this.auth.user();
    if (!me) { this.msg.set('Fai login'); return; }
    try {
      const { amount } = await this.svc.getMyDue(me.id);
      this.amount = amount; 
      this.maxAmount = amount;
      this.loading.set(false);
      console.log(this.amount);
    } catch (e:any) {
      this.loading.set(false);
      this.msg.set(e.message ?? 'Errore saldo');
    }
  }

  onKeyDown(e: KeyboardEvent) {
    const allowed = [
      'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'
    ];

    // Consenti numeri, punto e tasti di controllo
    if (
      !/[0-9.]/.test(e.key) &&
      !allowed.includes(e.key)
    ) {
      e.preventDefault();
    }
  }

  onKeyUp(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value);

    if (isNaN(value)) {
      value = 0;
    }

    if (value > this.maxAmount) {
      value = this.maxAmount;
      input.value = value.toFixed(2); // aggiorna l'input
    }

    this.amount = value; // aggiorna il model
  }

  async pay() {
    const me = this.auth.user(); if (!me) { this.msg.set('Fai login'); return; }
    this.loading.set(true); this.msg.set('');
    try {
      const { approvalUrl } = await this.svc.createPaypalTopup(me.id, this.amount || 0);
      if (approvalUrl) window.location.href = approvalUrl;
      else this.msg.set('Errore: approval URL mancante');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore pagamento');
    } finally {
      this.loading.set(false);
    }
  }
}
