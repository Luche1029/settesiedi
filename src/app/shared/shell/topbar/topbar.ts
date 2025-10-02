import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AccountService } from '../../../services/account.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss'
})

export class Topbar {
  private acc = inject(AccountService);
  private auth = inject(AuthService);
  private router = inject(Router);

  fallbackAvatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
     <rect width="100%" height="100%" fill="#f3f4f6"/>
     <circle cx="64" cy="48" r="24" fill="#d1d5db"/>
     <rect x="24" y="84" width="80" height="28" rx="14" fill="#d1d5db"/>
   </svg>`
);

  avatarUrl = signal<string | null>(null);
  
  user = computed(() => this.auth.user());

  private userEffect = effect(
    () => {
      // quando cambia user() → ricalcola avatar
      // (usiamo microtask per non spaccare change detection)
      const _ = this.user(); 
      queueMicrotask(() => { this.refreshAvatar(); });
    },
    { allowSignalWrites: true }
  );

  async ngOnInit() {
     this.auth.restore();
    await this.refreshAvatar();
  }

  async logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  private async refreshAvatar() {
    try {
      console.log(this.user()?.avatar);
      const url = await this.acc.getAvatarUrl(this.user()?.avatar || null);
      this.avatarUrl.set(url || this.fallbackAvatar);
    } catch {
      this.avatarUrl.set(this.fallbackAvatar);
    }
  }

  onAvatarError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    // evita loop: setta direttamente il dato
    img.onerror = null;
    img.src = this.fallbackAvatar;
  }

  encodeName(name: string) {
    return encodeURIComponent(name);
  }

}
