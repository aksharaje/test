// Goal Setting Assistant - Interactive Functionality

// Modal Management
const editModal = document.querySelector('.modal-overlay');
const closeBtn = document.querySelector('.close-btn');
let currentEditingGoal = null;

// Open Edit Panel
function openEditPanel(goalId) {
    editModal.style.display = 'flex';
    currentEditingGoal = goalId;
    // In a real app, populate form with goal data
}

// Close Edit Panel
function closeEditPanel() {
    editModal.style.display = 'none';
    currentEditingGoal = null;
}

// Close modal when clicking outside
editModal?.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeEditPanel();
    }
});

closeBtn?.addEventListener('click', closeEditPanel);

// Save Changes
document.querySelector('.modal-actions .btn-primary')?.addEventListener('click', () => {
    // In a real app, save the edited goal data
    alert('Goal changes saved successfully!');
    closeEditPanel();
});

// Cancel button
document.querySelector('.modal-actions .btn-secondary')?.addEventListener('click', closeEditPanel);

// Edit Goal buttons
document.querySelectorAll('.goal-card .icon-btn:first-child').forEach((btn, index) => {
    btn.addEventListener('click', () => {
        openEditPanel(`goal-${index + 1}`);
    });
});

// Delete Goal
document.querySelectorAll('.goal-card .icon-btn:nth-child(2)').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this goal?')) {
            e.target.closest('.goal-card').remove();
        }
    });
});

// Move Goal Up
document.querySelectorAll('.move-btns .icon-btn:first-child').forEach((btn) => {
    btn.addEventListener('click', () => {
        const goalCard = btn.closest('.goal-card');
        const prevGoal = goalCard.previousElementSibling;
        if (prevGoal && prevGoal.classList.contains('goal-card')) {
            goalCard.parentNode.insertBefore(goalCard, prevGoal);
        }
    });
});

// Move Goal Down
document.querySelectorAll('.move-btns .icon-btn:last-child').forEach((btn) => {
    btn.addEventListener('click', () => {
        const goalCard = btn.closest('.goal-card');
        const nextGoal = goalCard.nextElementSibling;
        if (nextGoal && nextGoal.classList.contains('goal-card')) {
            goalCard.parentNode.insertBefore(nextGoal, goalCard);
        }
    });
});

// Add New Goal
document.querySelector('.btn-dashed')?.addEventListener('click', () => {
    alert('Add new goal functionality would open a form here');
});

// Edit Inputs
document.querySelector('.summary-card .btn-outline-sm')?.addEventListener('click', () => {
    alert('Edit inputs functionality would open a form to modify the summary inputs');
});

// Override Priorities
document.querySelector('.priority-card .btn-outline-sm')?.addEventListener('click', () => {
    alert('Override priorities functionality would allow manual reordering');
});

// Continue to OKR Generator
document.getElementById('continue-to-okr')?.addEventListener('click', () => {
    window.location.href = 'okr-generator.html';
});

// Tag removal in edit modal
document.querySelectorAll('.removable').forEach((tag) => {
    tag.addEventListener('click', () => {
        tag.remove();
    });
});

// Add tag button
document.querySelector('.add-tag-btn')?.addEventListener('click', () => {
    const tagsInput = document.querySelector('.tags-input');
    const availableTags = ['Growth', 'Revenue', 'Performance', 'Security', 'Cost'];
    const randomTag = availableTags[Math.floor(Math.random() * availableTags.length)];

    const newTag = document.createElement('span');
    newTag.className = 'tag tag-blue removable';
    newTag.innerHTML = `${randomTag} <i class="ph ph-x"></i>`;
    newTag.addEventListener('click', () => newTag.remove());

    tagsInput.insertBefore(newTag, document.querySelector('.add-tag-btn'));
});

// Checkbox pills interaction
document.querySelectorAll('.checkbox-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
        const checkbox = pill.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        pill.classList.toggle('checked');
    });
});

// View Impact link
document.querySelector('.warning-content a')?.addEventListener('click', (e) => {
    e.preventDefault();
    showImpactModal();
});

// Impact Modal
function showImpactModal() {
    const impactModal = document.createElement('div');
    impactModal.className = 'modal-overlay';
    impactModal.style.display = 'flex';
    impactModal.innerHTML = `
        <div class="modal" style="width: 500px;">
            <div class="modal-header">
                <h2>Impact Analysis</h2>
                <button class="close-btn impact-close"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <div class="impact-section">
                    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <i class="ph ph-target"></i> Downstream Systems Affected
                    </h3>
                    <div class="impact-list">
                        <div class="impact-item">
                            <strong>OKR Generation</strong>
                            <p style="font-size: 13px; color: var(--text-secondary);">Key Results will be recalculated based on updated goal metrics</p>
                        </div>
                        <div class="impact-item" style="margin-top: 16px;">
                            <strong>KPI Selection</strong>
                            <p style="font-size: 13px; color: var(--text-secondary);">Measurement framework will adjust to track new targets</p>
                        </div>
                        <div class="impact-item" style="margin-top: 16px;">
                            <strong>Measurement Targeting</strong>
                            <p style="font-size: 13px; color: var(--text-secondary);">Analytics dashboards will be updated with new success criteria</p>
                        </div>
                        <div class="impact-item" style="margin-top: 16px;">
                            <strong>Dashboard Definitions</strong>
                            <p style="font-size: 13px; color: var(--text-secondary);">Reporting views will reflect updated goal structure</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="modal-actions">
                    <button class="btn btn-primary impact-close">Understood</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(impactModal);

    // Close handlers
    impactModal.querySelector('.impact-close').addEventListener('click', () => {
        impactModal.remove();
    });
    impactModal.querySelectorAll('.impact-close').forEach(btn => {
        btn.addEventListener('click', () => impactModal.remove());
    });
    impactModal.addEventListener('click', (e) => {
        if (e.target === impactModal) {
            impactModal.remove();
        }
    });
}

// "Why was this generated?" functionality
const whyData = {
    '1': {
        title: 'Goal 1: Increase Login Success Rate',
        signals: [
            '<strong>Customer Problem:</strong> "Login failures" mentioned in problem statement',
            '<strong>Company Strategy:</strong> Aligned with "improve activation"',
            '<strong>Domain Context:</strong> Authentication is core to onboarding experience'
        ],
        alignment: [
            'Maps to Growth pillar (activation metric)',
            'Addresses reliability concerns',
            'High impact on user experience'
        ],
        smart: [
            '<strong>Specific:</strong> Login success rate improvement',
            '<strong>Measurable:</strong> 87% → 95%',
            '<strong>Achievable:</strong> 8 percentage point improvement',
            '<strong>Relevant:</strong> Directly impacts customer problem',
            '<strong>Time-bound:</strong> End of Q2'
        ]
    },
    '2': {
        title: 'Goal 2: Reduce Support Tickets',
        signals: [
            '<strong>Customer Problem:</strong> "Support tickets" explicitly mentioned',
            '<strong>Company Strategy:</strong> "Reduce operational load" alignment',
            '<strong>Cost Impact:</strong> Support tickets have direct cost implications'
        ],
        alignment: [
            'Maps to Efficiency pillar',
            'Reduces operational burden on support team',
            'Improves customer satisfaction through self-service'
        ],
        smart: [
            '<strong>Specific:</strong> Login/access support ticket reduction',
            '<strong>Measurable:</strong> 30% reduction',
            '<strong>Achievable:</strong> Based on typical support ticket optimization patterns',
            '<strong>Relevant:</strong> Addresses operational load concern',
            '<strong>Time-bound:</strong> Implicit quarterly timeline'
        ]
    },
    '3': {
        title: 'Goal 3: Increase New-User Activation',
        signals: [
            '<strong>Customer Problem:</strong> "High drop-off" indicates activation issues',
            '<strong>Company Strategy:</strong> "Improve activation" is primary strategic pillar',
            '<strong>Domain:</strong> Onboarding is directly tied to activation'
        ],
        alignment: [
            'Core to Growth strategy',
            'Addresses user drop-off problem',
            'Foundation for retention improvements'
        ],
        smart: [
            '<strong>Specific:</strong> New-user activation rate',
            '<strong>Measurable:</strong> 42% → 55%',
            '<strong>Achievable:</strong> 13 percentage point improvement is aggressive but feasible',
            '<strong>Relevant:</strong> Central to team charter',
            '<strong>Time-bound:</strong> Implicit quarterly target'
        ]
    },
    '4': {
        title: 'Goal 4: Increase First-Week Retention',
        signals: [
            '<strong>Logical Extension:</strong> Activation leads to retention',
            '<strong>Company Strategy:</strong> Reduces churn (operational efficiency)',
            '<strong>User Journey:</strong> First week is critical retention window'
        ],
        alignment: [
            'Complements activation goals',
            'Measures sustained engagement beyond initial onboarding',
            'Leading indicator for long-term retention'
        ],
        smart: [
            '<strong>Specific:</strong> D7 (day 7) retention metric',
            '<strong>Measurable:</strong> 61% → 72%',
            '<strong>Achievable:</strong> 11 percentage point improvement',
            '<strong>Relevant:</strong> Captures post-onboarding engagement',
            '<strong>Time-bound:</strong> Quarterly measurement cycle'
        ]
    }
};

function showWhyGenerated(goalNum) {
    const data = whyData[goalNum];
    if (!data) return;

    const whyModal = document.createElement('div');
    whyModal.className = 'modal-overlay';
    whyModal.style.display = 'flex';
    whyModal.innerHTML = `
        <div class="modal" style="width: 600px; max-height: 80vh;">
            <div class="modal-header">
                <h2>Why was this generated?</h2>
                <button class="close-btn why-close"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body" style="overflow-y: auto;">
                <div class="why-content">
                    <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 20px; color: var(--primary-color);">
                        🎯 ${data.title}
                    </h3>

                    <div class="why-section" style="margin-bottom: 24px;">
                        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">
                            Input Signals:
                        </h4>
                        <ul style="margin-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
                            ${data.signals.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="why-section" style="margin-bottom: 24px;">
                        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">
                            Strategic Alignment:
                        </h4>
                        <ul style="margin-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
                            ${data.alignment.map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="why-section">
                        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">
                            SMART Criteria Applied:
                        </h4>
                        <ul style="margin-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
                            ${data.smart.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="modal-actions">
                    <button class="btn btn-primary why-close">Got it</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(whyModal);

    // Close handlers
    whyModal.querySelectorAll('.why-close').forEach(btn => {
        btn.addEventListener('click', () => whyModal.remove());
    });
    whyModal.addEventListener('click', (e) => {
        if (e.target === whyModal) {
            whyModal.remove();
        }
    });
}

// Attach "Why generated" buttons
document.querySelectorAll('.why-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const goalNum = btn.getAttribute('data-goal');
        showWhyGenerated(goalNum);
    });
});

// Initialize - hide modal on load
if (editModal) {
    editModal.style.display = 'none';
}
