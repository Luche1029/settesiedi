import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ExpensesService } from '../../../services/expenses.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './expense-detail.html',
  styleUrl: './expense-detail.scss'
})
export class ExpenseDetail implements OnInit {
  private svc = inject(ExpensesService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  id = this.route.snapshot.paramMap.get('id')!;
  row = signal<any | null>(null);
  receipts = signal<any[]>([]);         // <-- NEW
  loading = signal(false);
  msg = signal('');

  currentName = computed(() => this.auth.user()?.display_name || '');
  joined = computed(() => {
    const names: string[] = this.row()?.participants_names || [];
    const me = this.currentName();
    return !!me && names.includes(me);
  });

  get canLock() {
    const u = this.auth.user(); const r = this.row();
    return !!u && r && r.user_id === u.id && r.status === 'open';
  }
  get canVoid() {
    const u = this.auth.user(); const r = this.row();
    return !!u && r && r.user_id === u.id && r.status !== 'void';
  }

  async ngOnInit() { await this.load(); }

  async load() {
    this.loading.set(true); this.msg.set('');
    try {
      const data = await this.svc.get(this.id);
      this.row.set(data);
      // carica scontrini
      const atts = await this.svc.listReceipts(this.id);
      this.receipts.set(atts);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento spesa');
    } finally {
      this.loading.set(false);
    }
  }

  async join() {
    const u = this.auth.user(); if (!u) { this.msg.set('Non sei loggato'); return; }
    try { await this.svc.join(this.id, u.id); await this.load(); }
    catch (e:any) { this.msg.set(e.message ?? 'Errore iscrizione'); }
  }
  async leave() {
    const u = this.auth.user(); if (!u) { this.msg.set('Non sei loggato'); return; }
    try { await this.svc.leave(this.id, u.id); await this.load(); }
    catch (e:any) { this.msg.set(e.message ?? 'Errore rimozione'); }
  }
  async lock() {
    try { await this.svc.setStatus(this.id, 'locked'); await this.load(); }
    catch (e:any) { this.msg.set(e.message ?? 'Errore blocco'); }
  }
  async voidExpense() {
    try { await this.svc.setStatus(this.id, 'void'); await this.load(); }
    catch (e:any) { this.msg.set(e.message ?? 'Errore annullamento'); }
  }
}
