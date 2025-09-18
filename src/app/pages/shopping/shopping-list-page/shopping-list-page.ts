// src/app/pages/shopping/shopping-list-page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShoppingService, ShoppingRow } from '../../../services/shopping.service';
import { AuthService } from '../../../services/auth.service';
import { ShoppingAddForm } from '../shopping-add-form/shopping-add-form';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [CommonModule, ShoppingAddForm],
  templateUrl: './shopping-list-page.html'
})
export class ShoppingListPage implements OnInit {
  private svc = inject(ShoppingService);
  private auth = inject(AuthService);

  rows = signal<ShoppingRow[]>([]);
  open = signal<ShoppingRow[]>([]);
  purchased = signal<ShoppingRow[]>([]);
  msg = signal('');

  async ngOnInit() { await this.load(); }

  async load() {
    try {
      const data = await this.svc.list();
      this.rows.set(data);
      this.open.set(data.filter(d => d.status === 'open'));
      this.purchased.set(data.filter(d => d.status === 'purchased').slice(0, 20));
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento lista');
    }
  }

  async toggle(r: ShoppingRow) {
    try {
      const user = this.auth.user(); if (!user) return;
      await this.svc.toggle(r.id, user.id);
      await this.load();
    } catch (e:any) { this.msg.set(e.message ?? 'Errore aggiornamento'); }
  }

  canDelete(r: ShoppingRow) {
    const user = this.auth.user(); if (!user) return false;
    return r.added_by === user.id || (!!r.purchased_by && r.purchased_by === user.id);
  }

  async remove(r: ShoppingRow) {
    try { await this.svc.remove(r.id); await this.load(); }
    catch (e:any) { this.msg.set(e.message ?? 'Errore eliminazione'); }
  }
}
