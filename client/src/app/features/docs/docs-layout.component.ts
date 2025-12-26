import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DocsService } from './docs.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBook, lucideMenu, lucideSearch, lucideChevronDown } from '@ng-icons/lucide';

@Component({
  selector: 'app-docs-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NgIconComponent],
  providers: [provideIcons({ lucideBook, lucideMenu, lucideSearch, lucideChevronDown })],
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-50">
      <!-- Sidebar -->
      <aside class="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto flex flex-col">
        <div class="p-4 border-b border-slate-100 flex-shrink-0">
          <div class="flex items-center gap-2 mb-1">
             <img src="logo.png" alt="Logo" class="h-6 w-auto" />
             <span class="font-semibold text-slate-900 tracking-tight">Product Studio</span>
          </div>
          <h2 class="text-xs font-medium text-slate-500 uppercase tracking-wider mt-2">
            Documentation
          </h2>
        </div>
        
        <nav class="p-3 space-y-6 flex-1 overflow-y-auto">
          <div *ngIf="docsService.isLoading()" class="text-sm text-slate-400 p-2">Loading docs...</div>

          <div *ngFor="let category of categories()">
             <h3 class="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {{ category.name }}
             </h3>
             <div class="space-y-0.5">
                <ng-container *ngFor="let item of category.items">
                    <a [routerLink]="['/docs', item.name]" 
                       routerLinkActive="bg-indigo-50 text-indigo-700 font-medium"
                       class="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors group">
                       <span class="group-hover:text-indigo-600">{{ formatName(item.name) }}</span>
                    </a>
                </ng-container>
             </div>
          </div>
        </nav>
      </aside>

      <!-- Content Area -->
      <main class="flex-1 overflow-y-auto bg-slate-50">
        <div class="max-w-5xl mx-auto p-8">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
                <router-outlet></router-outlet>
            </div>
        </div>
      </main>
    </div>
  `,
  styles: [`:host { display: block; height: 100vh; }`]
})
export class DocsLayoutComponent {
  docsService = inject(DocsService);

  // Group items by category
  categories = computed(() => {
    const manifest = this.docsService.manifest();
    const groups: Record<string, any[]> = {};

    // Sort order for categories
    const order = ['Research', 'Ideation', 'Feasibility', 'Customer Experience', 'Backlog Authoring', 'PI Planning', 'Core', 'General'];

    manifest.forEach(item => {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return order.map(name => ({
      name,
      items: groups[name] || []
    })).filter(g => g.items.length > 0);
  });

  formatName(name: string): string {
    // Remove "Service" suffix and spacing
    return name.replace('Service', '').replace(/([A-Z])/g, ' $1').trim();
  }
}
