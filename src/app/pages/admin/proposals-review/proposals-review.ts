// src/app/pages/admin/proposals-review/proposals-review.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProposalService } from '../../../services/proposal.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-proposals-review',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './proposals-review.html'
})
export class ProposalsReview implements OnInit {
  private svc = inject(ProposalService);
  private auth = inject(AuthService);
  private router = inject(Router);

  rows = signal<any[]>([]);
  loading = signal(false);
  message = signal('');
  includeDraft = signal(false);

  // mappa proposta->data evento scelta
  eventDates = new Map<string, string>(); // proposalId -> 'YYYY-MM-DD'

  async ngOnInit() {
    this.auth.restore();
    await this.load();
  }

  async load() {
    this.loading.set(true); this.message.set('');
    try {
      const list = await this.svc.listForReview(this.includeDraft());
      this.rows.set(list);
      // precompila la data con la proposal_date
      this.eventDates.clear();
      list.forEach(p => {
        const d = p.proposal_date ?? new Date().toISOString().slice(0,10);
        this.eventDates.set(p.id, d);
      });
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento');
    } finally {
      this.loading.set(false);
    }
  }

  setDate(pId: string, value: string) {
    this.eventDates.set(pId, value);
  }

  async approve(p: any) {
    const date = this.eventDates.get(p.id) || new Date().toISOString().slice(0,10);
    this.loading.set(true); this.message.set('');
    try {
      const currentUser = this.auth.user();
      const eventId = await this.svc.approve(p.id, date, currentUser?.id);
      this.message.set(`Proposta approvata. Creato evento ${eventId.substring(0,8)}…`);
      await this.load();
      // opzionale: vai al dettaglio evento
      // this.router.navigate(['/menus', eventId]);
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore approvazione');
    } finally {
      this.loading.set(false);
    }
  }

  async reject(p: any) {
    if (!confirm('Rifiutare questa proposta?')) return;
    this.loading.set(true); this.message.set('');
    try {
      await this.svc.reject(p.id);
      this.message.set('Proposta rifiutata.');
      await this.load();
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore rifiuto');
    } finally {
      this.loading.set(false);
    }
  }

  toggleDraft() {
    this.includeDraft.set(!this.includeDraft());
    this.load();
  }

}
