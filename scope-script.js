// Scope Definition Agent Script

// Store original context for cancel functionality
let originalContextHTML = null;

// Extract current values from context
function extractContextValues() {
    const contextBox = document.getElementById('contextBox');

    // Extract initiative
    const initiativeEl = contextBox.querySelector('.context-item:nth-child(1)');
    const initiative = initiativeEl ? initiativeEl.textContent.replace('Initiative:', '').trim() : 'Improve Login & Onboarding';

    // Extract OKRs
    const okrsEl = contextBox.querySelector('.context-item:nth-child(2) ul');
    const okrs = okrsEl ? Array.from(okrsEl.querySelectorAll('li')).map(li => li.textContent.trim()).join('\n') : 'Login success → 95%\nActivation → 55%';

    // Extract release window
    const releaseEl = contextBox.querySelector('.context-item:nth-child(3)');
    const releaseWindow = releaseEl ? releaseEl.textContent.replace('Release Window:', '').trim() : 'Q2';

    // Extract measurement cadence
    const cadenceEl = contextBox.querySelector('.context-item:nth-child(4)');
    const cadence = cadenceEl ? cadenceEl.textContent.replace('Measurement Cadence:', '').trim() : 'Daily / Weekly';

    return { initiative, okrs, releaseWindow, cadence };
}

// Edit Context
function editContext() {
    const contextBox = document.getElementById('contextBox');
    originalContextHTML = contextBox.innerHTML;

    const values = extractContextValues();

    // Create editable form
    contextBox.innerHTML = `
        <div class="edit-form">
            <div class="form-group">
                <label>Initiative:</label>
                <input type="text" id="initiativeName" value="${values.initiative}" />
            </div>
            <div class="form-group">
                <label>Primary OKRs (one per line):</label>
                <textarea id="primaryOKRs" rows="3">${values.okrs}</textarea>
            </div>
            <div class="form-group">
                <label>Release Window:</label>
                <input type="text" id="releaseWindow" value="${values.releaseWindow}" />
            </div>
            <div class="form-group">
                <label>Measurement Cadence:</label>
                <input type="text" id="measurementCadence" value="${values.cadence}" />
            </div>
            <div class="form-actions">
                <button class="btn-secondary" onclick="cancelContextEdit()">Cancel</button>
                <button class="btn-primary" onclick="saveContext()">Save</button>
            </div>
        </div>
    `;

    // Focus on first input
    setTimeout(() => {
        document.getElementById('initiativeName')?.focus();
    }, 100);
}

function cancelContextEdit() {
    if (originalContextHTML) {
        document.getElementById('contextBox').innerHTML = originalContextHTML;
        originalContextHTML = null;
        showNotification('Changes cancelled', 'info');
    }
}

function saveContext() {
    const initiative = document.getElementById('initiativeName').value;
    const okrs = document.getElementById('primaryOKRs').value.split('\n').filter(o => o.trim());
    const releaseWindow = document.getElementById('releaseWindow').value;
    const cadence = document.getElementById('measurementCadence').value;

    const okrsList = okrs.map(okr => `<li>${okr}</li>`).join('');

    document.getElementById('contextBox').innerHTML = `
        <div class="context-item">
            <strong>Initiative:</strong> ${initiative}
        </div>
        <div class="context-item">
            <strong>Primary OKRs:</strong>
            <ul>${okrsList}</ul>
        </div>
        <div class="context-item">
            <strong>Release Window:</strong> ${releaseWindow}
        </div>
        <div class="context-item">
            <strong>Measurement Cadence:</strong> ${cadence}
        </div>
    `;

    originalContextHTML = null;
    showNotification('Context updated successfully');
    saveDraft(); // Auto-save
}

// Check if scope is approved and detect changes
function checkScopeChange(changeType, changeDetail) {
    const approvedScope = localStorage.getItem('scopeDefinitionApproved');
    if (!approvedScope) {
        return; // No approved scope yet, no need to check
    }

    // Save the pending change
    const pendingChange = {
        type: changeType,
        detail: changeDetail,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('pendingScopeChange', JSON.stringify(pendingChange));

    // Show better modal instead of confirm dialog
    const modal = document.getElementById('scopeChangeModal');
    const description = document.getElementById('scopeChangeDescription');

    let warningText = '';
    switch (changeType) {
        case 'in-scope-added':
            warningText = `Adding "${changeDetail}" exceeds approved scope`;
            break;
        case 'out-scope-moved-in':
            warningText = `"${changeDetail}" was explicitly marked as out-of-scope`;
            break;
        case 'scope-removed':
            warningText = `Removing "${changeDetail}" alters the approved commitment`;
            break;
        case 'scope-modified':
            warningText = `Modifying scope to "${changeDetail}" requires approval`;
            break;
        default:
            warningText = changeDetail;
    }

    description.textContent = warningText;
    modal.style.display = 'flex';
}

// Cancel scope change
function cancelScopeChange() {
    localStorage.removeItem('pendingScopeChange');
    document.getElementById('scopeChangeModal').style.display = 'none';
    showNotification('Change cancelled', 'info');
}

// Proceed to scope monitor
function proceedToScopeMonitor() {
    window.location.href = 'scope-monitor.html';
}

// In Scope Management
function addInScope() {
    const text = prompt('Enter in-scope item:');
    if (text && text.trim()) {
        // Check if this violates approved scope
        checkScopeChange('in-scope-added', text);

        const list = document.getElementById('inScopeList');
        const item = document.createElement('div');
        item.className = 'scope-item in-scope';
        item.innerHTML = `
            <i class="ph ph-check"></i>
            <span>${text}</span>
        `;
        list.appendChild(item);
        showNotification('In-scope item added');
        saveDraft(); // Auto-save
    }
}

function editInScope() {
    const items = document.querySelectorAll('#inScopeList .scope-item');
    if (items.length === 0) {
        alert('No in-scope items to edit');
        return;
    }

    // Get approved scope to check for violations
    const approvedScope = localStorage.getItem('scopeDefinitionApproved');
    let outScopeItems = [];

    if (approvedScope) {
        const approved = JSON.parse(approvedScope);
        outScopeItems = approved.outScopeItems || [];
    }

    items.forEach((item, index) => {
        const span = item.querySelector('span');
        const currentText = span.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'inline-edit';
        input.onblur = function () {
            const newText = this.value.trim();

            // Check if the new text matches an out-of-scope item
            if (approvedScope && newText !== currentText) {
                const isOutOfScope = outScopeItems.some(outItem =>
                    outItem.toLowerCase().includes(newText.toLowerCase()) ||
                    newText.toLowerCase().includes(outItem.toLowerCase())
                );

                if (isOutOfScope) {
                    // This is moving an out-of-scope item to in-scope
                    checkScopeChange('out-scope-moved-in', newText);
                } else {
                    // Generic modification check
                    checkScopeChange('scope-modified', newText);
                }
            }

            span.textContent = newText || currentText;
            span.style.display = 'inline';
            this.remove();
            saveDraft(); // Auto-save
        };
        input.onkeypress = function (e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        };
        span.style.display = 'none';
        item.appendChild(input);
        if (index === 0) input.focus();
    });

    showNotification('Click on text to edit, press Enter to save');
}

function removeInScope() {
    const items = document.querySelectorAll('#inScopeList .scope-item');
    if (items.length === 0) {
        alert('No in-scope items to remove');
        return;
    }

    items.forEach(item => {
        item.style.cursor = 'pointer';
        item.style.border = '2px dashed #ef4444';
        item.onclick = function () {
            // Check for scope change before removing
            checkScopeChange('scope-removed', this.querySelector('span').textContent);

            // Note: In a real app, we might block removal until approved, 
            // but here we warn and then allow (or the warning modal handles the flow)
            if (confirm('Remove this in-scope item?')) {
                this.remove();
                showNotification('Item removed');
                saveDraft();
            }
        };
    });

    showNotification('Click on item to remove it');
}

// Out of Scope Management
function addOutScope() {
    const text = prompt('Enter out-of-scope item:');
    if (text && text.trim()) {
        const list = document.getElementById('outScopeList');
        const item = document.createElement('div');
        item.className = 'scope-item out-scope';
        item.innerHTML = `
            <i class="ph ph-x"></i>
            <span>${text}</span>
        `;
        list.appendChild(item);
        showNotification('Out-of-scope item added');
        saveDraft(); // Auto-save
    }
}

function editOutScope() {
    const items = document.querySelectorAll('#outScopeList .scope-item');
    if (items.length === 0) {
        alert('No out-of-scope items to edit');
        return;
    }

    items.forEach((item, index) => {
        const span = item.querySelector('span');
        const currentText = span.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'inline-edit';
        input.onblur = function () {
            span.textContent = this.value || currentText;
            span.style.display = 'inline';
            this.remove();
        };
        input.onkeypress = function (e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        };
        span.style.display = 'none';
        item.appendChild(input);
        if (index === 0) input.focus();
    });

    showNotification('Click on text to edit, press Enter to save');
}

function removeOutScope() {
    const items = document.querySelectorAll('#outScopeList .scope-item');
    if (items.length === 0) {
        alert('No out-of-scope items to remove');
        return;
    }

    items.forEach(item => {
        item.style.cursor = 'pointer';
        item.style.border = '2px dashed #ef4444';
        item.onclick = function () {
            if (confirm('Remove this out-of-scope item?')) {
                this.remove();
                showNotification('Item removed');
            }
        };
    });

    showNotification('Click on item to remove it');
}

// Constraint Management
function addConstraint() {
    const category = prompt('Enter constraint category (Technical, Business, Regulatory, etc.):');
    if (!category || !category.trim()) return;

    const constraint = prompt('Enter constraint description:');
    if (!constraint || !constraint.trim()) return;

    const container = document.getElementById('constraintsContainer');

    // Check if category exists
    let categoryDiv = Array.from(container.querySelectorAll('.constraint-category'))
        .find(div => div.querySelector('h3').textContent === category + ':');

    if (!categoryDiv) {
        categoryDiv = document.createElement('div');
        categoryDiv.className = 'constraint-category';
        categoryDiv.innerHTML = `<h3>${category}:</h3><ul></ul>`;
        container.appendChild(categoryDiv);
    }

    const ul = categoryDiv.querySelector('ul');
    const li = document.createElement('li');
    li.textContent = constraint;
    ul.appendChild(li);

    showNotification('Constraint added');
    saveDraft(); // Auto-save
}

// Assumptions Management
function addAssumption() {
    const text = prompt('Enter assumption:');
    if (text && text.trim()) {
        const list = document.getElementById('assumptionsList');
        const item = document.createElement('div');
        item.className = 'assumption-item';
        item.innerHTML = `
            <i class="ph ph-circle"></i>
            <span>${text}</span>
        `;
        list.appendChild(item);
        showNotification('Assumption added');
        saveDraft(); // Auto-save
    }
}

// Collect all scope data
function collectScopeData() {
    // Collect context
    const context = extractContextValues();

    // Collect in-scope items
    const inScopeItems = Array.from(document.querySelectorAll('#inScopeList .scope-item span'))
        .map(span => span.textContent.trim());

    // Collect out-of-scope items
    const outScopeItems = Array.from(document.querySelectorAll('#outScopeList .scope-item span'))
        .map(span => span.textContent.trim());

    // Collect constraints
    const constraints = {};
    document.querySelectorAll('#constraintsContainer .constraint-category').forEach(cat => {
        const category = cat.querySelector('h3').textContent.replace(':', '').trim();
        const items = Array.from(cat.querySelectorAll('li')).map(li => li.textContent.trim());
        constraints[category] = items;
    });

    // Collect assumptions
    const assumptions = Array.from(document.querySelectorAll('#assumptionsList .assumption-item span'))
        .map(span => span.textContent.trim());

    // Collect risks
    const risks = Array.from(document.querySelectorAll('#risksContainer .risk-item')).map(item => ({
        description: item.querySelector('.risk-content span').textContent.trim(),
        severity: item.querySelector('.risk-severity').textContent.trim()
    }));

    return {
        context,
        inScopeItems,
        outScopeItems,
        constraints,
        assumptions,
        risks,
        savedAt: new Date().toISOString()
    };
}

// Save Draft
function saveDraft() {
    try {
        const scopeData = collectScopeData();
        localStorage.setItem('scopeDefinitionDraft', JSON.stringify(scopeData));

        const savedTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        showNotification(`Draft saved successfully at ${savedTime}`, 'success');
        console.log('Draft saved to localStorage:', scopeData);
    } catch (error) {
        console.error('Error saving draft:', error);
        showNotification('Error saving draft', 'error');
    }
}

// Load Draft
function loadDraft() {
    try {
        const savedData = localStorage.getItem('scopeDefinitionDraft');
        if (!savedData) {
            console.log('No saved draft found');
            return false;
        }

        const scopeData = JSON.parse(savedData);
        console.log('Loading draft from localStorage:', scopeData);

        // Restore context
        if (scopeData.context) {
            const { initiative, okrs, releaseWindow, cadence } = scopeData.context;
            const okrsList = okrs.split('\n').filter(o => o.trim()).map(okr => `<li>${okr}</li>`).join('');

            document.getElementById('contextBox').innerHTML = `
                <div class="context-item">
                    <strong>Initiative:</strong> ${initiative}
                </div>
                <div class="context-item">
                    <strong>Primary OKRs:</strong>
                    <ul>${okrsList}</ul>
                </div>
                <div class="context-item">
                    <strong>Release Window:</strong> ${releaseWindow}
                </div>
                <div class="context-item">
                    <strong>Measurement Cadence:</strong> ${cadence}
                </div>
            `;
        }

        // Restore in-scope items
        if (scopeData.inScopeItems && scopeData.inScopeItems.length > 0) {
            const inScopeList = document.getElementById('inScopeList');
            inScopeList.innerHTML = '';
            scopeData.inScopeItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'scope-item in-scope';
                div.innerHTML = `<i class="ph ph-check"></i><span>${item}</span>`;
                inScopeList.appendChild(div);
            });
        }

        // Restore out-of-scope items
        if (scopeData.outScopeItems && scopeData.outScopeItems.length > 0) {
            const outScopeList = document.getElementById('outScopeList');
            outScopeList.innerHTML = '';
            scopeData.outScopeItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'scope-item out-scope';
                div.innerHTML = `<i class="ph ph-x"></i><span>${item}</span>`;
                outScopeList.appendChild(div);
            });
        }

        // Restore constraints
        if (scopeData.constraints && Object.keys(scopeData.constraints).length > 0) {
            const container = document.getElementById('constraintsContainer');
            container.innerHTML = '';
            Object.entries(scopeData.constraints).forEach(([category, items]) => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'constraint-category';
                const itemsList = items.map(item => `<li>${item}</li>`).join('');
                categoryDiv.innerHTML = `<h3>${category}:</h3><ul>${itemsList}</ul>`;
                container.appendChild(categoryDiv);
            });
        }

        // Restore assumptions
        if (scopeData.assumptions && scopeData.assumptions.length > 0) {
            const assumptionsList = document.getElementById('assumptionsList');
            assumptionsList.innerHTML = '';
            scopeData.assumptions.forEach(assumption => {
                const div = document.createElement('div');
                div.className = 'assumption-item';
                div.innerHTML = `<i class="ph ph-circle"></i><span>${assumption}</span>`;
                assumptionsList.appendChild(div);
            });
        }

        // Restore risks
        if (scopeData.risks && scopeData.risks.length > 0) {
            const risksContainer = document.getElementById('risksContainer');
            risksContainer.innerHTML = '';
            scopeData.risks.forEach(risk => {
                const div = document.createElement('div');
                div.className = 'risk-item';
                div.innerHTML = `
                    <div class="risk-content">
                        <i class="ph ph-warning-circle"></i>
                        <span>${risk.description}</span>
                    </div>
                    <span class="risk-severity ${risk.severity.toLowerCase()}">${risk.severity}</span>
                `;
                risksContainer.appendChild(div);
            });
        }

        const savedDate = new Date(scopeData.savedAt);
        const timeAgo = getTimeAgo(savedDate);
        showNotification(`Draft restored (saved ${timeAgo})`, 'success');
        return true;
    } catch (error) {
        console.error('Error loading draft:', error);
        showNotification('Error loading draft', 'error');
        return false;
    }
}

// Clear Draft
function clearDraft() {
    if (confirm('Are you sure you want to clear the saved draft? This cannot be undone.')) {
        localStorage.removeItem('scopeDefinitionDraft');
        showNotification('Draft cleared', 'info');
        location.reload();
    }
}

// Helper function to get time ago
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

// Approve Scope
function approveScope() {
    // Validate that we have at least some in-scope items
    const inScopeItems = document.querySelectorAll('#inScopeList .scope-item');
    if (inScopeItems.length === 0) {
        alert('Please add at least one in-scope item before approving.');
        return;
    }

    // Save final approved version
    const scopeData = collectScopeData();
    scopeData.approved = true;
    scopeData.version = 'v1.0';
    scopeData.approvedAt = new Date().toISOString();

    localStorage.setItem('scopeDefinitionApproved', JSON.stringify(scopeData));
    localStorage.removeItem('scopeDefinitionDraft'); // Clear draft after approval

    // Show approval modal
    const modal = document.getElementById('approvalModal');
    modal.style.display = 'flex';

    // Simulate scope versioning and activation
    console.log('Scope approved and versioned as v1.0');
    console.log('Scope Monitor activated');
    console.log('Approved scope data:', scopeData);
}

// Continue to Research
function continueToResearch() {
    console.log('continueToResearch called - navigating to research-hub.html');

    // Close the modal
    document.getElementById('approvalModal').style.display = 'none';

    // Show notification
    if (window.notify) {
        notify.show('Proceeding to research phase. Scope is locked and monitored.', 'success', 2000);
    }

    // Navigate to research hub - UPDATED
    setTimeout(() => {
        console.log('Navigating to research-hub.html now');
        window.location.href = 'research-hub.html';
    }, 1000);
}

// Simulate Scope Change (for demo purposes)
function simulateScopeChange() {
    // Close approval modal
    document.getElementById('approvalModal').style.display = 'none';

    // Navigate to Scope Monitor page
    window.location.href = 'scope-monitor.html';
}

// Utility: Show Notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('approvalModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('Scope Definition Agent initialized');

    // Try to load draft on page load
    const hasDraft = loadDraft();

    if (hasDraft) {
        console.log('Draft loaded successfully');
    } else {
        console.log('No draft found, using default data');
    }
});
