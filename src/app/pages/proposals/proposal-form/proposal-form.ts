// src/app/pages/proposals/proposal-form/proposal-form.component.ts
import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProposalService } from '../../../services/proposal.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-proposal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proposal-form.html'
})
export class ProposalForm implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private svc = inject(ProposalService);
  private auth = inject(AuthService);

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    notes: [''],
    items: this.fb.array([])
  });

  loading = false;
  message = '';
  proposalId: string | null = null;
  user = computed(() => this.auth.user());

  get items(): FormArray<FormGroup> {
    return this.form.get('items') as FormArray<FormGroup>;
  }

  ngOnInit() {
    // opzionale: supporta edit se /proposals/edit/:id
    this.proposalId = this.route.snapshot.paramMap.get('id');
    if (this.proposalId) this.loadDraft(this.proposalId);
    if (this.items.length === 0) this.addItem(); // almeno una riga pronta
  }

  private async loadDraft(id: string) {
    this.loading = true;
    try {
      const data = await this.svc.getWithItems(id);
      this.form.patchValue({ title: data.title, notes: data.notes ?? '' });
      this.items.clear();
      (data.proposal_item || []).forEach((it: any) => this.addItem(it.name, it.notes));
    } catch (e: any) {
      this.message = e.message ?? 'Errore caricamento';
    } finally {
      this.loading = false;
    }
  }

  addItem(name = '', notes = '') {
    this.items.push(
      this.fb.group({
        name: [name, [Validators.required, Validators.minLength(2)]],
        notes: [notes]
      })
    );
  }

  removeItem(i: number) {
    this.items.removeAt(i);
    if (this.items.length === 0) this.addItem();
  }

  async saveDraft() {
    if (!this.user()) { this.message = 'Non sei loggato.'; return; }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const payload = {
      title: this.form.value.title,
      notes: this.form.value.notes || '',
      items: (this.form.value.items || []).map((it: any) => ({ name: it.name, notes: it.notes || '' }))
    };

    this.loading = true; this.message = '';
    try {
      if (this.proposalId) {
        await this.svc.updateDraft(this.proposalId, payload);
      } else {
        const p = await this.svc.createDraft(this.user()!.id, payload);
        this.proposalId = p.id;
      }
      this.message = 'Bozza salvata ✅';
    } catch (e:any) {
      this.message = e.message ?? 'Errore salvataggio';
    } finally {
      this.loading = false;
    }
  }

  async submit() {
    if (!this.proposalId) { await this.saveDraft(); }
    if (!this.proposalId) return; // se fallito il salvataggio

    this.loading = true; this.message = '';
    try {
      await this.svc.submit(this.proposalId);
      this.message = 'Proposta inviata ✉️';
      // redirect opzionale
      // this.router.navigateByUrl('/proposals');
    } catch (e:any) {
      this.message = e.message ?? 'Errore invio';
    } finally {
      this.loading = false;
    }
  }
}
