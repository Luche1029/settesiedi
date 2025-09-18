// src/app/pages/expenses/expense-create/expense-create.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../../../../supabase/supabase.client'; 
import { ExpensesService } from '../../../services/expenses.service';
import { AuthService } from '../../../services/auth.service';

function todayISO(){ return new Date().toISOString().slice(0,10); }
type User = { id:string; display_name:string };

@Component({
  selector: 'app-expense-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-create.html',
  styleUrl: './expense-create.scss'
})
export class ExpenseCreate implements OnInit {
  private svc = inject(ExpensesService);
  private auth = inject(AuthService);
  private router = inject(Router);

  description = signal('');
  amount = signal<number | null>(null);
  expense_date = signal<string>(todayISO());
  notes = signal('');
  include_payer = signal(true);

  users = signal<User[]>([]);
  selected = signal<Record<string, boolean>>({}); // user_id -> checked
  meId!: string; 
  
  loading = signal(false);
  msg = signal('');

  async ngOnInit() {
    const me = this.auth.user();
    this.meId = me?.id || '';

    // carica utenti
    const { data, error } = await supabase
      .from('app_user')
      .select('id, display_name')
      .order('display_name', { ascending: true });
    if (!error && data) {
      this.users.set(data as User[]);

      if (this.meId) {
        this.selected.set({ ...this.selected(), [this.meId]: true });
      }
    }
  }

  toggleAll(checked: boolean) {
    const map: Record<string, boolean> = {};
    for (const u of this.users()) map[u.id] = checked;
    this.selected.set(map);
  }

  async save() {
    const user = this.auth.user();
    if (!user) { this.msg.set('Non sei loggato'); return; }
    if (!this.description().trim() || !this.amount() || this.amount()! <= 0) {
      this.msg.set('Compila descrizione e importo'); return;
    }

    const participants = Object.entries(this.selected())
      .filter(([_, v]) => v)
      .map(([k]) => k);

    this.loading.set(true); this.msg.set('');
    try {
      await this.svc.createWithParticipants({
        user_id: user.id,
        amount: Number(this.amount()),
        description: this.description().trim(),
        expense_date: this.expense_date(),
        notes: this.notes().trim() || null,
        include_payer: this.include_payer(),
        participants
      });
      this.router.navigate(['/expenses/list']);
    } catch (e:any) {
      console.error('Insert expense error', e);
      this.msg.set(e.message ?? 'Errore salvataggio');
    } finally {
      this.loading.set(false);
    }
  }

  onToggle(userId: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.selected.set({ ...this.selected(), [userId]: checked });
  }

}
