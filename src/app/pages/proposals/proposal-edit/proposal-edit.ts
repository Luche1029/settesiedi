import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { supabase } from '../../../../../supabase/supabase.client'; // stesso client che usi altrove

type ProposalRow = {
  id?: string;
  title: string;
  proposed_for?: string | null; // YYYY-MM-DD
  notes?: string | null;
  status?: 'draft'|'submitted'|'approved'|'archived';
};
type Item = { id?: string; name: string; notes?: string | null };

@Component({
  selector: 'app-proposal-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './proposal-edit.html'
})
export class ProposalEdit implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(false);
  msg = signal('');

  // modello
  proposal = signal<ProposalRow>({
    title: '',
    proposed_for: null,
    notes: '',
    status: 'draft'
  });
  items = signal<Item[]>([{ name: '', notes: '' }]); // una riga vuota iniziale

  isNew = computed(() => !this.proposal().id);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      await this.load(id);
    }
  }

  async load(id: string) {
    this.loading.set(true); this.msg.set('');
    try {
      const { data, error } = await supabase
        .from('proposal')
        .select('id, title, proposal_date, notes, status, proposal_item(id, name, notes)')
        .eq('id', id).single();

      if (error) throw error;
      this.proposal.set({
        id: data.id,
        title: data.title ?? '',
        proposed_for: data.proposal_date ?? null,
        notes: data.notes ?? '',
        status: (data.status ?? 'draft') as any
      });
      this.items.set((data.proposal_item ?? []).map((r: any) => ({
        id: r.id, name: r.name ?? '', notes: r.notes ?? ''
      })));
      if (this.items().length === 0) this.items.set([{ name: '', notes: '' }]);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento proposta');
    } finally {
      this.loading.set(false);
    }
  }

  addRow() {
    this.items.update(arr => [...arr, { name:'', notes:'' }]);
  }
  removeRow(i: number) {
    this.items.update(arr => arr.filter((_,idx)=>idx!==i));
    if (this.items().length === 0) this.addRow();
  }

  // salva: se nuova crea proposal e poi rimpiazza gli items
  async save() {
    const p = this.proposal();
    if (!p.title.trim()) { this.msg.set('Titolo obbligatorio'); return; }

    this.loading.set(true); this.msg.set('');
    try {
      let id = p.id;

      if (!id) {
        // create
        const { data, error } = await supabase
          .from('proposal')
          .insert({
            title: p.title.trim(),
            proposed_for: p.proposed_for || null,
            notes: p.notes || null,
            status: 'draft'
          })
          .select('id').single();
        if (error) throw error;
        id = data.id as string;
        this.proposal.update(x => ({ ...x, id }));
      } else {
        // update base fields
        const { error } = await supabase
          .from('proposal')
          .update({
            title: p.title.trim(),
            proposed_for: p.proposed_for || null,
            notes: p.notes || null
          })
          .eq('id', id);
        if (error) throw error;
      }

      // rimpiazza items: semplice e sicuro
      const clean = this.items()
        .map(i => ({ name: i.name?.trim() ?? '', notes: i.notes?.trim() || null }))
        .filter(i => i.name.length > 0);

      // cancella tutti gli item attuali
      await supabase.from('proposal_item').delete().eq('proposal_id', id!);

      if (clean.length) {
        const rows = clean.map(i => ({ proposal_id: id, name: i.name, notes: i.notes }));
        const { error: e2 } = await supabase.from('proposal_item').insert(rows);
        if (e2) throw e2;
      }

      this.msg.set('Salvato!');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore salvataggio');
    } finally {
      this.loading.set(false);
    }
  }

  async submit() {
    if (this.isNew()) { await this.save(); }
    const id = this.proposal().id!;
    this.loading.set(true); this.msg.set('');
    try {
      const { error } = await supabase.from('proposal').update({ status: 'submitted' }).eq('id', id);
      if (error) throw error;
      this.proposal.update(p => ({ ...p, status: 'submitted' }));
      this.msg.set('Inviata per revisione');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore invio');
    } finally {
      this.loading.set(false);
    }
  }

  async remove() {
    const id = this.proposal().id;
    if (!id) { this.router.navigate(['/proposals']); return; }
    if (!confirm('Eliminare la proposta?')) return;

    this.loading.set(true); this.msg.set('');
    try {
      // elimina item e proposta (se FK non è ON DELETE CASCADE)
      await supabase.from('proposal_item').delete().eq('proposal_id', id);
      const { error } = await supabase.from('proposal').delete().eq('id', id);
      if (error) throw error;
      this.router.navigate(['/proposals']);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore eliminazione');
    } finally {
      this.loading.set(false);
    }
  }
}
