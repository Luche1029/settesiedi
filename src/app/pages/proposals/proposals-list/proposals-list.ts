// proposals-list.ts
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
  templateUrl: './proposals-list.html',
  styleUrl: './proposals-list.scss'
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
  expandedId = signal<string | null>(null);   // per mostrare i piatti
  voting = signal(false);

  async ngOnInit() {
    this.auth.restore();
    await this.load();
  }

  async load() {
    if (!this.user()) return;
    this.loading.set(true); this.message.set('');
    try {
      const rows = await this.svc.listAll(this.user()!.id, this.status());
      this.proposals.set(rows);
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento');
    } finally {
      this.loading.set(false);
    }
  }

  toggleItems(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async vote(p: any, val: 1 | -1) {
    if (this.voting()) return;
    if (p.user_id === this.user()!.id) return; // il proponente non vota

    // toggle off se ricliccano lo stesso
    const toggleOff = p.myVote === val;

    // Optimistic UI
    const prev = { myVote: p.myVote, votesUp: p.votesUp, votesDown: p.votesDown };
    if (toggleOff) {
      if (p.myVote === 1) p.votesUp -= 1;
      if (p.myVote === -1) p.votesDown -= 1;
      p.myVote = 0;
    } else {
      // se passo da -1 a +1 (o viceversa) sposto i contatori
      if (p.myVote === 1) p.votesUp -= 1;
      if (p.myVote === -1) p.votesDown -= 1;
      if (val === 1) p.votesUp += 1; else p.votesDown += 1;
      p.myVote = val;
    }
    this.proposals.set(this.proposals().map(x => x.id === p.id ? { ...p } : x));

    try {
      this.voting.set(true);
      await this.svc.castVote(p.id, this.user()!.id, val, toggleOff);
    } catch (e:any) {
      // rollback
      p.myVote = prev.myVote;
      p.votesUp = prev.votesUp;
      p.votesDown = prev.votesDown;
      this.proposals.set(this.proposals().map(x => x.id === p.id ? { ...p } : x));
      this.message.set(e.message ?? 'Errore voto');
    } finally {
      this.voting.set(false);
    }
  }

  createNew() { this.router.navigateByUrl('/proposals/new'); }
  edit(p: any) { this.router.navigate(['/proposals/', p.id]); }

  async submit(p: any) {
    try { await this.svc.submit(p.id); this.message.set('Proposta inviata ✉️'); await this.load(); }
    catch (e:any) { this.message.set(e.message ?? 'Errore invio'); }
  }

  async remove(p: any) {
    if (!confirm('Eliminare questa proposta?')) return;
    try { await this.svc.remove(p.id); await this.load(); }
    catch (e:any) { this.message.set(e.message ?? 'Errore eliminazione'); }
  }

  async duplicate(p: any) {
    try { await this.svc.duplicate(p.id, this.user()!.id); await this.load(); this.message.set('Copia creata ✅'); }
    catch (e:any) { this.message.set(e.message ?? 'Errore duplicazione'); }
  }

  setFilter(f: StatusFilter) { this.status.set(f); this.load(); }
}
