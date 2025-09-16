import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxGraphModule, Node, Edge } from '@swimlane/ngx-graph';
import { Subject } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

type Settlement = { from: string; to: string; amount: number };

@Component({
  selector: 'app-settlements-graph',
  standalone: true,
  imports: [CommonModule, NgxGraphModule],
  templateUrl: './settlements-graph.html',
  styleUrl: './settlements-graph.scss'
})
export class SettlementsGraph implements OnChanges {
  @Input() settlements: Settlement[] = [];

  nodes: Node[] = [];
  links: Edge[] = [];

  // palette coerente con il tuo tema
  accent = getComputedStyle(document.documentElement).getPropertyValue('--col-accent')?.trim() || '#a7a8ca';
  borders = getComputedStyle(document.documentElement).getPropertyValue('--col-borders')?.trim() || '#150e7a';

  update$ = new Subject<boolean>();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges() {
    const norm = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

    // filtra/normalizza i link validi
    const clean = (this.settlements || [])
      .filter(s => s && isFinite(s.amount as any))
      .map(s => ({ from: norm(s.from), to: norm(s.to), amount: Number(s.amount) }))
      .filter(s => s.from && s.to && s.from !== s.to); // niente self-loop o vuoti

    // ids realmente presenti nei link
    const ids = Array.from(new Set(clean.flatMap(s => [s.from, s.to])));

    // nodi
    this.nodes = ids.map(id => ({
      id,
      label: id,
      data: { bg: this.accent, stroke: this.borders }
    }));

    // spessore/colore archi
    const max = Math.max(...clean.map(s => s.amount), 1);
    const minW = 2, maxW = 10;

    this.links = clean.map((s, i) => ({
      id: `${s.from}->${s.to}#${i}`,   // id univoco
      source: s.from,
      target: s.to,
      label: `€ ${s.amount.toFixed(2)}`,
      data: {
        amount: s.amount,
        width: minW + (maxW - minW) * (s.amount / max),
        color: this.mixColor(this.accent, this.borders, Math.min(1, s.amount / max) * 0.7)
      }
    }));

    // assicura che ngx-graph ricalcoli dopo l’update
    this.cdr.detectChanges();
    this.update$.next(true);
  }
  // piccola utility per mixare colori HEX
  private mixColor(hex1: string, hex2: string, t: number) {
    const c1 = this.hexToRgb(hex1) || {r:167,g:168,b:202};
    const c2 = this.hexToRgb(hex2) || {r:21,g:14,b:122};
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r},${g},${b})`;
  }
  private hexToRgb(h: string) {
    const m = h.replace('#','').match(/^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
    return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
  }

  initials(label: unknown): string {
    const s = typeof label === 'string' ? label : '';
    return s.slice(0, 2).toUpperCase();
  }

}
