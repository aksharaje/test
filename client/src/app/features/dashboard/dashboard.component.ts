import { Component, inject, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  lucideTrendingDown,
  lucideInfo,
  lucideTrophy,
  lucideFlame,
  lucideMedal,
  lucidePieChart,
  lucideBarChart3,
  lucideLineChart,
  lucideX,
  lucideChevronDown,
  lucideChevronRight
} from '@ng-icons/lucide';
import { DashboardService, DashboardStats, DashboardReport, ReportGroup } from './dashboard.service';
import { ActivityService } from '../../core/services/activity.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIcon, CommonModule, RouterLink],
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
      lucideTrendingDown,
      lucideInfo,
      lucideTrophy,
      lucideFlame,
      lucideMedal,
      lucidePieChart,
      lucideBarChart3,
      lucideLineChart,
      lucideX,
      lucideChevronDown,
      lucideChevronRight
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

        <!-- 1. Productivity (formerly Hours Reclaimed) -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm cursor-pointer hover:border-primary transition-all group/card relative overflow-hidden" (click)="openReport('productivity')">
          <div class="absolute inset-0 bg-primary/0 group-hover/card:bg-primary/5 transition-colors"></div>
          <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <div class="flex items-center gap-2">
              <h3 class="tracking-tight text-sm font-medium text-muted-foreground group-hover/card:text-primary transition-colors">Productivity</h3>
            </div>
            <ng-icon name="lucidePieChart" class="h-4 w-4 text-muted-foreground group-hover/card:text-primary" />
          </div>
          <div class="p-6 pt-0 relative z-10">
            <div class="flex items-baseline space-x-2">
              <span class="text-4xl font-bold tracking-tighter">{{ stats()?.roi?.hoursReclaimed }}</span>
              <span class="text-sm font-medium text-muted-foreground">hours</span>
            </div>
            <p class="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span class="text-green-500 font-medium inline-flex items-center">
                <ng-icon name="lucideTrendingUp" class="mr-1 h-3 w-3" />
                saved
              </span>
              based on {{ stats()?.counts?.total }} artifacts generated
            </p>
          </div>
        </div>

        <!-- 2. Velocity Multiplier -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm cursor-pointer hover:border-primary transition-all group/card relative overflow-hidden" (click)="openReport('velocity')">
          <div class="absolute inset-0 bg-primary/0 group-hover/card:bg-primary/5 transition-colors"></div>
          <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <div class="flex items-center gap-2">
               <h3 class="tracking-tight text-sm font-medium text-muted-foreground group-hover/card:text-primary transition-colors">Velocity Multiplier</h3>
            </div>
            <ng-icon name="lucideBarChart3" class="h-4 w-4 text-muted-foreground group-hover/card:text-primary" />
          </div>
          <div class="p-6 pt-0 relative z-10">
             <div class="flex items-baseline space-x-2">
              <span class="text-4xl font-bold tracking-tighter text-blue-600">{{ stats()?.roi?.velocityMultiplier }}x</span>
              <span class="text-sm font-medium text-muted-foreground">faster</span>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Vs. traditional documentation methods
            </p>
          </div>
        </div>

        <!-- 3. Product Mastery (Gamification) -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm relative">
           <!-- Header -->
           <div class="p-6 flex flex-row items-center justify-between pb-2">
              <div class="flex items-center gap-2">
                 <h3 class="tracking-tight text-sm font-medium text-muted-foreground">Product Mastery</h3>
                 <div class="group relative flex items-center">
                    <ng-icon name="lucideInfo" class="h-3 w-3 text-muted-foreground/50 hover:text-foreground cursor-help" />
                    <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-56 p-2 bg-popover text-popover-foreground text-xs rounded shadow-md border z-50 pointer-events-none">
                       Your growth as a product leader based on experience (XP), tool mastery, and consistency.
                    </div>
                 </div>
              </div>
              <div class="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-medium border border-orange-100 flex items-center gap-1">
                <ng-icon name="lucideFlame" class="h-3 w-3" />
                {{ stats()?.gamification?.streakWeeks || 0 }} Week Streak
              </div>
           </div>

           <div class="p-6 pt-0 space-y-6">
              <!-- 1. Level -->
              <div>
                 <div class="flex justify-between items-baseline mb-1">
                    <span class="text-2xl font-bold tracking-tight">Level {{ stats()?.gamification?.level || 1 }}</span>
                    <span class="text-xs text-muted-foreground">Product Leader</span>
                 </div>
                 <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-yellow-400 to-yellow-600" 
                         [style.width.%]="(stats()?.gamification?.progressXp || 0) / 1000 * 100">
                    </div>
                 </div>
                 <p class="text-[10px] text-muted-foreground text-right mt-1">
                    {{ stats()?.gamification?.progressXp || 0 }} / 1000 XP to next level
                 </p>
              </div>
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
                    <h3 class="font-semibold text-lg">Recent Artifacts</h3>
                </div>
                <div class="divide-y">
                     @if (recentOutputs().length === 0) {
                        <div class="p-6 text-center text-muted-foreground">
                           <p class="text-sm">No artifacts created yet.</p>
                           <p class="text-xs mt-1">Your recent PRDs, research plans, and other outputs will appear here.</p>
                        </div>
                     } @else {
                        @for (output of recentOutputs(); track output.id + output.type) {
                           <a [routerLink]="output.url" class="flex items-center justify-between p-4 py-3 hover:bg-muted/50 transition-colors group">
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
                        <a [routerLink]="item.url" class="flex items-center px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors">
                            <span>{{ item.name }}</span>
                        </a>
                    }
                </div>
            </div>
        </div>
      } @else if (!loading()) {
        <!-- Empty State -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm p-8">
          <div class="flex flex-col items-center justify-center text-center space-y-4">
            <div class="p-4 rounded-full bg-muted">
              <ng-icon name="lucideLightbulb" class="h-8 w-8 text-muted-foreground" />
            </div>
            <div class="space-y-2">
              <h3 class="font-semibold text-lg">No artifacts yet</h3>
              <p class="text-sm text-muted-foreground max-w-md">
                Start creating PRDs, research plans, journey maps, and more to see your productivity metrics grow. Your recent work will appear here.
              </p>
            </div>
            <a routerLink="/prd-generator" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              Create your first PRD
              <ng-icon name="lucideArrowRight" class="ml-2 h-4 w-4" />
            </a>
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


    <!-- METRICS SIDEBAR (DRAWER) -->
    @if (showReport()) {
      <div class="fixed inset-0 z-50 flex justify-end">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" (click)="closeReport()"></div>
        
        <!-- Sidebar Content -->
        <div class="relative w-full max-w-md h-full bg-card border-l shadow-2xl flex flex-col p-6 overflow-hidden animate-in slide-in-from-right duration-300">
           
           <!-- Header -->
           <div class="flex items-center justify-between mb-6">
              <div>
                  <h2 class="text-xl font-bold tracking-tight">
                    {{ reportType() === 'productivity' ? 'Productivity Report' : 'Velocity Report' }}
                  </h2>
                   <p class="text-sm text-muted-foreground">
                    {{ reportType() === 'productivity' ? 'Total Time Saved Breakdown' : 'Volume of artifacts created versus the traditional approach baseline of 40' }}
                  </p>
              </div>
              <button (click)="closeReport()" class="p-2 rounded-full hover:bg-muted transition-colors">
                 <ng-icon name="lucideX" class="h-5 w-5" />
              </button>
           </div>

           <!-- Summary Card -->
           @if (reportData(); as data) {
             <div class="bg-muted/50 rounded-lg p-4 mb-6 border">
                @if (reportType() === 'productivity') {
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium text-muted-foreground">Total Reclaimed</span>
                        <span class="text-2xl font-bold">{{ data.total_hours }}h</span>
                    </div>
                    <div class="text-xs text-muted-foreground">
                        Across {{ data.groups.length }} active modules.
                    </div>
                } @else {
                     <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium text-muted-foreground">Total Output</span>
                        <span class="text-2xl font-bold">{{ data.total_count }} artifacts</span>
                    </div>
                    <div class="text-xs text-muted-foreground">
                        Vs Baseline of {{ reportData()?.baseline || 40 }} / month
                    </div>
                }
             </div>

             <!-- List -->
             <div class="flex-1 overflow-y-auto space-y-4 pr-2">
                @for (group of data.groups; track group.id) {
                    <div class="border rounded-lg bg-card overflow-hidden">
                        <!-- Group Header with expand toggle -->
                        <div (click)="toggleGroup(group.id)" class="bg-muted/30 p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors select-none">
                            <div class="flex items-center gap-2">
                                <ng-icon [name]="isExpanded(group.id) ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4 text-muted-foreground" />
                                <span class="font-medium text-sm">{{ group.label }}</span>
                                <span class="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{{ group.count }}</span>
                            </div>
                            <div class="text-xs font-mono font-medium">
                                {{ reportType() === 'productivity' ? group.total_hours + 'h' : '' }}
                            </div>
                        </div>
                        
                        <!-- Body -->
                         @if (isExpanded(group.id)) {
                             <div class="border-t bg-background/50">
                                 <!-- Context -->
                                 <div class="p-2 bg-yellow-50/50 text-[10px] text-yellow-800 border-b flex justify-between px-3">
                                     <span>Calculation: {{ group.count }} runs × {{ group.hours_per_unit }}h saved/run</span>
                                 </div>
                                 <div class="divide-y">
                                     @for (item of group.items; track item.id) {
                                         <a [routerLink]="getItemUrl(item, group.id)" class="p-3 pl-9 flex flex-col gap-0.5 hover:bg-muted/30 cursor-pointer transition-colors block">
                                             <span class="text-sm font-medium truncate">{{ item.title }}</span>
                                             <span class="text-[10px] text-muted-foreground">{{ item.date | date:'medium' }}</span>
                                         </a>
                                     }
                                 </div>
                             </div>
                         }
                    </div>
                }
             </div>
           } @else {
             <div class="flex-1 flex items-center justify-center text-muted-foreground">
                <ng-icon name="lucideLoader2" class="h-6 w-6 animate-spin" />
             </div>
           }

        </div>
      </div>
    }
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

  // Report State
  showReport = signal(false);
  reportType = signal<'productivity' | 'velocity'>('productivity');
  reportData = signal<DashboardReport | null>(null);
  expandedGroups = signal<Set<string>>(new Set());

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

  // Sidebar Logic
  openReport(type: 'productivity' | 'velocity') {
    this.reportType.set(type);
    this.showReport.set(true);
    this.reportData.set(null); // Reset while loading

    this.service.getReport(this.timeframe(), type).subscribe({
      next: (data) => {
        this.reportData.set(data);
        // Start with all groups collapsed
        this.expandedGroups.set(new Set());
      },
      error: (err) => console.error(err)
    });
  }

  closeReport() {
    this.showReport.set(false);
  }

  toggleGroup(id: string) {
    const current = new Set(this.expandedGroups());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedGroups.set(current);
  }

  isExpanded(id: string): boolean {
    return this.expandedGroups().has(id);
  }

  getItemUrl(item: any, groupId: string): string {
    // Map group IDs to their appropriate URL patterns
    const urlMap: Record<string, string> = {
      'prd': '/prd-generator/output',
      'ideation': '/ideation/results',
      'feasibility': '/feasibility/results',
      'business_case': '/business-case/results',
      'journey_mapper': '/journey-mapper/results',
      'research_planner': '/research-planner/results',
      'release_prep': '/release-prep',
      'roadmap_planner': '/roadmapping/planner/session',
      'story_to_code': '/story-to-code/results',
      'competitive_analysis': '/research/competitive-analysis/results',
      'scope_definition': '/scoping/definition/results',
      'scope_monitor': '/scoping/monitor/results',
      'okr_generator': '/measurements/okr-generator/results',
      'goal_setting': '/goals/setting/results',
      'measurement_framework': '/measurements/framework/results',
      'scenario_modeler': '/roadmapping/scenario-modeler/session',
      'gap_analyzer': '/gap-analyzer/results',
      'cx_recommender': '/cx-recommender/results',
      'roadmap_communicator': '/roadmapping/communicator/session',
      'kpi_assignment': '/measurements/kpi-assignment/results'
    };

    const basePath = urlMap[groupId] || `/${groupId}/results`;
    return `${basePath}/${item.id}`;
  }
}
