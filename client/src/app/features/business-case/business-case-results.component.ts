import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  lucideFileText,
} from '@ng-icons/lucide';
import { BusinessCaseService } from './business-case.service';
import type { SessionDetail, FinancialScenario, CostItem, BenefitItem, SensitivityAnalysis, RateAssumption } from './business-case.types';
import { HlmButtonDirective } from '../../ui/button';

@Component({
  selector: 'app-business-case-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, DecimalPipe, TitleCasePipe, FormsModule],
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
      lucideFileText,
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
                <!-- Export PDF Button -->
                <button
                  hlmBtn
                  variant="outline"
                  (click)="exportToPdf()"
                >
                  <ng-icon name="lucideFileText" class="mr-2 h-4 w-4" />
                  Export PDF
                </button>
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

          <!-- Rate Assumptions -->
          @if (detail()!.rates && detail()!.rates.length > 0) {
            <div class="bg-background rounded-lg border">
              <div class="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 class="text-lg font-semibold">Calculation Assumptions</h2>
                  <p class="text-sm text-muted-foreground mt-1">Rates and assumptions used in cost calculations</p>
                </div>
                <div class="flex items-center gap-2">
                  @if (hasUserOverrides()) {
                    <button
                      hlmBtn
                      variant="default"
                      size="sm"
                      (click)="recalculateWithNewRates()"
                      [disabled]="service.loading()"
                    >
                      @if (service.loading()) {
                        <ng-icon name="lucideLoader2" class="h-4 w-4 mr-2 animate-spin" />
                      } @else {
                        <ng-icon name="lucideRefreshCw" class="h-4 w-4 mr-2" />
                      }
                      Recalculate
                    </button>
                  }
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    (click)="toggleRatesExpanded()"
                  >
                    <ng-icon [name]="ratesExpanded() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
                  </button>
                </div>
              </div>
              @if (ratesExpanded()) {
                <div class="divide-y">
                  @for (rate of detail()!.rates; track rate.id) {
                    <div class="p-4 flex items-center justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-medium">{{ rate.rateName }}</p>
                          <span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {{ formatRateType(rate.rateType) }}
                          </span>
                          @if (rate.isUserOverride) {
                            <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              Custom
                            </span>
                          }
                        </div>
                        <p class="text-sm text-muted-foreground mt-1">{{ rate.rateDescription }}</p>
                      </div>
                      <div class="flex items-center gap-3">
                        @if (editingRateId() === rate.id) {
                          <input
                            type="number"
                            class="w-24 px-2 py-1 border rounded text-right text-sm"
                            [ngModel]="editingRateValue()"
                            (ngModelChange)="editingRateValue.set($event)"
                            (keydown.enter)="saveRate(rate)"
                            (keydown.escape)="cancelEditingRate()"
                            step="any"
                          />
                          <button
                            class="text-xs text-primary hover:underline"
                            (click)="saveRate(rate)"
                          >
                            Save
                          </button>
                          <button
                            class="text-xs text-muted-foreground hover:underline"
                            (click)="cancelEditingRate()"
                          >
                            Cancel
                          </button>
                        } @else {
                          <p class="font-medium text-right min-w-[80px]">{{ formatRateValue(rate) }}</p>
                          <button
                            class="p-1 hover:bg-muted rounded"
                            (click)="startEditingRate(rate)"
                            title="Edit rate"
                          >
                            <ng-icon name="lucideEdit" class="h-4 w-4 text-muted-foreground" />
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
                <div class="p-4 bg-muted/30 border-t">
                  <p class="text-xs text-muted-foreground">
                    <ng-icon name="lucideInfo" class="inline h-3 w-3 mr-1" />
                    Edit rates above and click "Recalculate" to update financial projections with your custom values.
                    These rates are based on {{ detail()!.rates[0]?.companySize || 'medium' }}-sized company benchmarks.
                  </p>
                </div>
              }
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

  formatRateValue(rate: RateAssumption): string {
    if (rate.rateUnit === 'per_hour') {
      return this.formatCurrency(rate.rateValue) + '/hr';
    } else if (rate.rateUnit === 'percentage') {
      return (rate.rateValue * 100).toFixed(1) + '%';
    } else if (rate.rateUnit === 'multiplier') {
      return rate.rateValue.toFixed(2) + 'x';
    }
    return rate.rateValue.toString();
  }

  formatRateType(rateType: string): string {
    const labels: Record<string, string> = {
      hourly_rate: 'Hourly Rate',
      discount_rate: 'Discount Rate',
      benefit_growth_rate: 'Growth Rate',
      overhead_multiplier: 'Overhead',
    };
    return labels[rateType] || rateType;
  }

  hasUserOverrides(): boolean {
    return this.detail()?.rates?.some(r => r.isUserOverride) ?? false;
  }

  exportToPdf() {
    const detail = this.detail();
    if (!detail) return;

    const session = detail.session;
    const scenarios = this.sortedScenarios();
    const costs = detail.costs;
    const benefits = detail.benefits;
    const sensitivity = detail.sensitivity;
    const assumptions = detail.assumptions;
    const rates = detail.rates;
    const baseScenario = this.baseScenario();

    const recommendationClass = session.recommendation === 'invest' ? 'invest' :
      session.recommendation === 'conditional' ? 'conditional' : 'defer';
    const recommendationLabel = this.formatRecommendation(session.recommendation || '');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Business Case Analysis - ${session.featureName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a2e; padding: 48px; max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #006450; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { font-size: 14px; color: #64748b; }
    .badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 16px 0; }
    .badge.invest { background: #dcfce7; color: #166534; }
    .badge.conditional { background: #fef3c7; color: #b45309; }
    .badge.defer { background: #fee2e2; color: #b91c1c; }
    .confidence { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-left: 8px; }
    .confidence.high { background: #dcfce7; color: #166534; }
    .confidence.medium { background: #fef3c7; color: #b45309; }
    .confidence.low { background: #fee2e2; color: #b91c1c; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; color: #006450; }
    .summary-box { background: #f0f9ff; padding: 20px; border-radius: 12px; border-left: 4px solid #006450; margin-bottom: 24px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .metric-value { font-size: 20px; font-weight: 700; color: #006450; }
    .metric-value.positive { color: #166534; }
    .metric-value.negative { color: #b91c1c; }
    .metric-label { font-size: 11px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { background: #f8fafc; font-weight: 600; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .tag-green { background: #dcfce7; color: #166534; }
    .tag-yellow { background: #fef3c7; color: #b45309; }
    .tag-red { background: #fee2e2; color: #b91c1c; }
    .tag-gray { background: #f1f5f9; color: #475569; }
    .tag-blue { background: #dbeafe; color: #1e40af; }
    .positive { color: #166534; }
    .negative { color: #b91c1c; }
    .scenario-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .scenario { padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .scenario.conservative { background: #fef3c7; border-color: #fbbf24; }
    .scenario.base { background: #dbeafe; border-color: #60a5fa; }
    .scenario.optimistic { background: #dcfce7; border-color: #4ade80; }
    .scenario h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; text-transform: capitalize; }
    .scenario-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .cost-benefit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .cost-benefit-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .cost-benefit-header { background: #f8fafc; padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    .cost-benefit-item { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
    .cost-benefit-item:last-child { border-bottom: none; }
    .cost-benefit-footer { background: #f8fafc; padding: 12px 16px; font-weight: 600; border-top: 1px solid #e2e8f0; }
    .item-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .item-name { font-weight: 500; }
    .item-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
    .item-amount { font-weight: 500; text-align: right; }
    .sensitivity-row { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
    .sensitivity-row.critical { background: #fef2f2; }
    .assumption-item { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; }
    .assumption-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10px; }
    .assumption-icon.high { background: #fee2e2; color: #b91c1c; }
    .assumption-icon.medium { background: #fef3c7; color: #b45309; }
    .assumption-icon.low { background: #f1f5f9; color: #64748b; }
    .rate-item { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .cash-flow-table td, .cash-flow-table th { padding: 10px 12px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 24px; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.featureName}</h1>
    <div class="subtitle">Business Case Analysis</div>
    <div>
      <span class="badge ${recommendationClass}">${recommendationLabel}</span>
      <span class="confidence ${session.confidenceLevel}">${this.capitalizeFirst(session.confidenceLevel || '')} Confidence</span>
    </div>
  </div>

  <!-- Executive Summary -->
  ${session.executiveSummary ? `
  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="summary-box">
      <p>${session.executiveSummary}</p>
    </div>
  </div>
  ` : ''}

  <!-- Key Financial Metrics -->
  <div class="section">
    <h2 class="section-title">Key Financial Metrics</h2>
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${this.formatCurrency(session.totalInvestment || 0)}</div>
        <div class="metric-label">Total Investment (Year 1)</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(session.netPresentValue || 0) > 0 ? 'positive' : 'negative'}">${this.formatCurrency(session.netPresentValue || 0)}</div>
        <div class="metric-label">Net Present Value (5-Year)</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(session.internalRateOfReturn || 0) > 15 ? 'positive' : ''}">${session.internalRateOfReturn !== null ? session.internalRateOfReturn?.toFixed(1) + '%' : 'N/A'}</div>
        <div class="metric-label">Internal Rate of Return</div>
      </div>
      <div class="metric">
        <div class="metric-value">${session.paybackMonths !== null ? session.paybackMonths + ' months' : 'N/A'}</div>
        <div class="metric-label">Payback Period</div>
      </div>
    </div>
  </div>

  <!-- Scenario Analysis -->
  ${scenarios.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Scenario Analysis</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          ${scenarios.map(s => `<th class="text-right">${this.capitalizeFirst(s.scenarioType)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Year 1 Investment</td>
          ${scenarios.map(s => `<td class="text-right">${this.formatCurrency(s.totalInvestmentYear1)}</td>`).join('')}
        </tr>
        <tr>
          <td>5-Year Investment</td>
          ${scenarios.map(s => `<td class="text-right">${this.formatCurrency(s.totalInvestment5Year)}</td>`).join('')}
        </tr>
        <tr>
          <td>Year 1 Benefits</td>
          ${scenarios.map(s => `<td class="text-right positive">${this.formatCurrency(s.totalAnnualBenefitsYear1)}</td>`).join('')}
        </tr>
        <tr>
          <td>5-Year Benefits</td>
          ${scenarios.map(s => `<td class="text-right positive">${this.formatCurrency(s.totalBenefits5Year)}</td>`).join('')}
        </tr>
        <tr style="font-weight:600;background:#f8fafc;">
          <td>Net Present Value</td>
          ${scenarios.map(s => `<td class="text-right ${s.netPresentValue > 0 ? 'positive' : 'negative'}">${this.formatCurrency(s.netPresentValue)}</td>`).join('')}
        </tr>
        <tr>
          <td>IRR</td>
          ${scenarios.map(s => `<td class="text-right">${s.internalRateOfReturn !== null ? s.internalRateOfReturn.toFixed(1) + '%' : 'N/A'}</td>`).join('')}
        </tr>
        <tr>
          <td>ROI</td>
          ${scenarios.map(s => `<td class="text-right ${s.roiPercentage > 0 ? 'positive' : ''}">${s.roiPercentage.toFixed(0)}%</td>`).join('')}
        </tr>
        <tr>
          <td>Payback Period</td>
          ${scenarios.map(s => `<td class="text-right">${s.paybackPeriodMonths !== null ? s.paybackPeriodMonths + ' mo' : 'Never'}</td>`).join('')}
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Costs and Benefits -->
  <div class="section">
    <h2 class="section-title">Costs & Benefits Breakdown</h2>
    <div class="cost-benefit-grid">
      <!-- Costs -->
      <div class="cost-benefit-card">
        <div class="cost-benefit-header">Cost Breakdown</div>
        ${costs.map(cost => `
        <div class="cost-benefit-item">
          <div class="item-row">
            <div>
              <div class="item-name">${cost.itemName}</div>
              <div class="item-desc">
                <span class="tag tag-gray">${this.formatCostType(cost.costType)}</span>
                ${cost.isUserOverride ? '<span class="tag tag-blue" style="margin-left:4px;">User Override</span>' : ''}
              </div>
            </div>
            <div class="item-amount">${this.formatCurrency(cost.realisticAmount)}</div>
          </div>
        </div>
        `).join('')}
        <div class="cost-benefit-footer">
          <div class="item-row">
            <span>Total One-Time</span>
            <span>${this.formatCurrency(this.totalOneTimeCosts())}</span>
          </div>
          <div class="item-row" style="margin-top:8px;">
            <span>Total Annual</span>
            <span>${this.formatCurrency(this.totalRecurringCosts())}/year</span>
          </div>
        </div>
      </div>

      <!-- Benefits -->
      <div class="cost-benefit-card">
        <div class="cost-benefit-header">Benefit Projections</div>
        ${benefits.map(benefit => `
        <div class="cost-benefit-item">
          <div class="item-row">
            <div>
              <div class="item-name">${benefit.itemName}</div>
              <div class="item-desc">
                <span class="tag tag-gray">${benefit.benefitCategory.replace('_', ' ')}</span>
                ${benefit.isUserOverride ? '<span class="tag tag-blue" style="margin-left:4px;">User Override</span>' : ''}
              </div>
            </div>
            <div class="item-amount positive">
              ${benefit.realisticAmount !== null ? this.formatCurrency(benefit.realisticAmount) : '<em style="color:#64748b;">Qualitative</em>'}
              ${benefit.realisticAmount !== null && benefit.recurrence ? `<div style="font-size:10px;color:#64748b;">per ${benefit.recurrence === 'monthly' ? 'month' : 'year'}</div>` : ''}
            </div>
          </div>
        </div>
        `).join('')}
        <div class="cost-benefit-footer positive">
          <div class="item-row">
            <span>Total Annual Benefits (Year 3)</span>
            <span>${this.formatCurrency(baseScenario?.totalAnnualBenefitsYear3 || 0)}/year</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sensitivity Analysis -->
  ${sensitivity.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Sensitivity Analysis</h2>
    <table>
      <thead>
        <tr>
          <th>Variable</th>
          <th>Type</th>
          <th class="text-right">Base Value</th>
          <th class="text-right">NPV at -20%</th>
          <th class="text-right">NPV at +20%</th>
          <th class="text-center">Critical?</th>
        </tr>
      </thead>
      <tbody>
        ${sensitivity.map(item => `
        <tr ${item.isCritical ? 'style="background:#fef2f2;"' : ''}>
          <td><strong>${item.variableName}</strong></td>
          <td style="text-transform:capitalize;">${item.variableType}</td>
          <td class="text-right">${this.formatCurrency(item.baseValue)}</td>
          <td class="text-right ${item.npvAtLow > 0 ? 'positive' : 'negative'}">${this.formatCurrency(item.npvAtLow)}</td>
          <td class="text-right ${item.npvAtHigh > 0 ? 'positive' : 'negative'}">${this.formatCurrency(item.npvAtHigh)}</td>
          <td class="text-center">${item.isCritical ? '<span class="tag tag-yellow">Critical</span>' : ''}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Key Assumptions -->
  ${assumptions.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Key Assumptions</h2>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      ${assumptions.map(assumption => `
      <div class="assumption-item">
        <div class="assumption-icon ${assumption.impactIfWrong}">!</div>
        <div style="flex:1;">
          <p style="font-size:13px;">${assumption.assumptionText}</p>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">
            <span style="text-transform:capitalize;">Category: ${assumption.assumptionCategory}</span>
            <span style="margin-left:12px;">Impact if wrong: <span class="${assumption.impactIfWrong === 'high' ? 'negative' : ''}" style="text-transform:capitalize;">${assumption.impactIfWrong}</span></span>
          </div>
        </div>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Rate Assumptions -->
  ${rates && rates.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Calculation Assumptions</h2>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      ${rates.map(rate => `
      <div class="rate-item">
        <div>
          <div style="font-weight:500;">${rate.rateName}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">
            <span class="tag tag-gray">${this.formatRateType(rate.rateType)}</span>
            ${rate.isUserOverride ? '<span class="tag tag-blue" style="margin-left:4px;">Custom</span>' : ''}
          </div>
        </div>
        <div style="font-weight:600;">${this.formatRateValue(rate)}</div>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- 5-Year Cash Flow -->
  ${baseScenario?.yearlyCashFlows ? `
  <div class="section">
    <h2 class="section-title">5-Year Cash Flow Projection (Base Scenario)</h2>
    <table class="cash-flow-table">
      <thead>
        <tr>
          <th>Year</th>
          <th class="text-right">Benefits</th>
          <th class="text-right">Costs</th>
          <th class="text-right">Net Cash Flow</th>
          <th class="text-right">Cumulative NPV</th>
        </tr>
      </thead>
      <tbody>
        ${baseScenario.yearlyCashFlows.map(cf => `
        <tr>
          <td><strong>Year ${cf.year}</strong></td>
          <td class="text-right positive">${this.formatCurrency(cf.benefits)}</td>
          <td class="text-right negative">${this.formatCurrency(cf.costs)}</td>
          <td class="text-right ${cf.netCashFlow > 0 ? 'positive' : 'negative'}" style="font-weight:500;">${this.formatCurrency(cf.netCashFlow)}</td>
          <td class="text-right ${cf.cumulativeNpv > 0 ? 'positive' : 'negative'}" style="font-weight:500;">${this.formatCurrency(cf.cumulativeNpv)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    Generated by Product Studio &bull; ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
