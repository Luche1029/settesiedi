import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { supabase } from '../../../supabase/supabase.client';
@Component({
  standalone: true,
  template: `<div class="login-box"><h2>Accesso in corso…</h2><p class="muted">Un attimo…</p></div>`
})
export class AuthCallbackComponent implements OnInit {
  constructor(private router: Router) {}
  async ngOnInit() {
    // Supabase intercetta automaticamente i token nell’URL (detectSessionInUrl: true)
    // ma su alcune SPA serve un piccolo delay per avere la sessione
    const { data: { session } } = await supabase.auth.getSession();
    if (session) this.router.navigateByUrl('/menus');
    else {
      // attendi cambio stato (es. quando il token viene scritto nel localStorage)
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
        if (s) this.router.navigateByUrl('/menus');
      });
      // safety timeout per evitare loop infiniti
      setTimeout(() => this.router.navigateByUrl('/login'), 5000);
    }
  }
}
