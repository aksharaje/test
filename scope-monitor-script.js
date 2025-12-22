// Scope Monitor Script

// Load pending change if it exists
function loadPendingChange() {
    const pendingChangeData = localStorage.getItem('pendingScopeChange');

    if (pendingChangeData) {
        const change = JSON.parse(pendingChangeData);
        const timestamp = new Date(change.timestamp);

        // Update request details based on actual change
        let requestText = '';
        let requestedBy = 'You (PM)';

        switch(change.type) {
            case 'in-scope-added':
                requestText = `Add "${change.detail}" to in-scope items`;
                break;
            case 'out-scope-moved-in':
                requestText = `Move "${change.detail}" from out-of-scope to in-scope`;
                break;
            case 'context-changed':
                requestText = `Update initiative context`;
                break;
            default:
                requestText = change.detail;
        }

        // Update the UI
        document.querySelector('.request-title').textContent = `"${requestText}"`;
        document.getElementById('requestDate').textContent = timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Update requested by
        const requestedByElement = document.querySelector('.meta-item:first-child');
        if (requestedByElement) {
            requestedByElement.innerHTML = `<strong>Requested by:</strong> ${requestedBy}`;
        }

        // Update violations and recommendations based on change type
        updateViolationsAndRecommendations(change);
    } else {
        // Use default data if no pending change
        document.getElementById('requestDate').textContent = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Update violations and recommendations based on change type
function updateViolationsAndRecommendations(change) {
    const violationsList = document.querySelector('.violations-list');
    const optionsBox = document.querySelector('.options-box');

    if (change.type === 'out-scope-moved-in') {
        // High severity - moving out-of-scope to in-scope
        violationsList.innerHTML = `
            <li><i class="ph ph-warning-circle"></i> <strong>Critical:</strong> This item was explicitly marked as out-of-scope</li>
            <li><i class="ph ph-warning-circle"></i> <strong>Constraint:</strong> Violates approved scope boundaries (v1.0)</li>
            <li><i class="ph ph-warning-circle"></i> <strong>Risk:</strong> Timeline and OKR commitments at risk</li>
        `;

        // Update impact scores for higher severity
        updateImpactScores(85, 90, 75); // Higher impact percentages

        optionsBox.innerHTML = `
            <h3>Recommended Options:</h3>
            <div class="option-item recommended">
                <div class="option-number">1</div>
                <div class="option-content">
                    <div class="option-title">
                        Keep item out-of-scope
                        <span class="recommended-badge">Recommended</span>
                    </div>
                    <p class="option-desc">Maintain current approved scope. This item was deliberately excluded for a reason.</p>
                </div>
            </div>

            <div class="option-item">
                <div class="option-number">2</div>
                <div class="option-content">
                    <div class="option-title">Defer to next quarter and re-scope</div>
                    <p class="option-desc">Add to Q3 roadmap and include in next scope definition cycle.</p>
                </div>
            </div>

            <div class="option-item">
                <div class="option-number">3</div>
                <div class="option-content">
                    <div class="option-title">Trade with existing in-scope item</div>
                    <p class="option-desc">Remove an existing in-scope item to make room for this feature.</p>
                </div>
            </div>
        `;
    } else if (change.type === 'in-scope-added') {
        // Medium severity - adding new in-scope item
        violationsList.innerHTML = `
            <li><i class="ph ph-warning-circle"></i> <strong>Constraint:</strong> No new features approved this quarter</li>
            <li><i class="ph ph-warning-circle"></i> <strong>Risk:</strong> May impact delivery timeline</li>
        `;

        updateImpactScores(70, 80, 60); // Medium impact percentages
    }
}

// Update impact score bars
function updateImpactScores(timelinePercent, engineeringPercent, okrPercent) {
    const impactBars = document.querySelectorAll('.impact-bar');
    if (impactBars.length >= 3) {
        impactBars[0].style.setProperty('--progress', `${timelinePercent}%`);
        impactBars[1].style.setProperty('--progress', `${engineeringPercent}%`);
        impactBars[2].style.setProperty('--progress', `${okrPercent}%`);
    }

    // Update impact values
    const impactValues = document.querySelectorAll('.impact-value');
    if (impactValues.length >= 3) {
        impactValues[0].textContent = timelinePercent > 80 ? '(+4-5 weeks)' : '(+3 weeks)';
        impactValues[1].textContent = timelinePercent > 80 ? '(Very High)' : '(High)';
        impactValues[2].textContent = okrPercent > 70 ? '(High risk to OKRs)' : '(Login success delayed)';
    }
}

// Approve with Trade-off
function approveWithTradeoff() {
    const pendingChangeData = localStorage.getItem('pendingScopeChange');
    const tradeoffOptions = document.querySelector('.tradeoff-options');

    if (pendingChangeData) {
        const change = JSON.parse(pendingChangeData);

        if (change.type === 'out-scope-moved-in') {
            // Update modal options for out-of-scope to in-scope change
            tradeoffOptions.innerHTML = `
                <label class="tradeoff-option">
                    <input type="radio" name="tradeoff" value="defer" checked>
                    <div class="option-card">
                        <div class="option-header">
                            <strong>Option 1:</strong> Keep out-of-scope
                            <span class="recommended-badge">Recommended</span>
                        </div>
                        <p>Maintain approved scope boundaries</p>
                    </div>
                </label>

                <label class="tradeoff-option">
                    <input type="radio" name="tradeoff" value="replace">
                    <div class="option-card">
                        <div class="option-header">
                            <strong>Option 2:</strong> Defer to next quarter
                        </div>
                        <p>Add to Q3 roadmap for proper scoping</p>
                    </div>
                </label>

                <label class="tradeoff-option">
                    <input type="radio" name="tradeoff" value="limit">
                    <div class="option-card">
                        <div class="option-header">
                            <strong>Option 3:</strong> Trade with existing item
                        </div>
                        <p>Remove an in-scope feature to make room</p>
                    </div>
                </label>
            `;
        }
    }

    const modal = document.getElementById('tradeoffModal');
    modal.style.display = 'flex';
}

// Close Trade-off Modal
function closeTradeoffModal() {
    document.getElementById('tradeoffModal').style.display = 'none';
}

// Confirm Trade-off
function confirmTradeoff() {
    const selectedOption = document.querySelector('input[name="tradeoff"]:checked').value;

    // Get the pending change if it exists
    const pendingChangeData = localStorage.getItem('pendingScopeChange');
    let requestText = 'Add Google + Apple social login';
    let requestedBy = 'Sales';

    if (pendingChangeData) {
        const change = JSON.parse(pendingChangeData);
        switch(change.type) {
            case 'in-scope-added':
                requestText = `Add "${change.detail}" to in-scope items`;
                requestedBy = 'You (PM)';
                break;
            case 'out-scope-moved-in':
                requestText = `Move "${change.detail}" from out-of-scope to in-scope`;
                requestedBy = 'You (PM)';
                break;
            default:
                requestText = change.detail;
                requestedBy = 'You (PM)';
        }
    }

    let optionText = '';
    let scopeUpdate = '';

    switch(selectedOption) {
        case 'defer':
            optionText = 'Defer to next quarter';
            scopeUpdate = 'Request added to next quarter roadmap. Current scope maintained.';
            break;
        case 'replace':
            optionText = 'Replace existing feature';
            scopeUpdate = 'Scope updated: New item added, existing feature moved to next quarter.';
            break;
        case 'limit':
            optionText = 'Limit scope to partial implementation';
            scopeUpdate = 'Scope updated: Partial implementation approved.';
            break;
    }

    // Save the change to localStorage
    saveChangeHistory({
        action: 'approved',
        option: optionText,
        request: requestText,
        requestedBy: requestedBy,
        timestamp: new Date().toISOString(),
        previousVersion: 'v1.0',
        newVersion: selectedOption === 'defer' ? 'v1.0' : 'v1.1'
    });

    // Clear pending change
    localStorage.removeItem('pendingScopeChange');

    // Close tradeoff modal
    closeTradeoffModal();

    // Show confirmation
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationDetails = document.getElementById('confirmationDetails');

    confirmationDetails.innerHTML = `
        <div class="approval-details">
            <p><strong>Decision:</strong> ${optionText}</p>
            <p><strong>Scope Version:</strong> ${selectedOption === 'defer' ? 'v1.0 (unchanged)' : 'v1.1'}</p>
            <p><strong>Status:</strong> ${scopeUpdate}</p>
            <p class="status-note">
                ${selectedOption === 'defer'
                    ? '<i class="ph ph-check-circle"></i> No changes to current scope. Request logged for future planning.'
                    : '<i class="ph ph-warning"></i> Scope updated. Measurement Framework and OKRs may need adjustment.'}
            </p>
        </div>
    `;

    confirmationModal.style.display = 'flex';
}

// Reject Change
function rejectChange() {
    if (!confirm('Are you sure you want to reject this scope change request?\n\nThe request will be archived and the requestor will be notified.')) {
        return;
    }

    // Get the pending change if it exists
    const pendingChangeData = localStorage.getItem('pendingScopeChange');
    let requestText = 'Add Google + Apple social login';
    let requestedBy = 'Sales';

    if (pendingChangeData) {
        const change = JSON.parse(pendingChangeData);
        switch(change.type) {
            case 'in-scope-added':
                requestText = `Add "${change.detail}" to in-scope items`;
                requestedBy = 'You (PM)';
                break;
            case 'out-scope-moved-in':
                requestText = `Move "${change.detail}" from out-of-scope to in-scope`;
                requestedBy = 'You (PM)';
                break;
            default:
                requestText = change.detail;
                requestedBy = 'You (PM)';
        }
    }

    // Save rejection to history
    saveChangeHistory({
        action: 'rejected',
        request: requestText,
        requestedBy: requestedBy,
        timestamp: new Date().toISOString(),
        reason: 'Conflicts with approved constraints and OKR timeline'
    });

    // Clear pending change
    localStorage.removeItem('pendingScopeChange');

    // Show confirmation
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationTitle = document.getElementById('confirmationTitle');
    const confirmationDetails = document.getElementById('confirmationDetails');

    confirmationTitle.textContent = 'Change Rejected';
    confirmationDetails.innerHTML = `
        <div class="approval-details">
            <p><strong>Status:</strong> Request rejected and archived</p>
            <p><strong>Scope Version:</strong> v1.0 (unchanged)</p>
            <p><strong>Notification:</strong> Sales team will be notified</p>
            <p class="status-note">
                <i class="ph ph-info"></i> Scope Monitor continues monitoring for changes.
            </p>
        </div>
    `;

    confirmationModal.style.display = 'flex';
}

// Escalate Change
function escalateChange() {
    const escalationReason = prompt('Add escalation note (optional):');

    // Get the pending change if it exists
    const pendingChangeData = localStorage.getItem('pendingScopeChange');
    let requestText = 'Add Google + Apple social login';
    let requestedBy = 'Sales';

    if (pendingChangeData) {
        const change = JSON.parse(pendingChangeData);
        switch(change.type) {
            case 'in-scope-added':
                requestText = `Add "${change.detail}" to in-scope items`;
                requestedBy = 'You (PM)';
                break;
            case 'out-scope-moved-in':
                requestText = `Move "${change.detail}" from out-of-scope to in-scope`;
                requestedBy = 'You (PM)';
                break;
            default:
                requestText = change.detail;
                requestedBy = 'You (PM)';
        }
    }

    // Save escalation to history
    saveChangeHistory({
        action: 'escalated',
        request: requestText,
        requestedBy: requestedBy,
        escalatedTo: 'Engineering Director',
        note: escalationReason || 'Requires executive decision',
        timestamp: new Date().toISOString()
    });

    // Clear pending change
    localStorage.removeItem('pendingScopeChange');

    // Show confirmation
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationTitle = document.getElementById('confirmationTitle');
    const confirmationDetails = document.getElementById('confirmationDetails');

    confirmationTitle.textContent = 'Change Escalated';
    confirmationDetails.innerHTML = `
        <div class="approval-details">
            <p><strong>Status:</strong> Escalated to Engineering Director</p>
            <p><strong>Scope Version:</strong> v1.0 (unchanged pending decision)</p>
            <p><strong>Note:</strong> ${escalationReason || 'Requires executive decision'}</p>
            <p class="status-note">
                <i class="ph ph-clock"></i> Awaiting approval. You'll be notified when a decision is made.
            </p>
        </div>
    `;

    confirmationModal.style.display = 'flex';
}

// Save Change History
function saveChangeHistory(change) {
    try {
        let history = localStorage.getItem('scopeChangeHistory');
        history = history ? JSON.parse(history) : [];

        history.unshift(change); // Add to beginning

        // Keep only last 20 changes
        if (history.length > 20) {
            history = history.slice(0, 20);
        }

        localStorage.setItem('scopeChangeHistory', JSON.stringify(history));
        console.log('Change saved to history:', change);
    } catch (error) {
        console.error('Error saving change history:', error);
    }
}

// Load Change History
function loadChangeHistory() {
    try {
        const history = localStorage.getItem('scopeChangeHistory');
        if (!history) return;

        const changes = JSON.parse(history);
        if (changes.length === 0) return;

        const section = document.getElementById('changeHistorySection');
        const container = document.getElementById('changeHistory');

        section.style.display = 'block';

        container.innerHTML = changes.map(change => {
            const date = new Date(change.timestamp);
            const timeAgo = getTimeAgo(date);

            let actionIcon = '';
            let actionClass = '';
            let actionText = '';

            switch(change.action) {
                case 'approved':
                    actionIcon = 'ph-check-circle';
                    actionClass = 'approved';
                    actionText = 'Approved';
                    break;
                case 'rejected':
                    actionIcon = 'ph-x-circle';
                    actionClass = 'rejected';
                    actionText = 'Rejected';
                    break;
                case 'escalated':
                    actionIcon = 'ph-arrow-up';
                    actionClass = 'escalated';
                    actionText = 'Escalated';
                    break;
                case 'skipped':
                    actionIcon = 'ph-arrow-right';
                    actionClass = 'skipped';
                    actionText = 'Skipped';
                    break;
            }

            return `
                <div class="history-item ${actionClass}">
                    <div class="history-icon">
                        <i class="ph ${actionIcon}"></i>
                    </div>
                    <div class="history-content">
                        <div class="history-header">
                            <strong>${change.request}</strong>
                            <span class="history-action ${actionClass}">${actionText}</span>
                        </div>
                        <div class="history-meta">
                            <span>Requested by: ${change.requestedBy}</span>
                            <span>•</span>
                            <span>${timeAgo}</span>
                            ${change.newVersion ? `<span>•</span><span>Version: ${change.newVersion}</span>` : ''}
                        </div>
                        ${change.option ? `<p class="history-detail">Decision: ${change.option}</p>` : ''}
                        ${change.note ? `<p class="history-detail">Note: ${change.note}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading change history:', error);
    }
}

// Proceed to Research (skip scope change negotiation)
function proceedToResearch() {
    if (!confirm('Skip scope negotiation and proceed directly to research?\n\nNote: This scope change will remain unresolved and may impact your OKRs.')) {
        return;
    }

    // Get the pending change if it exists
    const pendingChangeData = localStorage.getItem('pendingScopeChange');
    let requestText = 'Add Google + Apple social login';
    let requestedBy = 'Sales';

    if (pendingChangeData) {
        const change = JSON.parse(pendingChangeData);
        switch(change.type) {
            case 'in-scope-added':
                requestText = `Add "${change.detail}" to in-scope items`;
                requestedBy = 'You (PM)';
                break;
            case 'out-scope-moved-in':
                requestText = `Move "${change.detail}" from out-of-scope to in-scope`;
                requestedBy = 'You (PM)';
                break;
            default:
                requestText = change.detail;
                requestedBy = 'You (PM)';
        }
    }

    // Save as skipped to history
    saveChangeHistory({
        action: 'skipped',
        request: requestText,
        requestedBy: requestedBy,
        timestamp: new Date().toISOString(),
        note: 'Proceeded to research without resolving scope change'
    });

    // Clear pending change
    localStorage.removeItem('pendingScopeChange');

    // Show success notification
    if (window.notify) {
        notify.show('Proceeding to research phase. Scope change logged for later review.', 'info', 2000);
    }

    // Navigate to research hub
    setTimeout(() => {
        window.location.href = 'research-hub.html';
    }, 1000);
}

// Return to Scope Definition
function returnToScope() {
    window.location.href = 'scope-definition.html';
}

// Helper: Get Time Ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// Close modal when clicking outside
window.onclick = function(event) {
    const tradeoffModal = document.getElementById('tradeoffModal');
    const confirmationModal = document.getElementById('confirmationModal');

    if (event.target === tradeoffModal) {
        tradeoffModal.style.display = 'none';
    }
    if (event.target === confirmationModal) {
        confirmationModal.style.display = 'none';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Scope Monitor initialized');
    loadPendingChange();
    loadChangeHistory();
});
