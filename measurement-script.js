// Measurement Framework Builder Interactive Functionality

// Framework data structure
let frameworkData = {
    'login-success': {
        metricName: 'Login Success Rate',
        floor: 92,
        commit: 95,
        stretch: 97,
        cadence: 'daily',
        segments: ['Device Type', 'Region'],
        dataSource: 'firebase-auth',
        alertThreshold: 92,
        alertDuration: 2,
        visualizations: ['line-chart', 'device-segmentation'],
        modified: false
    },
    'activation': {
        metricName: 'Activation Rate',
        floor: 45,
        commit: 55,
        stretch: 60,
        cadence: 'daily',
        segments: ['Device Type', 'Region', 'Traffic Source'],
        dataSource: 'mixpanel',
        alertThreshold: 50,
        alertDuration: 3,
        visualizations: ['funnel', 'cohort-analysis'],
        modified: false
    },
    'support-tickets': {
        metricName: 'Support Ticket Volume',
        floor: 120,
        commit: 100,
        stretch: 80,
        cadence: 'weekly',
        segments: ['Ticket Type', 'Severity'],
        dataSource: 'zendesk',
        alertThreshold: 120,
        alertDuration: 1,
        visualizations: ['stacked-bar', 'category-breakdown'],
        modified: false
    }
};

// Load saved framework data from localStorage
function loadFrameworkData() {
    const saved = localStorage.getItem('measurementFramework');
    if (saved) {
        try {
            frameworkData = JSON.parse(saved);
            console.log('Loaded saved framework data');
        } catch (e) {
            console.error('Error loading framework data:', e);
        }
    }
}

// Save framework data to localStorage
function saveFrameworkData() {
    localStorage.setItem('measurementFramework', JSON.stringify(frameworkData));
    console.log('Framework data saved');
}

// Initialize on page load
loadFrameworkData();

// Target dropdown change handlers
document.querySelectorAll('.floor-target, .commit-target, .stretch-target').forEach(select => {
    select.addEventListener('change', function() {
        const metricGroup = this.closest('.metric-group');
        const metricId = metricGroup?.getAttribute('data-metric');

        if (!metricId || !frameworkData[metricId]) return;

        const targetType = this.classList.contains('floor-target') ? 'floor' :
                          this.classList.contains('commit-target') ? 'commit' : 'stretch';

        const value = parseFloat(this.value);
        frameworkData[metricId][targetType] = value;
        frameworkData[metricId].modified = true;

        saveFrameworkData();

        if (window.notify) {
            notify.show(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} target updated to ${this.value}`, 'success');
        }
    });
});

// Cadence selection handlers
document.querySelectorAll('.metric-group select').forEach(select => {
    // Only target cadence selects (not target dropdowns)
    if (select.closest('.field-row') && !select.classList.contains('floor-target') &&
        !select.classList.contains('commit-target') && !select.classList.contains('stretch-target')) {

        select.addEventListener('change', function() {
            const metricGroup = this.closest('.metric-group');
            const metricId = metricGroup?.getAttribute('data-metric');

            if (!metricId || !frameworkData[metricId]) return;

            frameworkData[metricId].cadence = this.value;
            frameworkData[metricId].modified = true;

            saveFrameworkData();

            if (window.notify) {
                notify.show(`Tracking cadence updated to ${this.value}`, 'success');
            }
        });
    }
});

// Data source selection handlers
document.querySelectorAll('.data-source-select').forEach(select => {
    select.addEventListener('change', function() {
        const metricGroup = this.closest('.metric-group');
        const metricId = metricGroup?.getAttribute('data-metric');

        if (!metricId || !frameworkData[metricId]) return;

        frameworkData[metricId].dataSource = this.value;
        frameworkData[metricId].modified = true;

        saveFrameworkData();

        if (window.notify) {
            notify.show(`Data source updated to ${this.options[this.selectedIndex].text}`, 'success');
        }
    });
});

// Segment badge click handlers
document.querySelectorAll('.segment-badge').forEach(badge => {
    // Skip "Add Segment" badge
    if (badge.querySelector('.ph-plus')) return;

    badge.addEventListener('click', function() {
        this.classList.toggle('selected');

        const metricGroup = this.closest('.metric-group');
        const metricId = metricGroup?.getAttribute('data-metric');

        if (!metricId || !frameworkData[metricId]) return;

        const segmentText = this.textContent.trim();

        if (this.classList.contains('selected')) {
            // Add segment if not already present
            if (!frameworkData[metricId].segments.includes(segmentText)) {
                frameworkData[metricId].segments.push(segmentText);
            }
        } else {
            // Remove segment
            frameworkData[metricId].segments = frameworkData[metricId].segments.filter(s => s !== segmentText);
        }

        frameworkData[metricId].modified = true;
        saveFrameworkData();
    });
});

// "Add Segment" badge handlers
document.querySelectorAll('.segment-badge .ph-plus').forEach(plusIcon => {
    const badge = plusIcon.closest('.segment-badge');

    badge.addEventListener('click', function() {
        const metricGroup = this.closest('.metric-group');
        const metricId = metricGroup?.getAttribute('data-metric');
        const segmentContainer = this.closest('.segment-badges');

        // Create modal for adding segment
        const modal = createAddSegmentModal(metricId, segmentContainer);
        document.body.appendChild(modal);
    });
});

// Create Add Segment Modal
function createAddSegmentModal(metricId, segmentContainer) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 32px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    content.innerHTML = `
        <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1f2937;">Add Segment</h2>
        <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">
            Enter a custom segment to filter this metric by
        </p>

        <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Segment Name
            </label>
            <input type="text" id="segmentNameInput"
                   placeholder="e.g., User Tier, Browser Type, Campaign"
                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
        </div>

        <div style="display: flex; gap: 12px;">
            <button class="cancel-segment-btn" style="
                flex: 1;
                padding: 12px 24px;
                border: 2px solid #e5e7eb;
                background: white;
                color: #374151;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Cancel</button>

            <button class="add-segment-btn" style="
                flex: 1;
                padding: 12px 24px;
                border: none;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Add Segment</button>
        </div>
    `;

    modal.appendChild(content);

    // Cancel button
    content.querySelector('.cancel-segment-btn').addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    });

    // Add button
    content.querySelector('.add-segment-btn').addEventListener('click', () => {
        const input = content.querySelector('#segmentNameInput');
        const segmentName = input.value.trim();

        if (!segmentName) {
            if (window.notify) {
                notify.show('Please enter a segment name', 'warning');
            }
            return;
        }

        // Create new segment badge
        const newBadge = document.createElement('span');
        newBadge.className = 'segment-badge selected';
        newBadge.innerHTML = `<i class="ph ph-check"></i> ${segmentName}`;

        // Add click handler
        newBadge.addEventListener('click', function() {
            this.classList.toggle('selected');

            if (!frameworkData[metricId]) return;

            if (this.classList.contains('selected')) {
                if (!frameworkData[metricId].segments.includes(segmentName)) {
                    frameworkData[metricId].segments.push(segmentName);
                }
            } else {
                frameworkData[metricId].segments = frameworkData[metricId].segments.filter(s => s !== segmentName);
            }

            frameworkData[metricId].modified = true;
            saveFrameworkData();
        });

        // Insert before "Add Segment" badge
        const addBadge = segmentContainer.querySelector('.segment-badge .ph-plus')?.closest('.segment-badge');
        if (addBadge) {
            segmentContainer.insertBefore(newBadge, addBadge);
        }

        // Update data
        if (frameworkData[metricId]) {
            frameworkData[metricId].segments.push(segmentName);
            frameworkData[metricId].modified = true;
            saveFrameworkData();
        }

        if (window.notify) {
            notify.show(`Segment "${segmentName}" added`, 'success');
        }

        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => modal.remove(), 200);
        }
    });

    // Focus input
    setTimeout(() => {
        content.querySelector('#segmentNameInput').focus();
    }, 100);

    return modal;
}

// Edit Alert Rule handlers
document.querySelectorAll('.edit-rule-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const metricGroup = this.closest('.metric-group');
        const metricId = metricGroup?.getAttribute('data-metric');
        const alertBox = this.closest('.alert-box');

        const modal = createEditAlertModal(metricId, alertBox);
        document.body.appendChild(modal);
    });
});

// Alert input inline editing
document.querySelectorAll('.alert-input').forEach(input => {
    input.addEventListener('change', function() {
        const metricGroup = this.closest('.metric-group');
        const metricId = metricGroup?.getAttribute('data-metric');

        if (!metricId || !frameworkData[metricId]) return;

        const alertBox = this.closest('.alert-box');
        const inputs = alertBox.querySelectorAll('.alert-input');

        if (inputs.length >= 2) {
            frameworkData[metricId].alertThreshold = parseFloat(inputs[0].value);
            frameworkData[metricId].alertDuration = parseInt(inputs[1].value);
            frameworkData[metricId].modified = true;

            saveFrameworkData();

            if (window.notify) {
                notify.show('Alert rule updated', 'success');
            }
        }
    });
});

// Create Edit Alert Modal
function createEditAlertModal(metricId, alertBox) {
    const data = frameworkData[metricId];

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 32px;
        border-radius: 12px;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    content.innerHTML = `
        <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1f2937;">
            <i class="ph ph-warning" style="color: #f59e0b;"></i> Configure Alert Rule
        </h2>
        <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">
            Define when alerts should be triggered for ${data.metricName}
        </p>

        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Current Rule:</strong> Alert when value &lt; ${data.alertThreshold}${data.metricName.includes('Rate') ? '%' : ''}
                for ${data.alertDuration} consecutive ${data.cadence === 'daily' ? 'days' : data.cadence === 'weekly' ? 'weeks' : 'months'}
            </p>
        </div>

        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Threshold Value
            </label>
            <input type="number" id="alertThresholdInput" value="${data.alertThreshold}"
                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
            <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0 0;">
                Alert when metric drops below this value
            </p>
        </div>

        <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Duration (consecutive periods)
            </label>
            <input type="number" id="alertDurationInput" value="${data.alertDuration}" min="1"
                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
            <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0 0;">
                Number of consecutive ${data.cadence === 'daily' ? 'days' : data.cadence === 'weekly' ? 'weeks' : 'months'}
                before triggering alert
            </p>
        </div>

        <div style="display: flex; gap: 12px;">
            <button class="cancel-alert-btn" style="
                flex: 1;
                padding: 12px 24px;
                border: 2px solid #e5e7eb;
                background: white;
                color: #374151;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
            ">Cancel</button>

            <button class="save-alert-btn" style="
                flex: 1;
                padding: 12px 24px;
                border: none;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
            ">Save Alert Rule</button>
        </div>
    `;

    modal.appendChild(content);

    // Cancel button
    content.querySelector('.cancel-alert-btn').addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    });

    // Save button
    content.querySelector('.save-alert-btn').addEventListener('click', () => {
        const threshold = parseFloat(content.querySelector('#alertThresholdInput').value);
        const duration = parseInt(content.querySelector('#alertDurationInput').value);

        if (isNaN(threshold) || isNaN(duration) || duration < 1) {
            if (window.notify) {
                notify.show('Please enter valid values', 'warning');
            }
            return;
        }

        // Update data
        frameworkData[metricId].alertThreshold = threshold;
        frameworkData[metricId].alertDuration = duration;
        frameworkData[metricId].modified = true;

        // Update UI inline
        const alertConfig = alertBox.querySelector('.alert-config');
        const unit = data.metricName.includes('Rate') ? '%' : '';
        const periodName = data.cadence === 'daily' ? 'days' : data.cadence === 'weekly' ? 'weeks' : 'months';

        alertConfig.innerHTML = `
            Trigger when ${data.metricName.toLowerCase()} &lt;
            <input type="number" class="alert-input" value="${threshold}">
            ${unit} for
            <input type="number" class="alert-input" value="${duration}">
            consecutive ${periodName}.
        `;

        // Re-attach inline edit handlers
        alertConfig.querySelectorAll('.alert-input').forEach(input => {
            input.addEventListener('change', function() {
                const inputs = alertConfig.querySelectorAll('.alert-input');
                if (inputs.length >= 2) {
                    frameworkData[metricId].alertThreshold = parseFloat(inputs[0].value);
                    frameworkData[metricId].alertDuration = parseInt(inputs[1].value);
                    frameworkData[metricId].modified = true;
                    saveFrameworkData();
                }
            });
        });

        saveFrameworkData();

        if (window.notify) {
            notify.show('Alert rule updated successfully', 'success');
        }

        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => modal.remove(), 200);
        }
    });

    return modal;
}

// Add Metric button
const addMetricBtn = document.querySelector('.add-metric-section button');
if (addMetricBtn) {
    addMetricBtn.addEventListener('click', () => {
        const modal = createAddMetricModal();
        document.body.appendChild(modal);
    });
}

// Create Add Metric Modal
function createAddMetricModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 32px;
        border-radius: 12px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    content.innerHTML = `
        <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1f2937;">
            <i class="ph ph-plus-circle" style="color: #667eea;"></i> Add New Metric
        </h2>
        <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">
            Define a new metric to track alongside your OKRs
        </p>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
            <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>Note:</strong> New metrics will be added to your measurement framework and can be configured with
                targets, segments, alerts, and visualizations.
            </p>
        </div>

        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Metric Name
            </label>
            <input type="text" id="newMetricName" placeholder="e.g., User Retention Rate, Time to First Action"
                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
        </div>

        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Linked OKR (optional)
            </label>
            <select id="newMetricOKR" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                <option value="">-- Not linked to any OKR --</option>
                <option value="login-success">Login Success → 95%</option>
                <option value="activation">Activation → 55%</option>
                <option value="support">Support Tickets → 100</option>
            </select>
        </div>

        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Data Source
            </label>
            <select id="newMetricDataSource" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                <option value="ga4">Google Analytics 4</option>
                <option value="mixpanel">Mixpanel</option>
                <option value="amplitude">Amplitude</option>
                <option value="firebase-auth">Firebase Auth</option>
                <option value="zendesk">Zendesk</option>
                <option value="custom">Custom Source</option>
            </select>
        </div>

        <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">
                Tracking Cadence
            </label>
            <select id="newMetricCadence" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
            </select>
        </div>

        <div style="display: flex; gap: 12px;">
            <button class="cancel-metric-btn" style="
                flex: 1;
                padding: 12px 24px;
                border: 2px solid #e5e7eb;
                background: white;
                color: #374151;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
            ">Cancel</button>

            <button class="create-metric-btn" style="
                flex: 1;
                padding: 12px 24px;
                border: none;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
            ">Create Metric</button>
        </div>
    `;

    modal.appendChild(content);

    // Cancel button
    content.querySelector('.cancel-metric-btn').addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    });

    // Create button
    content.querySelector('.create-metric-btn').addEventListener('click', () => {
        const name = content.querySelector('#newMetricName').value.trim();
        const dataSource = content.querySelector('#newMetricDataSource').value;
        const cadence = content.querySelector('#newMetricCadence').value;

        if (!name) {
            if (window.notify) {
                notify.show('Please enter a metric name', 'warning');
            }
            return;
        }

        if (window.notify) {
            notify.show(`Metric "${name}" added successfully! Configure targets and alerts in the new metric group below.`, 'success', 4000);
        }

        // In a real implementation, this would create a new metric group in the DOM
        // For this prototype, we just show success

        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => modal.remove(), 200);
        }
    });

    // Focus input
    setTimeout(() => {
        content.querySelector('#newMetricName').focus();
    }, 100);

    return modal;
}

// Publish Framework button
const publishBtn = document.querySelector('.publish-section button');
if (publishBtn) {
    publishBtn.addEventListener('click', () => {
        // Save final state
        saveFrameworkData();

        // Mark framework as published
        localStorage.setItem('frameworkPublished', 'true');
        localStorage.setItem('frameworkPublishDate', new Date().toISOString());

        if (window.notify) {
            notify.show('Measurement Framework published successfully!', 'success', 2000);
        }

        // Navigate to Scope Definition
        setTimeout(() => {
            window.location.href = 'scope-definition.html';
        }, 1500);
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }

    .notification.show {
        opacity: 1;
        transform: translateX(0);
    }

    .segment-badge {
        transition: all 0.2s ease;
    }

    .segment-badge:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .alert-input {
        transition: border-color 0.2s ease;
    }

    .alert-input:focus {
        outline: none;
        border-color: #667eea;
    }
`;
document.head.appendChild(style);

// Initialize counters on page load
window.addEventListener('DOMContentLoaded', () => {
    const metricsCount = Object.keys(frameworkData).length;
    const modifiedCount = Object.values(frameworkData).filter(m => m.modified).length;

    console.log(`Measurement Framework loaded: ${metricsCount} metrics, ${modifiedCount} modified`);
});
