# Complete PM Workflow - Visual Guide

## 🔄 End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     GOAL SETTING ASSISTANT                              │
│                         (index.html)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📘 Summary of Inputs                                                   │
│  • Domain: Onboarding + Authentication                                  │
│  • Customer Problems: Login failures, high drop-off                     │
│  • Company Strategy: Improve activation                                 │
│                                                                         │
│  🎯 SMART Goals (4)                                                     │
│  1. Increase login success rate 87% → 95%                              │
│  2. Reduce support tickets by 30%                                       │
│  3. Increase activation rate 42% → 55%                                 │
│  4. Increase retention 61% → 72%                                        │
│                                                                         │
│  💡 Features:                                                           │
│  • Edit/delete/reorder goals                                            │
│  • "Why was this generated?" transparency                               │
│  • Priority recommendations                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↓
                    [Continue to OKR Generator]
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        OKR GENERATOR                                    │
│                    (okr-generator.html)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🎯 Objective 1: Deliver frictionless login experience                 │
│     ✔ KR 1: Login success 87% → 95%                                    │
│     ✔ KR 2: Reduce reset errors by 40%                                 │
│     ✔ KR 3: Login time 22s → 12s                                       │
│                                                                         │
│  🎯 Objective 2: Reduce support dependency                             │
│     ✔ KR 1: Reduce tickets by 30%                                      │
│     ✔ KR 2: Self-service 18% → 40%                                     │
│                                                                         │
│  💡 Features:                                                           │
│  • Edit objectives and KRs                                              │
│  • Assign owners and baselines                                          │
│  • Add/delete objectives                                                │
│  • Breadcrumb navigation                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↓
                     [Continue to KPI Assignment]
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       KPI ASSIGNMENT PANEL                              │
│                     (kpi-assignment.html)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📌 KR: Increase login success rate 87% → 95%                          │
│     Suggested KPIs:                                                     │
│     ☑ Login Success Rate [Primary]                                     │
│     ☑ Login Attempts vs Successful Logins [Supporting]                 │
│     ☑ Retry Attempts per User [Supporting]                             │
│     ☐ Session Duration at Login Screen [Optional]                      │
│                                                                         │
│  📌 KR: Reduce password-reset error rate by 40%                        │
│     ☑ Password Reset Error Rate [Primary]                              │
│     ☑ Failed Reset Attempts per Session [Supporting]                   │
│     ☑ Password Reset Completion Time [Supporting]                      │
│                                                                         │
│  📊 Summary Stats:                                                      │
│     4 Key Results | 13 KPIs Assigned | 4 Primary | 9 Supporting        │
│                                                                         │
│  💡 Features:                                                           │
│  • Toggle KPIs on/off                                                   │
│  • Add custom KPIs                                                      │
│  • Configure thresholds                                                 │
│  • Real-time stats tracking                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↓
                   [Confirm KPIs → Benchmark Comparison]
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    BENCHMARK COMPARISON                                 │
│                  (benchmark-comparison.html)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🔐 Benchmark: Authentication / Login Success                           │
│                                                                         │
│     KR: Increase login success rate 87% → 95%                          │
│                                                                         │
│     Your Metrics:                  Industry Benchmarks:                │
│     • Baseline: 87%               • Industry Avg: 92–95%              │
│     • Target: 95%                 • Top Quartile: 97–99%              │
│                                   • Peer Products: 94–96%              │
│                                                                         │
│     📊 Visual Chart:                                                    │
│     ████████████████████ Baseline (87%)                                │
│     ███████████████████████████ Commit (95%)                           │
│     █████████████████████████████ Stretch (97%)                        │
│     ██████████████████████████████ Benchmark Range (92-99%)            │
│                                                                         │
│     💡 Recommendation:                                                  │
│     • Keep Commit at 95%                                                │
│     • Add Stretch target at 97%                                         │
│                                                                         │
│     [Apply Suggested Stretch] [Customize] [Skip]                       │
│                                                                         │
│  🚀 Benchmark: Activation / Onboarding                                  │
│     Similar layout for activation KR...                                 │
│                                                                         │
│  📉 Benchmark: Support Ticket Volume                                    │
│     Similar layout for support KR...                                    │
│                                                                         │
│  📊 Summary Panel:                                                      │
│     ✓ 2 KRs above industry average                                     │
│     ⚠ 1 KR below top quartile                                          │
│     ℹ 4 Stretch targets recommended                                     │
│                                                                         │
│  💡 Features:                                                           │
│  • Industry benchmark comparisons                                       │
│  • Visual bar charts with animations                                    │
│  • Apply/customize/skip options                                         │
│  • Stretch target recommendations                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↓
                  [Continue to Measurement Framework]
                                  ↓
                        🎉 Complete Setup!
```

## 📋 Key Features Across All Pages

### Navigation
- **Breadcrumb Navigation**: Available on pages 2-4 to jump between steps
- **Linear Flow**: Each page has a "Continue to..." button
- **Back Navigation**: Use breadcrumbs or browser back

### Data Flow
```
Goals → Objectives/KRs → KPIs → Benchmarked Targets → Measurement Framework
```

### Editing Capabilities
- **Page 1**: Edit goals, add/delete, reorder, see AI reasoning
- **Page 2**: Edit objectives and KRs, assign owners, set baselines
- **Page 3**: Toggle KPIs, add custom KPIs, configure settings
- **Page 4**: Apply stretch targets, customize benchmarks

### AI Intelligence
- **Goal Setting**: AI generates SMART goals from inputs + explains reasoning
- **OKR Generation**: AI converts goals into structured OKRs
- **KPI Assignment**: AI matches relevant KPIs to each KR
- **Benchmarking**: AI compares targets against industry data

## 🎨 Design Consistency

All pages share:
- **Color Scheme**: Indigo/violet primary, soft blue-gray background
- **Typography**: Inter font family
- **Icons**: Phosphor icon set
- **Components**: Consistent cards, buttons, modals
- **Responsive**: Mobile-friendly layouts

## 🚀 Try It Out

1. Start at `index.html` (Goal Setting Assistant)
2. Click "Continue to OKR Generator"
3. Click "Continue to KPI Assignment"
4. Click "Confirm KPIs → Benchmark Comparison"
5. Explore the complete workflow!

All interactions are functional - try editing, deleting, and navigating!
