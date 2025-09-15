import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ExpensesService } from '../../../services/expenses.service';
import { AuthService } from '../../../services/auth.service';

function todayISO() { return new Date().toISOString().slice(0,10); }

@Component({
  selector: 'app-expense-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-create.html'
})
export class ExpenseCreate {
  private svc = inject(ExpensesService);
  private auth = inject(AuthService);
  private router = inject(Router);

  description = signal('');
  amount = signal<number | null>(null);
  expense_date = signal(todayISO());
  notes = signal('');
  include_payer = signal(true);

  loading = signal(false);
  msg = signal('');

  async save() {
    const user = this.auth.user();
    if (!user) { this.msg.set('Non sei loggato'); return; }
    if (!this.description().trim() || !this.amount() || this.amount()! <= 0) {
      this.msg.set('Compila descrizione e importo'); return;
    }

    this.loading.set(true); this.msg.set('');
    try {
      await this.svc.create({
        user_id: user.id,
        amount: Number(this.amount()),
        description: this.description().trim(),
        expense_date: this.expense_date(),
        notes: this.notes().trim() || null as any,
        include_payer: this.include_payer()
      });
      this.router.navigate(['/expenses/list']);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore salvataggio');
    } finally {
      this.loading.set(false);
    }
  }
}
