import { Component, inject, signal, effect } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { CommonModule } from '@angular/common'; // Import CommonModule for pipes
import {
  lucideClock,
  lucideZap,
  lucideTarget,
  lucideTrendingUp,
  lucideArrowRight,
  lucideCalendar,
  lucideLoader2,
  lucideFileText,
  lucideCode,
  lucideSearch,
  lucideMap,
  lucideLightbulb,
  lucideBriefcase,
  lucideCheckCircle,
  lucideRocket,
  lucideLayoutDashboard,
  lucideTrendingDown
} from '@ng-icons/lucide';
import { DashboardService, DashboardStats } from './dashboard.service';
import { ActivityService } from '../../core/services/activity.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIcon, CommonModule],
  viewProviders: [
    provideIcons({
      lucideClock,
      lucideZap,
      lucideTarget,
      lucideTrendingUp,
      lucideArrowRight,
      lucideCalendar,
      lucideLoader2,
      lucideFileText,
      lucideCode,
      lucideSearch,
      lucideMap,
      lucideLightbulb,
      lucideBriefcase,
      lucideCheckCircle,
      lucideRocket,
      lucideLayoutDashboard,
      lucideTrendingDown
    }),
  ],
  template: `
    <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p class="mt-2 text-muted-foreground">
            Your Product Studio ROI calculator and productivity overview.
          </p>
        </div>
        
        <!-- Timeframe Control -->
        <div class="flex items-center space-x-2 bg-muted p-1 rounded-lg self-start sm:self-auto">
           <button 
             (click)="setTimeframe('30d')"
             [class.bg-background]="timeframe() === '30d'"
             [class.text-foreground]="timeframe() === '30d'"
             [class.shadow-sm]="timeframe() === '30d'"
             class="px-3 py-1.5 text-sm font-medium rounded-md transition-all text-muted-foreground hover:text-foreground">
             Last 30 Days
           </button>
           <button 
             (click)="setTimeframe('all')"
             [class.bg-background]="timeframe() === 'all'"
             [class.text-foreground]="timeframe() === 'all'"
             [class.shadow-sm]="timeframe() === 'all'"
             class="px-3 py-1.5 text-sm font-medium rounded-md transition-all text-muted-foreground hover:text-foreground">
             All Time
           </button>
        </div>
      </div>

      @if (loading()) {
         <div class="flex items-center justify-center py-12">
            <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-muted-foreground" />
         </div>
      } @else if (error()) {
         <div class="rounded-md bg-destructive/15 p-4 text-destructive">
            <div class="flex items-center gap-2 font-medium">
               <ng-icon name="lucideZap" class="h-4 w-4" /> <!-- reusing zap as alert icon replacement -->
               Error Loading Dashboard
            </div>
            <p class="mt-1 text-sm">{{ error() }}</p>
            <button (click)="loadData(timeframe())" class="mt-3 text-sm underline hover:no-underline">Retry</button>
         </div>
      } @else {

      <div class="grid gap-6 md:grid-cols-3">
        <!-- 1. Hours Reclaimed -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="tracking-tight text-sm font-medium text-muted-foreground">Hours Reclaimed</h3>
            <ng-icon name="lucideClock" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="p-6 pt-0">
            <div class="flex items-baseline space-x-2">
              <span class="text-4xl font-bold tracking-tighter">{{ stats()?.roi?.hoursReclaimed }}</span>
              <span class="text-sm font-medium text-muted-foreground">hours</span>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              <span class="text-green-500 font-medium inline-flex items-center">
                <ng-icon name="lucideTrendingUp" class="mr-1 h-3 w-3" />
                saved
              </span>
              based on {{ stats()?.counts?.total }} artifacts
            </p>
            <div class="mt-4 h-1 w-full bg-muted rounded-full overflow-hidden">
               <div class="h-full bg-primary" [style.width.%]="(stats()?.roi?.hoursReclaimed || 0) / 100 * 100"></div> 
               <!-- Simplified progress visual for now -->
            </div>
          </div>
        </div>

        <!-- 2. Velocity Multiplier -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="tracking-tight text-sm font-medium text-muted-foreground">Velocity Multiplier</h3>
            <ng-icon name="lucideZap" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="p-6 pt-0">
             <div class="flex items-baseline space-x-2">
              <span class="text-4xl font-bold tracking-tighter text-blue-600">{{ stats()?.roi?.velocityMultiplier }}x</span>
              <span class="text-sm font-medium text-muted-foreground">faster</span>
            </div>
            <p class="text-xs text-muted-foreground mt-2 mb-4">
              Vs. traditional documentation methods
            </p>
            
            <!-- Visualization: Bar Chart Comparison -->
            <div class="flex items-end space-x-4 h-24 mt-2">
               <div class="flex-1 flex flex-col justify-end group">
                  <div class="w-full bg-muted rounded-t-sm h-[30%] relative group-hover:bg-muted/80 transition-colors">
                     <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">1x</span>
                  </div>
                  <p class="text-[10px] text-center mt-2 text-muted-foreground">Manual</p>
               </div>
               <div class="flex-1 flex flex-col justify-end group">
                  <!-- Dynamic height calculation for visualization, capped at 100% -->
                  <div class="w-full bg-blue-600 rounded-t-sm relative group-hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                       [style.height.%]="getVelocityHeight(stats()?.roi?.velocityMultiplier)">
                    <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-blue-600 font-medium opacity-100">{{ stats()?.roi?.velocityMultiplier }}x</span>
                  </div>
                  <p class="text-[10px] text-center mt-2 font-medium text-blue-600">You</p>
               </div>
            </div>
          </div>
        </div>

        <!-- 3. Focus Shift -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
             <h3 class="tracking-tight text-sm font-medium text-muted-foreground">Strategic Focus</h3>
             <ng-icon name="lucideTarget" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="p-6 pt-0 space-y-4">
             <div>
                <span class="text-4xl font-bold tracking-tighter text-purple-600">{{ stats()?.roi?.strategicFocus }}%</span>
                <span class="text-sm font-medium text-muted-foreground ml-2">Strategy</span>
             </div>
             
             <!-- Visualization: Segmented Bar -->
             <div class="space-y-2">
                <div class="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                  <div class="h-full bg-muted-foreground/30 w-[10%] border-r border-background" title="Drafting (10%)"></div>
                  <div class="h-full bg-purple-600 w-[90%]" title="Strategy (90%)"></div>
                </div>
                <div class="flex justify-between text-[10px] text-muted-foreground px-1">
                   <div class="flex items-center">
                      <div class="w-2 h-2 rounded-full bg-muted-foreground/30 mr-1.5"></div>
                      Drafting ({{ 100 - (stats()?.roi?.strategicFocus || 90) }}%)
                   </div>
                   <div class="flex items-center font-medium text-purple-600">
                      <div class="w-2 h-2 rounded-full bg-purple-600 mr-1.5"></div>
                      Strategy ({{ stats()?.roi?.strategicFocus }}%)
                   </div>
                </div>
             </div>

             <p class="text-xs text-muted-foreground">
                You're spending significantly more time on high-value strategic thinking than manual input.
             </p>
          </div>
        </div>
      </div>
      }

      <!-- Combined Activity Section -->
      @if (recentOutputs().length > 0 || shortcuts().length > 0) {
        <div class="grid gap-6 md:grid-cols-3">
            <!-- Recent Outputs (Left, spanning 2 cols) -->
            <div class="md:col-span-2 rounded-xl border bg-card text-card-foreground shadow-sm">
                <div class="p-6 pb-3 border-b flex items-center justify-between">
                    <h3 class="font-semibold text-lg">Recent Output</h3>
                </div>
                <div class="divide-y">
                     @for (output of recentOutputs(); track output.id + output.type) {
                        <a [href]="output.url" class="flex items-center justify-between p-4 py-3 hover:bg-muted/50 transition-colors group">
                           <div class="min-w-0 pr-4">
                              <div class="font-medium text-sm group-hover:text-primary transition-colors truncate">{{ output.title }}</div>
                              <div class="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">{{ output.type.replace('_', ' ') }}</div>
                           </div>
                           <div class="text-xs text-muted-foreground font-mono whitespace-nowrap text-right">
                              <div>{{ (output.updated_at.endsWith('Z') ? output.updated_at : output.updated_at + 'Z') | date:'mediumDate' }}</div>
                              <div class="text-[10px] opacity-70">{{ (output.updated_at.endsWith('Z') ? output.updated_at : output.updated_at + 'Z') | date:'shortTime' }}</div>
                           </div>
                        </a>
                     }
                </div>
            </div>

            <!-- Frequent Shortcuts (Right, 1 col) -->
            <div class="rounded-xl border bg-card text-card-foreground shadow-sm h-fit">
                <div class="p-6 pb-3 border-b">
                   <h3 class="font-semibold text-lg flex items-center gap-2">
                       Quick Access
                   </h3>
                </div>
                <div class="p-2 space-y-1">
                    @for (item of shortcuts(); track item.id) {
                        <a [href]="item.url" class="flex items-center justify-between px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors">
                            <span>{{ item.name }}</span>
                            <!-- Optional count badge if desired, or simpler text -->
                            <span class="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono">{{ item.count }}</span>
                        </a>
                    }
                </div>
            </div>
        </div>
      }

       <!-- Supporting Section -->
      <div class="rounded-xl border bg-card text-card-foreground shadow-sm p-8 hidden">
         <div class="flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="space-y-2">
               <h3 class="font-semibold text-lg">Detailed ROI Analysis</h3>
               <p class="text-sm text-muted-foreground max-w-2xl">
                  Based on your usage of PRD Generator, Ideation, and Research Planner modules. 
                  Want to improve your velocity further? Try linking your Feasibility analysis to your PRDs.
               </p>
            </div>
            <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
               View Full Report
               <ng-icon name="lucideArrowRight" class="ml-2 h-4 w-4" />
            </button>
         </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  private service = inject(DashboardService);
  private activityService = inject(ActivityService);

  timeframe = signal<'30d' | 'all'>('30d');

  loading = signal(true);
  error = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  shortcuts = this.activityService.shortcuts;
  recentOutputs = signal<any[]>([]);

  constructor() {
    effect(() => {
      this.loadData(this.timeframe());
      this.activityService.loadShortcuts();
      this.loadRecentOutputs();
    });
  }

  loadData(tf: '30d' | 'all') {
    this.loading.set(true);
    this.error.set(null);
    this.service.getStats(tf).subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard stats', err);
        this.error.set(err.message || 'Failed to load data');
        this.loading.set(false);
      }
    });
  }

  async loadRecentOutputs() {
    try {
      const outputs = await this.activityService.getRecentOutputs(5);
      this.recentOutputs.set(outputs);
    } catch (err) {
      console.error('Failed to load recent outputs', err);
    }
  }

  setTimeframe(tf: '30d' | 'all') {
    this.timeframe.set(tf);
  }

  getVelocityHeight(multiplier?: number): number {
    if (!multiplier) return 30; // default to same as manual if missing
    // Scale: 1x = 30%, 5x = 100%
    // Linear interpolation: 30 + (multiplier - 1) * (70 / 4)
    const val = 30 + (multiplier - 1) * 17.5;
    return Math.min(Math.max(val, 30), 100);
  }
}
