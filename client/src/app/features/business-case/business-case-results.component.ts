import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DecimalPipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader2,
  lucideDollarSign,
  lucideTrendingUp,
  lucideTrendingDown,
  lucideAlertTriangle,
  lucideCheckCircle,
  lucideXCircle,
  lucideInfo,
  lucideChevronDown,
  lucideChevronRight,
  lucideEdit,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { BusinessCaseService } from './business-case.service';
import type { SessionDetail, FinancialScenario, CostItem, BenefitItem, SensitivityAnalysis, RateAssumption } from './business-case.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-business-case-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, DecimalPipe, CurrencyPipe, TitleCasePipe],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideLoader2,
      lucideDollarSign,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideAlertTriangle,
      lucideCheckCircle,
      lucideXCircle,
      lucideInfo,
      lucideChevronDown,
      lucideChevronRight,
      lucideEdit,
      lucideRefreshCw,
    }),
  ],
  template: `
    <div class="min-h-full bg-muted/30">
      @if (service.loading() && !detail()) {
        <div class="flex items-center justify-center h-64">
          <ng-icon name="lucideLoader2" class="h-8 w-8 animate-spin text-primary" />
        </div>
      } @else if (!detail()) {
        <div class="text-center py-12">
          <p class="text-muted-foreground">Business case not found</p>
          <button hlmBtn variant="outline" class="mt-4" (click)="goBack()">
            <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
            Back to Input
          </button>
        </div>
      } @else {
        <!-- Header -->
        <div class="bg-background border-b sticky top-0 z-10">
          <div class="max-w-7xl mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <button
                  class="p-2 hover:bg-muted rounded-lg transition-colors"
                  (click)="goBack()"
                  title="Back"
                >
                  <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
                </button>
                <div>
                  <h1 class="text-xl font-bold text-foreground">{{ detail()!.session.featureName }}</h1>
                  <p class="text-sm text-muted-foreground">Business Case Analysis</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <!-- Recommendation Badge -->
                @if (detail()!.session.recommendation) {
                  <span
                    class="px-4 py-2 rounded-full text-sm font-medium"
                    [class.bg-green-100]="detail()!.session.recommendation === 'invest'"
                    [class.text-green-700]="detail()!.session.recommendation === 'invest'"
                    [class.bg-yellow-100]="detail()!.session.recommendation === 'conditional'"
                    [class.text-yellow-700]="detail()!.session.recommendation === 'conditional'"
                    [class.bg-red-100]="detail()!.session.recommendation === 'defer' || detail()!.session.recommendation === 'reject'"
                    [class.text-red-700]="detail()!.session.recommendation === 'defer' || detail()!.session.recommendation === 'reject'"
                  >
                    @if (detail()!.session.recommendation === 'invest') {
                      <ng-icon name="lucideCheckCircle" class="inline h-4 w-4 mr-1" />
                    } @else if (detail()!.session.recommendation === 'conditional') {
                      <ng-icon name="lucideAlertTriangle" class="inline h-4 w-4 mr-1" />
                    } @else {
                      <ng-icon name="lucideXCircle" class="inline h-4 w-4 mr-1" />
                    }
                    {{ formatRecommendation(detail()!.session.recommendation!) }}
                  </span>
                }
                <!-- Confidence Badge -->
                <span
                  class="px-3 py-1 rounded-full text-xs font-medium"
                  [class.bg-green-100]="detail()!.session.confidenceLevel === 'high'"
                  [class.text-green-700]="detail()!.session.confidenceLevel === 'high'"
                  [class.bg-yellow-100]="detail()!.session.confidenceLevel === 'medium'"
                  [class.text-yellow-700]="detail()!.session.confidenceLevel === 'medium'"
                  [class.bg-red-100]="detail()!.session.confidenceLevel === 'low'"
                  [class.text-red-700]="detail()!.session.confidenceLevel === 'low'"
                >
                  {{ detail()!.session.confidenceLevel | titlecase }} Confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-6 py-6 space-y-6">
          <!-- Executive Summary -->
          @if (detail()!.session.executiveSummary) {
            <div class="bg-background rounded-lg border p-6">
              <h2 class="text-lg font-semibold mb-3">Executive Summary</h2>
              <p class="text-muted-foreground leading-relaxed">{{ detail()!.session.executiveSummary }}</p>
            </div>
          }

          <!-- Key Financial Metrics -->
          <div class="grid grid-cols-4 gap-4">
            <div class="bg-background rounded-lg border p-4">
              <p class="text-sm text-muted-foreground">Total Investment (Year 1)</p>
              <p class="text-2xl font-bold mt-1">
                {{ formatCurrency(detail()!.session.totalInvestment || 0) }}
              </p>
            </div>
            <div class="bg-background rounded-lg border p-4">
              <p class="text-sm text-muted-foreground">Net Present Value (5-Year)</p>
              <p class="text-2xl font-bold mt-1" [class.text-green-600]="(detail()!.session.netPresentValue || 0) > 0" [class.text-red-600]="(detail()!.session.netPresentValue || 0) <= 0">
                {{ formatCurrency(detail()!.session.netPresentValue || 0) }}
              </p>
            </div>
            <div class="bg-background rounded-lg border p-4">
              <p class="text-sm text-muted-foreground">Internal Rate of Return</p>
              <p class="text-2xl font-bold mt-1" [class.text-green-600]="(detail()!.session.internalRateOfReturn || 0) > 15">
                @if (detail()!.session.internalRateOfReturn !== null) {
                  {{ detail()!.session.internalRateOfReturn | number:'1.1-1' }}%
                } @else {
                  N/A
                }
              </p>
            </div>
            <div class="bg-background rounded-lg border p-4">
              <p class="text-sm text-muted-foreground">Payback Period</p>
              <p class="text-2xl font-bold mt-1">
                @if (detail()!.session.paybackMonths !== null) {
                  {{ detail()!.session.paybackMonths }} months
                } @else {
                  N/A
                }
              </p>
            </div>
          </div>

          <!-- Scenario Comparison -->
          <div class="bg-background rounded-lg border">
            <div class="p-4 border-b">
              <h2 class="text-lg font-semibold">Scenario Analysis</h2>
              <p class="text-sm text-muted-foreground mt-1">Compare financial outcomes across different scenarios</p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="bg-muted/50">
                    <th class="text-left p-4 font-medium">Metric</th>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <th class="text-right p-4 font-medium">
                        {{ scenario.scenarioType | titlecase }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">Year 1 Investment</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium">{{ formatCurrency(scenario.totalInvestmentYear1) }}</td>
                    }
                  </tr>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">5-Year Investment</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium">{{ formatCurrency(scenario.totalInvestment5Year) }}</td>
                    }
                  </tr>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">Year 1 Benefits</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium text-green-600">{{ formatCurrency(scenario.totalAnnualBenefitsYear1) }}</td>
                    }
                  </tr>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">5-Year Benefits</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium text-green-600">{{ formatCurrency(scenario.totalBenefits5Year) }}</td>
                    }
                  </tr>
                  <tr class="border-t bg-muted/30">
                    <td class="p-4 font-medium">Net Present Value</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-bold" [class.text-green-600]="scenario.netPresentValue > 0" [class.text-red-600]="scenario.netPresentValue <= 0">
                        {{ formatCurrency(scenario.netPresentValue) }}
                      </td>
                    }
                  </tr>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">IRR</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium">
                        @if (scenario.internalRateOfReturn !== null) {
                          {{ scenario.internalRateOfReturn | number:'1.1-1' }}%
                        } @else {
                          N/A
                        }
                      </td>
                    }
                  </tr>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">ROI</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium" [class.text-green-600]="scenario.roiPercentage > 0">
                        {{ scenario.roiPercentage | number:'1.0-0' }}%
                      </td>
                    }
                  </tr>
                  <tr class="border-t">
                    <td class="p-4 text-muted-foreground">Payback</td>
                    @for (scenario of sortedScenarios(); track scenario.id) {
                      <td class="p-4 text-right font-medium">
                        @if (scenario.paybackPeriodMonths !== null) {
                          {{ scenario.paybackPeriodMonths }} mo
                        } @else {
                          Never
                        }
                      </td>
                    }
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Costs and Benefits Side by Side -->
          <div class="grid grid-cols-2 gap-6">
            <!-- Costs -->
            <div class="bg-background rounded-lg border">
              <div class="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 class="text-lg font-semibold">Cost Breakdown</h2>
                  <p class="text-sm text-muted-foreground mt-1">All estimated costs</p>
                </div>
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  (click)="toggleCostsExpanded()"
                >
                  <ng-icon [name]="costsExpanded() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                </button>
              </div>
              <div class="divide-y">
                @for (cost of detail()!.costs; track cost.id) {
                  <div class="p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-medium">{{ cost.itemName }}</p>
                          <span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {{ formatCostType(cost.costType) }}
                          </span>
                          @if (cost.isUserOverride) {
                            <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              User Override
                            </span>
                          }
                        </div>
                        @if (costsExpanded()) {
                          <p class="text-sm text-muted-foreground mt-1">{{ cost.itemDescription }}</p>
                        }
                      </div>
                      <p class="font-medium text-right">{{ formatCurrency(cost.realisticAmount) }}</p>
                    </div>
                    @if (costsExpanded()) {
                      <div class="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>Low: {{ formatCurrency(cost.optimisticAmount) }}</span>
                        <span>High: {{ formatCurrency(cost.pessimisticAmount) }}</span>
                        <span class="capitalize">Source: {{ cost.dataSource.replace('_', ' ') }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
              <div class="p-4 border-t bg-muted/30">
                <div class="flex justify-between font-semibold">
                  <span>Total One-Time Costs</span>
                  <span>{{ formatCurrency(totalOneTimeCosts()) }}</span>
                </div>
                <div class="flex justify-between font-semibold mt-2">
                  <span>Total Annual Recurring</span>
                  <span>{{ formatCurrency(totalRecurringCosts()) }}/year</span>
                </div>
              </div>
            </div>

            <!-- Benefits -->
            <div class="bg-background rounded-lg border">
              <div class="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 class="text-lg font-semibold">Benefit Projections</h2>
                  <p class="text-sm text-muted-foreground mt-1">Expected value creation</p>
                </div>
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  (click)="toggleBenefitsExpanded()"
                >
                  <ng-icon [name]="benefitsExpanded() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                </button>
              </div>
              <div class="divide-y">
                @for (benefit of detail()!.benefits; track benefit.id) {
                  <div class="p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-medium">{{ benefit.itemName }}</p>
                          <span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                            {{ benefit.benefitCategory.replace('_', ' ') }}
                          </span>
                          @if (benefit.isUserOverride) {
                            <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              User Override
                            </span>
                          }
                        </div>
                        @if (benefitsExpanded()) {
                          <p class="text-sm text-muted-foreground mt-1">{{ benefit.itemDescription }}</p>
                        }
                      </div>
                      <div class="text-right">
                        @if (benefit.realisticAmount !== null) {
                          <p class="font-medium text-green-600">{{ formatCurrency(benefit.realisticAmount) }}</p>
                          @if (benefit.recurrence) {
                            <p class="text-xs text-muted-foreground">per {{ benefit.recurrence === 'monthly' ? 'month' : 'year' }}</p>
                          }
                        } @else {
                          <p class="text-sm text-muted-foreground italic">Qualitative</p>
                        }
                      </div>
                    </div>
                    @if (benefitsExpanded() && benefit.timeToRealizeMonths > 0) {
                      <p class="text-xs text-muted-foreground mt-2">
                        Time to realize: {{ benefit.timeToRealizeMonths }} months
                      </p>
                    }
                  </div>
                }
              </div>
              <div class="p-4 border-t bg-muted/30">
                <div class="flex justify-between font-semibold text-green-600">
                  <span>Total Annual Benefits (Year 3)</span>
                  <span>{{ formatCurrency(baseScenario()?.totalAnnualBenefitsYear3 || 0) }}/year</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sensitivity Analysis -->
          @if (detail()!.sensitivity.length > 0) {
            <div class="bg-background rounded-lg border">
              <div class="p-4 border-b">
                <h2 class="text-lg font-semibold">Sensitivity Analysis</h2>
                <p class="text-sm text-muted-foreground mt-1">How changes in key variables affect NPV</p>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="bg-muted/50">
                      <th class="text-left p-4 font-medium">Variable</th>
                      <th class="text-left p-4 font-medium">Type</th>
                      <th class="text-right p-4 font-medium">Base Value</th>
                      <th class="text-right p-4 font-medium">NPV at -20%</th>
                      <th class="text-right p-4 font-medium">NPV at +20%</th>
                      <th class="text-center p-4 font-medium">Critical?</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of detail()!.sensitivity; track item.id) {
                      <tr class="border-t" [class.bg-red-50]="item.isCritical">
                        <td class="p-4 font-medium">{{ item.variableName }}</td>
                        <td class="p-4 capitalize text-muted-foreground">{{ item.variableType }}</td>
                        <td class="p-4 text-right">{{ formatCurrency(item.baseValue) }}</td>
                        <td class="p-4 text-right" [class.text-green-600]="item.npvAtLow > 0" [class.text-red-600]="item.npvAtLow <= 0">
                          {{ formatCurrency(item.npvAtLow) }}
                        </td>
                        <td class="p-4 text-right" [class.text-green-600]="item.npvAtHigh > 0" [class.text-red-600]="item.npvAtHigh <= 0">
                          {{ formatCurrency(item.npvAtHigh) }}
                        </td>
                        <td class="p-4 text-center">
                          @if (item.isCritical) {
                            <ng-icon name="lucideAlertTriangle" class="h-5 w-5 text-amber-500 inline" />
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- Key Assumptions -->
          @if (detail()!.assumptions.length > 0) {
            <div class="bg-background rounded-lg border">
              <div class="p-4 border-b">
                <h2 class="text-lg font-semibold">Key Assumptions</h2>
                <p class="text-sm text-muted-foreground mt-1">Critical assumptions underlying this analysis</p>
              </div>
              <div class="divide-y">
                @for (assumption of detail()!.assumptions; track assumption.id) {
                  <div class="p-4 flex items-start gap-3">
                    <ng-icon
                      name="lucideInfo"
                      class="h-5 w-5 flex-shrink-0 mt-0.5"
                      [class.text-red-500]="assumption.impactIfWrong === 'high'"
                      [class.text-yellow-500]="assumption.impactIfWrong === 'medium'"
                      [class.text-muted-foreground]="assumption.impactIfWrong === 'low'"
                    />
                    <div class="flex-1">
                      <p class="text-sm">{{ assumption.assumptionText }}</p>
                      <div class="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <span class="capitalize">Category: {{ assumption.assumptionCategory }}</span>
                        <span>Impact if wrong: <span class="capitalize" [class.text-red-600]="assumption.impactIfWrong === 'high'">{{ assumption.impactIfWrong }}</span></span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Cash Flow Chart (placeholder for now) -->
          @if (baseScenario()?.yearlyCashFlows) {
            <div class="bg-background rounded-lg border">
              <div class="p-4 border-b">
                <h2 class="text-lg font-semibold">5-Year Cash Flow Projection (Base Scenario)</h2>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="bg-muted/50">
                      <th class="text-left p-4 font-medium">Year</th>
                      <th class="text-right p-4 font-medium">Benefits</th>
                      <th class="text-right p-4 font-medium">Costs</th>
                      <th class="text-right p-4 font-medium">Net Cash Flow</th>
                      <th class="text-right p-4 font-medium">Cumulative NPV</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (cf of baseScenario()!.yearlyCashFlows; track cf.year) {
                      <tr class="border-t">
                        <td class="p-4 font-medium">Year {{ cf.year }}</td>
                        <td class="p-4 text-right text-green-600">{{ formatCurrency(cf.benefits) }}</td>
                        <td class="p-4 text-right text-red-600">{{ formatCurrency(cf.costs) }}</td>
                        <td class="p-4 text-right font-medium" [class.text-green-600]="cf.netCashFlow > 0" [class.text-red-600]="cf.netCashFlow <= 0">
                          {{ formatCurrency(cf.netCashFlow) }}
                        </td>
                        <td class="p-4 text-right font-medium" [class.text-green-600]="cf.cumulativeNpv > 0" [class.text-red-600]="cf.cumulativeNpv <= 0">
                          {{ formatCurrency(cf.cumulativeNpv) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100%;
    }
  `,
})
export class BusinessCaseResultsComponent implements OnInit {
  service = inject(BusinessCaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  detail = signal<SessionDetail | null>(null);
  costsExpanded = signal(false);
  benefitsExpanded = signal(false);
  ratesExpanded = signal(false);
  editingRateId = signal<number | null>(null);
  editingRateValue = signal<string>('');

  // Computed
  sortedScenarios = computed(() => {
    const scenarios = this.detail()?.scenarios || [];
    const order = ['conservative', 'base', 'optimistic'];
    return [...scenarios].sort((a, b) =>
      order.indexOf(a.scenarioType) - order.indexOf(b.scenarioType)
    );
  });

  baseScenario = computed(() => {
    return this.detail()?.scenarios.find(s => s.scenarioType === 'base') || null;
  });

  totalOneTimeCosts = computed(() => {
    return this.detail()?.costs
      .filter(c => c.costType === 'one_time')
      .reduce((sum, c) => sum + c.realisticAmount, 0) || 0;
  });

  totalRecurringCosts = computed(() => {
    const costs = this.detail()?.costs || [];
    const monthly = costs.filter(c => c.costType === 'recurring_monthly')
      .reduce((sum, c) => sum + c.realisticAmount, 0) * 12;
    const annual = costs.filter(c => c.costType === 'recurring_annual')
      .reduce((sum, c) => sum + c.realisticAmount, 0);
    return monthly + annual;
  });

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (!sessionId) {
      this.router.navigate(['/business-case']);
      return;
    }

    const detail = await this.service.getSessionDetail(sessionId);
    this.detail.set(detail);
  }

  goBack() {
    this.router.navigate(['/business-case']);
  }

  toggleCostsExpanded() {
    this.costsExpanded.update(v => !v);
  }

  toggleBenefitsExpanded() {
    this.benefitsExpanded.update(v => !v);
  }

  toggleRatesExpanded() {
    this.ratesExpanded.update(v => !v);
  }

  startEditingRate(rate: RateAssumption) {
    this.editingRateId.set(rate.id);
    this.editingRateValue.set(rate.rateValue.toString());
  }

  cancelEditingRate() {
    this.editingRateId.set(null);
    this.editingRateValue.set('');
  }

  async saveRate(rate: RateAssumption) {
    const newValue = parseFloat(this.editingRateValue());
    if (isNaN(newValue) || newValue <= 0) {
      return;
    }

    await this.service.updateRate(rate.id, { rateValue: newValue });
    this.editingRateId.set(null);
    this.editingRateValue.set('');

    // Refresh detail
    const sessionId = this.detail()?.session.id;
    if (sessionId) {
      const detail = await this.service.getSessionDetail(sessionId);
      this.detail.set(detail);
    }
  }

  async recalculateWithNewRates() {
    const sessionId = this.detail()?.session.id;
    if (!sessionId) return;

    await this.service.recalculateFinancials(sessionId);

    // Poll for completion and refresh
    const poll = async () => {
      const status = await this.service.pollSessionStatus(sessionId);
      if (status?.status === 'completed') {
        const detail = await this.service.getSessionDetail(sessionId);
        this.detail.set(detail);
      } else if (status?.status === 'analyzing') {
        setTimeout(poll, 1000);
      }
    };
    setTimeout(poll, 1000);
  }

  formatRecommendation(recommendation: string): string {
    const labels: Record<string, string> = {
      invest: 'Recommend Investment',
      conditional: 'Conditional Approval',
      defer: 'Defer Investment',
      reject: 'Not Recommended',
    };
    return labels[recommendation] || recommendation;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatCostType(type: string): string {
    const labels: Record<string, string> = {
      one_time: 'One-Time',
      recurring_monthly: 'Monthly',
      recurring_annual: 'Annual',
    };
    return labels[type] || type;
  }
}
