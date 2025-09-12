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
    proposalDate: ['', [Validators.required]],   // <-- prima era title
    title: [''],
    notes: [''],
    items: this.fb.array([])
  });

  private async loadDraft(id: string) {
    this.loading = true;
    try {
      const data = await this.svc.getWithItems(id);
      this.form.patchValue({
        proposalDate: data.proposal_date,        // <-- usa la data
        notes: data.notes ?? ''
      });
      this.items.clear();
      (data.proposal_item || []).forEach((it: any) => this.addItem(it.name, it.notes));
    } finally { this.loading = false; }
  }

  async saveDraft() {
    if (!this.user()) { this.message = 'Non sei loggato.'; return; }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const payload = {
      proposalDate: this.form.value.proposalDate,
      title: this.form.value.title || '',
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
        this.router.navigateByUrl('/proposals');

      } catch (e:any) {
        this.message = e.message ?? 'Errore salvataggio';
      } finally {
        this.loading = false;
      }
  }

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
