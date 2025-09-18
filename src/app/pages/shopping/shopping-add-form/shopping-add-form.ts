// src/app/pages/shopping/shopping-add-form.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShoppingService } from '../../../services/shopping.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-shopping-add-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shopping-add-form.html' 

})
export class ShoppingAddForm {
  private svc = inject(ShoppingService);
  private auth = inject(AuthService);

  name = '';
  notes = '';
  qty: number | null = null;
  msg = signal('');

  async save() {
    const user = this.auth.user(); if (!user) { this.msg.set('Fai login'); return; }
    if (!this.name.trim()) { this.msg.set('Scrivi una voce'); return; }
    try {
      await this.svc.add({ name: this.name, notes: this.notes, qty: this.qty, added_by: user.id });
      this.name = ''; this.notes = ''; this.qty = null; this.msg.set('Aggiunto!');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore salvataggio');
    }
  }
}
