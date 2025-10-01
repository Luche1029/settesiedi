// src/app/pages/proposals/proposal-edit/proposal-edit.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { supabase } from '../../../../../supabase/supabase.client';

type ProposalRow = {
  id?: string;
  title: string;
  proposal_date?: string | null; // YYYY-MM-DD
  notes?: string | null;
  status?: 'draft'|'submitted'|'approved'|'rejected'|'archived';
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
    proposal_date: null,
    notes: '',
    status: 'draft'
  });
  items = signal<Item[]>([{ name: '', notes: '' }]); // una riga vuota iniziale

  isNew = computed(() => !this.proposal().id);

  private isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      if (!this.isUuid(id)) {
        // id non valido: torna alla lista (o dove preferisci)
        this.router.navigate(['/proposals']);
        return;
      }
      await this.load(id);
    }
  }

  // helper: aggiorna campi proposal con (ngModelChange)
  setProposal<K extends keyof ProposalRow>(key: K, val: ProposalRow[K]) {
    this.proposal.update(p => ({ ...p, [key]: val }));
  }

  // helper: aggiorna un campo item
  setItem(i: number, key: keyof Item, val: any) {
    this.items.update(arr => {
      const copy = [...arr];
      copy[i] = { ...copy[i], [key]: val };
      return copy;
    });
  }

  async load(id: string) {
    this.loading.set(true); this.msg.set('');
    try {
      const { data, error } = await supabase
        .from('proposal')
        .select(`
          id, title, proposal_date, notes, status,
          proposal_dish (
            id,
            notes,
            dish:dish_id ( id, name )
          )
        `)
        .eq('id', id).single();

      if (error) throw error;

      this.proposal.set({
        id: data.id,
        title: data.title ?? '',
        proposal_date: data.proposal_date ?? null,
        notes: data.notes ?? '',
        status: (data.status ?? 'draft') as any
      });

      const rows = (data.proposal_dish ?? []).map((r: any) => ({
        id: r.id,
        name: r?.dish?.name ?? '',
        notes: r?.notes ?? ''
      }));

      this.items.set(rows.length ? rows : [{ name: '', notes: '' }]);

      this.msg.set('');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento proposta');
    } finally {
      this.loading.set(false);
    }
  }

  addRow() { this.items.update(arr => [...arr, { name:'', notes:'' }]); }
  removeRow(i: number) {
    this.items.update(arr => arr.filter((_,idx)=>idx!==i));
    if (this.items().length === 0) this.addRow();
  }

  // trova o crea dish (richiede policy RLS su dish: select/insert)
  private async ensureDishByName(name: string): Promise<string> {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Nome piatto mancante');

    const { data: found, error: selErr } = await supabase
      .from('dish')
      .select('id')
      .ilike('name', trimmed)
      .limit(1)
      .maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') throw selErr;
    if (found?.id) return found.id as string;

    const { data: created, error: insErr } = await supabase
      .from('dish')
      .insert({ name: trimmed })
      .select('id')
      .single();
    if (insErr) throw insErr;
    return created!.id as string;
  }

  // salva: se nuova crea proposal e poi rimpiazza i proposal_dish
 async save() {
  const p = this.proposal();
  if (!p.title.trim()) { this.msg.set('Titolo obbligatorio'); return; }

  this.loading.set(true); this.msg.set('');
  try {
    // 1) crea/aggiorna proposal
    let id = p.id as string | undefined;
    if (!id) {
      const { data, error } = await supabase
        .from('proposal')
        .insert({
          title: p.title.trim(),
          proposal_date: p.proposal_date || null,
          notes: p.notes || null,
          status: 'draft'
        })
        .select('id')
        .single();
      if (error) throw error;
      id = data.id as string;
      this.proposal.update(x => ({ ...x, id }));
    } else {
      const { error } = await supabase
        .from('proposal')
        .update({
          title: p.title.trim(),
          proposal_date: p.proposal_date || null,
          notes: p.notes || null
        })
        .eq('id', id);
      if (error) throw error;
    }

    // 2) normalizza & deduplica items (ultimo valore vince)
    const byKey = new Map<string, { name: string; notes: string | null }>();
    for (const i of this.items()) {
      const name = (i.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name) continue;
      byKey.set(name.toLowerCase(), { name, notes: (i.notes ?? '').trim() || null });
    }

    // 3) risolvi name -> dish_id
    const desired: Array<{ dish_id: string; notes: string | null }> = [];
    for (const { name, notes } of byKey.values()) {
      const dish_id = await this.ensureDishByName(name);
      desired.push({ dish_id, notes });
    }

    // 4) leggi righe attuali
    const { data: current, error: curErr } = await supabase
      .from('proposal_dish')
      .select('dish_id')
      .eq('proposal_id', id!);
    if (curErr) throw curErr;

    const currentIds = new Set((current ?? []).map(r => r.dish_id as string));
    const desiredIds = new Set(desired.map(d => d.dish_id));

    // 5) DELETE mirato delle righe rimosse
    const toDelete = [...currentIds].filter(x => !desiredIds.has(x));
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('proposal_dish')
        .delete()
        .eq('proposal_id', id!)
        .in('dish_id', toDelete);
      if (delErr) throw delErr;
    }

    // 6) UPSERT di tutte le righe desiderate (aggiorna note senza duplicare)
    for (const d of desired) {
      const { error: upErr } = await supabase
        .from('proposal_dish')
        .upsert(
          {
            proposal_id: id!,
            dish_id: d.dish_id,
            notes: d.notes,
            quantity: 1,        // estendi se aggiungi qty in UI
            price_cents: null   // estendi se aggiungi prezzo in UI
          },
          { onConflict: 'proposal_id,dish_id' }
        );
      if (upErr) throw upErr;
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
      await supabase.from('proposal_dish').delete().eq('proposal_id', id); // ← ponte
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
