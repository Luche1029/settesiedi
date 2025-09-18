import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type Raw = { from?:string; to?:string; amount?:number;
             from_name?:string; to_name?:string };

type Row = { from:string; to:string; amount:number };

@Component({
  selector: 'app-settlements-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settlements-list.html',
  styleUrl:'./settlements-list.scss'
})
export class SettlementsList {
  @Input({required:true}) set settlements(value: Raw[] | null) {
    const safe = (value || []).map(r => ({
      from: (r.from ?? r.from_name ?? '').trim(),
      to:   (r.to   ?? r.to_name   ?? '').trim(),
      amount: Number(r.amount ?? 0)
    })).filter(r => r.from && r.to && r.amount > 0);
    this.rows.set(safe);
  }

  rows = signal<Row[]>([]);
  
  groupBy = signal<'none' | 'debtor' | 'creditor'>('none');
  // raggruppamento reattivo
   groups = computed(() => {
    const rs = this.rows();
    const mode = this.groupBy();
    if (mode === 'none') return [];

    const byKey = new Map<string, Row[]>();
    const keyOf = (r:Row) => mode === 'debtor' ? r.from : r.to;

    for (const r of rs) {
      const k = keyOf(r);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(r);
    }
    return Array.from(byKey.entries())
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([name, items]) => ({
        name,
        items: items.sort((a,b)=>b.amount-a.amount),
        total: items.reduce((s,i)=>s+i.amount,0)
      }));
  });
  total = computed(() => this.rows().reduce((s,i)=>s+i.amount,0));
}
