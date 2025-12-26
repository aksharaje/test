import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideClock,
  lucideZap,
  lucideTarget,
  lucideTrendingUp,
  lucideArrowRight
} from '@ng-icons/lucide';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      lucideClock,
      lucideZap,
      lucideTarget,
      lucideTrendingUp,
      lucideArrowRight
    }),
  ],
  template: `
    <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p class="mt-2 text-muted-foreground">
          Your Product Studio ROI calculator and productivity overview.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <!-- 1. Hours Reclaimed -->
        <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="tracking-tight text-sm font-medium text-muted-foreground">Hours Reclaimed</h3>
            <ng-icon name="lucideClock" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="p-6 pt-0">
            <div class="flex items-baseline space-x-2">
              <span class="text-4xl font-bold tracking-tighter">42</span>
              <span class="text-sm font-medium text-muted-foreground">hours</span>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              <span class="text-green-500 font-medium inline-flex items-center">
                <ng-icon name="lucideTrendingUp" class="mr-1 h-3 w-3" />
                +12h
              </span>
              from last sprint
            </p>
            <div class="mt-4 h-1 w-full bg-muted rounded-full overflow-hidden">
               <div class="h-full bg-primary w-[75%]"></div>
            </div>
            <p class="text-[10px] text-muted-foreground mt-2">
              Equivalent to <span class="font-medium text-foreground">1 entire work week</span> saved.
            </p>
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
              <span class="text-4xl font-bold tracking-tighter text-blue-600">3.5x</span>
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
                  <div class="w-full bg-blue-600 rounded-t-sm h-full relative group-hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                    <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-blue-600 font-medium opacity-100">3.5x</span>
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
                <span class="text-4xl font-bold tracking-tighter text-purple-600">90%</span>
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
                      Drafting (10%)
                   </div>
                   <div class="flex items-center font-medium text-purple-600">
                      <div class="w-2 h-2 rounded-full bg-purple-600 mr-1.5"></div>
                      Strategy (90%)
                   </div>
                </div>
             </div>

             <p class="text-xs text-muted-foreground">
                You're spending significantly more time on high-value strategic thinking than manual input.
             </p>
          </div>
        </div>
      </div>

       <!-- Supporting Section -->
      <div class="rounded-xl border bg-card text-card-foreground shadow-sm p-8">
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
export class DashboardComponent { }
