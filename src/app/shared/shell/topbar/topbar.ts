import { Component, computed, inject, signal } from '@angular/core';
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

  avatarUrl = signal<string | null>(null);
  
  user = computed(() => this.auth.user());

  async ngOnInit() {
    this.avatarUrl.set(await this.acc.getAvatarUrl(this.user()?.avatar || null));
  }
  async logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  encodeName(name: string) {
    return encodeURIComponent(name);
  }

}
