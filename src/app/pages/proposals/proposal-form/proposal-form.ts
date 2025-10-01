// src/app/pages/proposals/proposal-form/proposal-form.component.ts
import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProposalService } from '../../../services/proposal.service';
import { AuthService } from '../../../services/auth.service';
import { ChangeDetectorRef, NgZone, signal } from '@angular/core';

type ItemFG = FormGroup<{
  name: FormControl<string>;
  notes: FormControl<string>;
}>;

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

  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  // Usiamo controlli NON-nullabili per evitare i conflitti di tipo
  form: FormGroup<{
    title: FormControl<string>;
    proposalDate: FormControl<string>;
    notes: FormControl<string>;
    items: FormArray<ItemFG>;
  }> = this.fb.nonNullable.group({
    title: this.fb.nonNullable.control(''),        
    proposalDate: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    notes: this.fb.nonNullable.control(''),
    items: this.fb.nonNullable.array<ItemFG>([])
  });

  loading = false;
  message = '';
  proposalId: string | null = null;
  user = computed(() => this.auth.user());

  get items(): FormArray<ItemFG> {
    return this.form.controls.items;
  }

  pageTitle = signal('Nuova proposta');

  ngOnInit() {
    this.auth.restore(); 
    this.proposalId = this.route.snapshot.paramMap.get('id');
    if (this.proposalId) this.loadDraft(this.proposalId);
    if (this.items.length === 0) this.addItem(); // almeno una riga pronta
  }

  private async loadDraft(id: string) {
    this.loading = true;
    try {
      const data: any = await this.svc.getWithItems(id);
      this.form.patchValue({
        proposalDate: (data?.proposal_date as string) ?? '',
        title: (data?.title as string) ?? '',   
        notes: (data?.notes as string) ?? ''
      });

      this.items.clear();
      (data?.proposal_dish ?? []).forEach((it: any) => {
        this.addItem(it?.dish?.name ?? '', it?.notes ?? '');
      });
      if (this.items.length === 0) this.addItem();
    } catch (e: any) {
      this.message = e.message ?? 'Errore caricamento bozza';
    } finally {
      this.loading = false;
    }
  }

  private createItemGroup(name = '', notes = ''): ItemFG {
    return this.fb.nonNullable.group({
      name: this.fb.nonNullable.control(name, { validators: [Validators.required, Validators.minLength(2)] }),
      notes: this.fb.nonNullable.control(notes)
    });
  }

  addItem(name = '', notes = '') {
    this.items.push(this.createItemGroup(name, notes));
  }

  removeItem(i: number) {
    this.items.removeAt(i);
    if (this.items.length === 0) this.addItem();
  }

  trackByIndex = (i: number) => i;

  async saveProposal(status: string) {
    if (!this.user()) { this.message = 'Non sei loggato.'; return; }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    // ✅ Leggi dai controls non-nullabili
    const payload: import('../../../services/proposal.service').ProposalInput = {
      title: this.form.controls.title.value,
      proposalDate: this.form.controls.proposalDate.value,   // string
      notes: this.form.controls.notes.value,                 // string
      items: this.items.controls.map(g => ({
        name: g.controls.name.value,                         // string
        notes: g.controls.notes.value                        // string
      }))
    };

    this.loading = true; 
    this.message = '';
    try {      
      const p = await this.svc.createProposal(this.user()!.id, payload, status);
      this.proposalId = p.id;      
      this.message = 'Bozza salvata ✅';
      queueMicrotask(() => {
        this.pageTitle.set('Modifica proposta');
        this.cdr.detectChanges();
      });
      this.router.navigateByUrl('/proposals');
    } catch (e:any) {
      this.message = e.message ?? 'Errore salvataggio';
    } finally {
      this.loading = false;
    }
  }
}
