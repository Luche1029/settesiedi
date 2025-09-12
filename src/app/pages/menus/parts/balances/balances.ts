import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../../../services/expense.service';

type Net = { user_id: string; name: string; net: number; };

@Component({
  selector: 'app-balances',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./balances.html`
})
export class Balances implements OnInit {
  @Input() eventId!: string;
  private svc = inject(ExpenseService);

  nets = signal<Net[]>([]);
  settlements = signal<{from:string;to:string;amount:number}[]>([]);
  message = signal('');

  async ngOnInit(){
    await this.compute();
  }

  async compute() {
    try {
      const expenses = await this.svc.listByEvent(this.eventId);
      // net = pagato - dovuto
      const map = new Map<string, Net>();
      for (const e of expenses) {
        // payer +
        const pKey = e.user_id;
        if (!map.has(pKey)) map.set(pKey, { user_id:pKey, name:e.payer_name, net:0 });
        map.get(pKey)!.net += Number(e.amount||0);

        // shares -
        for (const s of e.shares||[]) {
          const key = s.user_id;
          if (!map.has(key)) map.set(key, { user_id:key, name:s.name, net:0 });
          map.get(key)!.net -= Number(s.amount||0);
        }
      }
      const nets = Array.from(map.values()).filter(n => Math.abs(n.net) > 0.001);
      this.nets.set(nets);

      // greedy settlements
      const cred = nets.filter(n=>n.net>0).map(n=>({name:n.name, net:+n.net})).sort((a,b)=>b.net-a.net);
      const debt = nets.filter(n=>n.net<0).map(n=>({name:n.name, net:-n.net})).sort((a,b)=>b.net-a.net);
      const out: {from:string;to:string;amount:number}[] = [];
      let i=0,j=0;
      while(i<debt.length && j<cred.length){
        const amt = Math.min(debt[i].net, cred[j].net);
        out.push({ from: debt[i].name, to: cred[j].name, amount: Math.round(amt*100)/100 });
        debt[i].net -= amt; cred[j].net -= amt;
        if (debt[i].net < 0.001) i++;
        if (cred[j].net < 0.001) j++;
      }
      this.settlements.set(out);
    } catch(e:any){
      this.message.set(e.message ?? 'Errore calcolo bilanci');
    }
  }
}
