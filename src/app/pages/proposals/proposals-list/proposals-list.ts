import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProposalService } from '../../../services/proposal.service';
import { AuthService } from '../../../services/auth.service';

type StatusFilter = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

@Component({
  selector: 'app-proposals-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './proposals-list.html'
})
export class ProposalsList implements OnInit {
  private svc = inject(ProposalService);
  private auth = inject(AuthService);
  private router = inject(Router);

  user = computed(() => this.auth.user());
  loading = signal(false);
  message = signal('');
  status = signal<StatusFilter>('all');
  proposals = signal<any[]>([]);

  async ngOnInit() {
    // assicurati di ripristinare la “sessione” locale per leggere l'utente
    this.auth.restore();
    await this.load();
  }

  async load() {
    if (!this.user()) return;
    this.loading.set(true); this.message.set('');
    try {
      const rows = await this.svc.listMine(this.user()!.id, this.status());
      // normalizza count items
      this.proposals.set(rows.map(r => ({
        ...r,
        itemsCount: (r.proposal_item?.[0]?.count ?? 0)
      })));
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento');
    } finally {
      this.loading.set(false);
    }
  }

  createNew() {
    this.router.navigateByUrl('/proposals/new');
  }

  edit(p: any) {
    this.router.navigate(['/proposals/edit', p.id]);
  }

  async submit(p: any) {
    try {
      await this.svc.submit(p.id);
      this.message.set('Proposta inviata ✉️');
      await this.load();
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore invio');
    }
  }

  async remove(p: any) {
    if (!confirm('Eliminare questa proposta?')) return;
    try {
      await this.svc.remove(p.id);
      await this.load();
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore eliminazione');
    }
  }

  async duplicate(p: any) {
    try {
      await this.svc.duplicate(p.id, this.user()!.id);
      await this.load();
      this.message.set('Copia creata ✅');
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore duplicazione');
    }
  }

  setFilter(f: StatusFilter) {
    this.status.set(f);
    this.load();
  }
}
