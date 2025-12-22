// Workflow Progress Indicator
// Shows users their progress through the PM workflow

const WORKFLOW_STEPS = [
    { id: 1, name: 'Goal Setting', page: 'index.html' },
    { id: 2, name: 'OKR Generator', page: 'okr-generator.html' },
    { id: 3, name: 'KPI Assignment', page: 'kpi-assignment.html' },
    { id: 4, name: 'Benchmark Comparison', page: 'benchmark-comparison.html' },
    { id: 5, name: 'Measurement Framework', page: 'measurement-framework.html' },
    { id: 6, name: 'Scope Definition', page: 'scope-definition.html' }
];

// Get current step based on page
function getCurrentStep() {
    const currentPage = window.location.pathname.split('/').pop();
    const step = WORKFLOW_STEPS.find(s => s.page === currentPage);
    return step ? step.id : 1;
}

// Calculate completion percentage
function getCompletionPercentage() {
    const currentStep = getCurrentStep();
    return Math.round((currentStep / WORKFLOW_STEPS.length) * 100);
}

// Add progress bar to page
function addProgressIndicator() {
    // Check if already exists
    if (document.getElementById('workflowProgress')) return;

    const percentage = getCompletionPercentage();
    const currentStep = getCurrentStep();

    const progressHTML = `
        <div id="workflowProgress" class="progress-indicator">
            <div class="progress-bar" style="width: ${percentage}%;"></div>
        </div>
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9998; background: white; padding: 0.75rem 1rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
            <span class="status-dot active"></span>
            <span style="color: #6b7280;">Step ${currentStep} of ${WORKFLOW_STEPS.length}</span>
            <span style="color: #1f2937; font-weight: 600;">${percentage}% Complete</span>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', progressHTML);
}

// Auto-save progress to localStorage
function saveProgress() {
    const progress = {
        currentStep: getCurrentStep(),
        lastVisited: new Date().toISOString(),
        completedSteps: []
    };

    // Get previous progress
    const savedProgress = localStorage.getItem('workflowProgress');
    if (savedProgress) {
        const prev = JSON.parse(savedProgress);
        progress.completedSteps = prev.completedSteps || [];
    }

    // Mark current step as completed if moving forward
    if (!progress.completedSteps.includes(getCurrentStep())) {
        progress.completedSteps.push(getCurrentStep());
    }

    localStorage.setItem('workflowProgress', JSON.stringify(progress));
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Don't show on scope monitor page
    if (!window.location.pathname.includes('scope-monitor.html')) {
        addProgressIndicator();
        saveProgress();
    }
});
