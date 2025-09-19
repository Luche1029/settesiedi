import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ExpensesService } from '../../../services/expenses.service';

@Component({
  selector: 'app-expenses-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './expenses-list.html',
  styleUrl: './expenses-list.scss'
})
export class ExpensesList implements OnInit {
  private svc = inject(ExpensesService);
  private router = inject(Router);

  rows = signal<any[]>([]);
  loading = signal(false);
  msg = signal('');
  openId = signal<string | null>(null); // popover nomi

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true); this.msg.set('');
    try {
      const list = await this.svc.list(); // senza filtri per MVP
      this.rows.set(list || []);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento spese');
    } finally {
      this.loading.set(false);
    }
  }

  toggleNames(id: string) {
    this.openId.set(this.openId() === id ? null : id);
  }

  open(id: string) {
    this.router.navigate(['/expenses', id]);
  }
}
