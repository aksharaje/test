// Benchmark Comparison Interactive Functionality

// Track applied benchmarks
let appliedBenchmarks = {
    'login-success': false,
    'activation': false,
    'support': false,
    'password-reset': false
};

// Benchmark data structure
const benchmarkData = {
    'login-success': {
        krTitle: 'Login Success Rate',
        baseline: 87,
        commit: 95,
        stretch: 97,
        floor: null,
        unit: '%',
        metricsAffected: 2
    },
    'activation': {
        krTitle: 'Activation Rate',
        baseline: 42,
        commit: 55,
        stretch: 60,
        floor: null,
        unit: '%',
        metricsAffected: 2
    },
    'support': {
        krTitle: 'Support Ticket Volume',
        baseline: 1200,
        commit: 840,
        stretch: 780,
        floor: null,
        unit: 'tickets/mo',
        reduction: true,
        commitPercent: -30,
        stretchPercent: -35,
        metricsAffected: 1
    },
    'password-reset': {
        krTitle: 'Password Reset Errors',
        baseline: 100,
        commit: 60,
        stretch: 50,
        floor: 80,
        unit: '%',
        reduction: true,
        floorPercent: -20,
        commitPercent: -40,
        stretchPercent: -50,
        metricsAffected: 2
    }
};

// Update counters
function updateCounters() {
    const targetsUpdated = Object.values(appliedBenchmarks).filter(v => v).length;
    const metricsRecalibrated = Object.keys(appliedBenchmarks)
        .filter(key => appliedBenchmarks[key])
        .reduce((sum, key) => sum + benchmarkData[key].metricsAffected, 0);

    document.getElementById('targetsUpdated').textContent = targetsUpdated;
    document.getElementById('metricsRecalibrated').textContent = metricsRecalibrated;

    // Animate counter changes
    animateCounter('targetsUpdated', targetsUpdated);
    animateCounter('metricsRecalibrated', metricsRecalibrated);
}

// Animate counter
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    element.style.transform = 'scale(1.2)';
    element.style.color = '#10b981';

    setTimeout(() => {
        element.style.transform = 'scale(1)';
        element.style.color = '#667eea';
    }, 300);
}

// Apply Recommendation Buttons
document.querySelectorAll('.apply-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const kr = this.getAttribute('data-kr');
        const group = this.closest('.benchmark-group');

        // Mark as applied
        appliedBenchmarks[kr] = true;

        // Update button
        this.innerHTML = '<i class="ph ph-check-circle"></i> Applied';
        this.style.background = '#10b981';
        this.style.borderColor = '#10b981';
        this.disabled = true;

        // Add success badge to group header
        const header = group.querySelector('.benchmark-group-header h2');
        if (!header.querySelector('.status-badge')) {
            const badge = document.createElement('span');
            badge.className = 'status-badge applied';
            badge.innerHTML = '<i class="ph ph-check"></i> Applied';
            badge.style.marginLeft = '12px';
            header.appendChild(badge);
        }

        // Show notification
        if (window.notify) {
            notify.show(`Benchmark applied for ${benchmarkData[kr].krTitle}`, 'success', 3000, {
                title: 'Recommendation Applied'
            });
        }

        // Update counters
        updateCounters();

        // Visual feedback - highlight the group briefly
        group.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
        setTimeout(() => {
            group.style.boxShadow = '';
        }, 1000);
    });
});

// Apply All Three Button (for password reset)
document.querySelectorAll('.apply-all-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const kr = this.getAttribute('data-kr');
        const group = this.closest('.benchmark-group');

        // Mark as applied
        appliedBenchmarks[kr] = true;

        // Update button
        this.innerHTML = '<i class="ph ph-check-circle"></i> All Three Applied';
        this.style.background = '#10b981';
        this.style.borderColor = '#10b981';
        this.disabled = true;

        // Add success badge
        const header = group.querySelector('.benchmark-group-header h2');
        if (!header.querySelector('.status-badge')) {
            const badge = document.createElement('span');
            badge.className = 'status-badge applied';
            badge.innerHTML = '<i class="ph ph-check"></i> Floor, Commit & Stretch Applied';
            badge.style.marginLeft = '12px';
            header.appendChild(badge);
        }

        // Show notification
        if (window.notify) {
            notify.show('Floor (-20%), Commit (-40%), and Stretch (-50%) targets applied', 'success', 4000, {
                title: 'All Targets Applied'
            });
        }

        // Update counters
        updateCounters();

        // Visual feedback
        group.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
        setTimeout(() => {
            group.style.boxShadow = '';
        }, 1000);
    });
});

// Edit Manually Buttons
document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const kr = this.getAttribute('data-kr');
        const data = benchmarkData[kr];

        // Create modal for editing
        const modal = createEditModal(kr, data);
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.edit-modal-content').style.transform = 'translateY(0)';
        }, 10);
    });
});

// Create Edit Modal
function createEditModal(kr, data) {
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    const floorHtml = data.floor !== null ? `
        <div class="form-group" style="margin-bottom: 16px;">
            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Floor Target</label>
            <input type="number" id="editFloor" value="${data.floor}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Minimum acceptable value</div>
        </div>
    ` : '';

    modal.innerHTML = `
        <div class="edit-modal-content" style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; transform: translateY(-20px); transition: transform 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 20px;">Edit Targets Manually</h2>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">
                    <i class="ph ph-x"></i>
                </button>
            </div>

            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${data.krTitle}</div>
                <div style="font-size: 14px; color: #6b7280;">Baseline: ${data.baseline}${data.unit}</div>
            </div>

            ${floorHtml}

            <div class="form-group" style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Commit Target</label>
                <input type="number" id="editCommit" value="${data.commit}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Your primary target for this quarter</div>
            </div>

            <div class="form-group" style="margin-bottom: 24px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Stretch Target</label>
                <input type="number" id="editStretch" value="${data.stretch}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Aspirational goal aligned with top performers</div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-secondary cancel-edit">Cancel</button>
                <button class="btn btn-primary save-edit" data-kr="${kr}">
                    <i class="ph ph-check"></i> Save Custom Targets
                </button>
            </div>
        </div>
    `;

    // Close modal handlers
    modal.querySelector('.close-modal-btn').addEventListener('click', () => closeModal(modal));
    modal.querySelector('.cancel-edit').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });

    // Save button
    modal.querySelector('.save-edit').addEventListener('click', function() {
        const kr = this.getAttribute('data-kr');
        const floor = document.getElementById('editFloor')?.value;
        const commit = document.getElementById('editCommit').value;
        const stretch = document.getElementById('editStretch').value;

        // Update data
        benchmarkData[kr].commit = parseFloat(commit);
        benchmarkData[kr].stretch = parseFloat(stretch);
        if (floor) benchmarkData[kr].floor = parseFloat(floor);

        // Mark as applied with custom values
        appliedBenchmarks[kr] = true;

        // Update button
        const group = document.querySelector(`[data-group="${getGroupName(kr)}"]`);
        const applyBtn = group.querySelector('.apply-btn, .apply-all-btn');
        applyBtn.innerHTML = '<i class="ph ph-check-circle"></i> Custom Targets Applied';
        applyBtn.style.background = '#667eea';
        applyBtn.style.borderColor = '#667eea';
        applyBtn.disabled = true;

        // Add badge
        const header = group.querySelector('.benchmark-group-header h2');
        if (!header.querySelector('.status-badge')) {
            const badge = document.createElement('span');
            badge.className = 'status-badge applied';
            badge.innerHTML = '<i class="ph ph-pencil"></i> Custom';
            badge.style.marginLeft = '12px';
            header.appendChild(badge);
        }

        // Show notification
        if (window.notify) {
            notify.show(`Custom targets saved for ${benchmarkData[kr].krTitle}`, 'success', 3000, {
                title: 'Targets Updated'
            });
        }

        // Update counters
        updateCounters();

        closeModal(modal);
    });

    return modal;
}

// Helper function to get group name from KR
function getGroupName(kr) {
    const groupMap = {
        'login-success': 'auth',
        'activation': 'activation',
        'support': 'support',
        'password-reset': 'password-reset'
    };
    return groupMap[kr];
}

// Close modal with animation
function closeModal(modal) {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
}

// Skip Buttons
document.querySelectorAll('.skip-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const kr = this.getAttribute('data-kr');
        const group = this.closest('.benchmark-group');

        // Visual feedback
        group.style.opacity = '0.6';

        // Update button
        this.innerHTML = '<i class="ph ph-x"></i> Skipped';
        this.style.opacity = '0.5';
        this.disabled = true;

        // Disable other buttons in this group
        group.querySelectorAll('.apply-btn, .apply-all-btn, .edit-btn').forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.5';
        });

        // Show notification
        if (window.notify) {
            notify.show(`Skipped benchmark for ${benchmarkData[kr].krTitle}. Original targets maintained.`, 'info', 3000, {
                title: 'Benchmark Skipped'
            });
        }
    });
});

// View Benchmark Sources
document.getElementById('viewSourcesBtn')?.addEventListener('click', function() {
    const sourcesModal = createSourcesModal();
    document.body.appendChild(sourcesModal);

    setTimeout(() => {
        sourcesModal.style.opacity = '1';
        sourcesModal.querySelector('.sources-modal-content').style.transform = 'translateY(0)';
    }, 10);
});

// Create Sources Modal
function createSourcesModal() {
    const modal = document.createElement('div');
    modal.className = 'sources-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    modal.innerHTML = `
        <div class="sources-modal-content" style="background: white; border-radius: 12px; padding: 32px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; transform: translateY(-20px); transition: transform 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; font-size: 24px;">Benchmark Sources</h2>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">
                    <i class="ph ph-x"></i>
                </button>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: #667eea;">
                    <i class="ph ph-database"></i> Industry Standards
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                    <li>Mixpanel Product Benchmarks 2024</li>
                    <li>Amplitude Behavioral Analytics Report</li>
                    <li>Gartner Digital Experience Metrics</li>
                    <li>Forrester SaaS Performance Standards</li>
                </ul>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: #10b981;">
                    <i class="ph ph-chart-line-up"></i> Competitor Benchmarks
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                    <li>Auth0 - Authentication & Login Success (99.9%)</li>
                    <li>Okta - Identity Management Reliability</li>
                    <li>Notion - Onboarding & Activation (60%)</li>
                    <li>Linear - Support Efficiency (5 tickets/1k users)</li>
                </ul>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: #f59e0b;">
                    <i class="ph ph-users"></i> Category Benchmarks
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                    <li>SaaS Authentication Best Practices</li>
                    <li>B2B Onboarding Performance Data</li>
                    <li>Enterprise Support Ticket Norms</li>
                    <li>Password Reset Error Reduction Standards</li>
                </ul>
            </div>

            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #667eea;">
                <div style="font-size: 13px; color: #6b7280; line-height: 1.6;">
                    <strong style="color: #1f2937;">Note:</strong> Benchmarks are aggregated from multiple sources and normalized for your product category. All data is from Q4 2024 - Q1 2025.
                </div>
            </div>

            <div style="margin-top: 24px; text-align: center;">
                <button class="btn btn-primary close-sources-btn">Close</button>
            </div>
        </div>
    `;

    // Close handlers
    modal.querySelector('.close-modal-btn').addEventListener('click', () => closeModal(modal));
    modal.querySelector('.close-sources-btn').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });

    return modal;
}

// Continue to Measurement Framework
document.getElementById('continue-to-measurement')?.addEventListener('click', function() {
    const appliedCount = Object.values(appliedBenchmarks).filter(v => v).length;

    if (appliedCount === 0) {
        if (confirm('You haven\'t applied any benchmark recommendations.\n\nAre you sure you want to proceed with your original targets?')) {
            window.location.href = 'measurement-framework.html';
        }
    } else {
        // Show success message
        if (window.notify) {
            notify.show(`${appliedCount} benchmark(s) applied. Proceeding to Measurement Framework...`, 'success', 2000);
        }

        setTimeout(() => {
            window.location.href = 'measurement-framework.html';
        }, 1500);
    }
});

// Skip to Next Step
document.getElementById('skip-to-next')?.addEventListener('click', function() {
    if (confirm('Skip benchmark comparison and proceed with original targets?\n\nYou can return to this step later if needed.')) {
        window.location.href = 'measurement-framework.html';
    }
});

// Animate range bars on page load
window.addEventListener('load', function() {
    setTimeout(() => {
        document.querySelectorAll('.range-fill').forEach(bar => {
            const currentWidth = bar.style.width;
            bar.style.width = '0%';

            setTimeout(() => {
                bar.style.width = currentWidth;
            }, 100);
        });
    }, 300);
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Benchmark Comparison initialized');
    updateCounters();
});
