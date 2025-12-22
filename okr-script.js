// OKR Generator Interactive Functionality

// Global state to track current editing
let currentEditingKr = null;
let currentEditingObjective = null;

// Modal Management
const editObjectiveModal = document.getElementById('edit-objective-modal');
const editKrModal = document.getElementById('edit-kr-modal');
const closeBtns = document.querySelectorAll('.close-btn, .close-modal-btn');

// Close modal handlers
closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        editObjectiveModal.style.display = 'none';
        editKrModal.style.display = 'none';
        currentEditingKr = null;
        currentEditingObjective = null;
    });
});

// Close on overlay click
[editObjectiveModal, editKrModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                currentEditingKr = null;
                currentEditingObjective = null;
            }
        });
    }
});

// Edit Objective
document.querySelectorAll('.edit-objective-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const objectiveSection = e.target.closest('.objective-section');
        currentEditingObjective = objectiveSection;

        // Populate modal with current objective data
        const objectiveTitle = objectiveSection.querySelector('.objective-title-row h2').textContent.replace(/.*Objective \d+:\s*/, '');
        editObjectiveModal.querySelector('textarea').value = objectiveTitle;

        editObjectiveModal.style.display = 'flex';
    });
});

// Edit KR
document.querySelectorAll('.edit-kr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const krCard = e.target.closest('.kr-card');
        currentEditingKr = krCard;

        // Populate modal with current KR data
        const krTitle = krCard.querySelector('.kr-title').textContent;
        const baselineText = krCard.querySelector('.meta-item:nth-child(1)')?.textContent || '';
        const ownerText = krCard.querySelector('.meta-item:nth-child(2)')?.textContent || '';

        editKrModal.querySelector('textarea').value = krTitle;

        // Extract baseline and owner values
        const baselineValue = baselineText.replace('Baseline:', '').trim();
        const ownerValue = ownerText.replace('Owner:', '').trim();

        editKrModal.querySelector('input[type="text"]').value = baselineValue;
        editKrModal.querySelectorAll('input[type="text"]')[1].value = baselineValue; // Baseline
        editKrModal.querySelectorAll('input[type="text"]')[2].value = '95%'; // Target (example)
        editKrModal.querySelectorAll('input[type="text"]')[3].value = ownerValue; // Owner

        editKrModal.style.display = 'flex';
    });
});

// Save Objective - Actually update the DOM
document.querySelector('.save-objective-btn')?.addEventListener('click', () => {
    if (currentEditingObjective) {
        const newTitle = editObjectiveModal.querySelector('textarea').value;
        const objectiveH2 = currentEditingObjective.querySelector('.objective-title-row h2');

        // Keep the icon and number, update the text
        const icon = objectiveH2.querySelector('i');
        const objectiveNum = objectiveH2.textContent.match(/Objective \d+/)[0];

        objectiveH2.innerHTML = '';
        if (icon) objectiveH2.appendChild(icon.cloneNode(true));
        objectiveH2.innerHTML += ` ${objectiveNum}: ${newTitle}`;

        // Show success feedback
        showSuccessFeedback('Objective updated successfully!');
    }
    editObjectiveModal.style.display = 'none';
    currentEditingObjective = null;
});

// Save KR - Actually update the DOM
document.querySelector('.save-kr-btn')?.addEventListener('click', () => {
    if (currentEditingKr) {
        const newDescription = editKrModal.querySelector('textarea').value;
        const newBaseline = editKrModal.querySelectorAll('input[type="text"]')[1].value;
        const newOwner = editKrModal.querySelectorAll('input[type="text"]')[3].value;

        // Update KR title
        currentEditingKr.querySelector('.kr-title').textContent = newDescription;

        // Update meta items
        const metaItems = currentEditingKr.querySelectorAll('.meta-item');
        if (metaItems[0]) metaItems[0].innerHTML = `<strong>Baseline:</strong> ${newBaseline}`;
        if (metaItems[1]) metaItems[1].innerHTML = `<strong>Owner:</strong> ${newOwner}`;

        // Show success feedback
        showSuccessFeedback('Key Result updated successfully!');
    }
    editKrModal.style.display = 'none';
    currentEditingKr = null;
});

// Success Feedback Helper
function showSuccessFeedback(message) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    feedback.textContent = `✓ ${message}`;
    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Delete KR
document.querySelectorAll('.delete-kr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this Key Result?')) {
            const krCard = btn.closest('.kr-card');
            krCard.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => krCard.remove(), 300);
            showSuccessFeedback('Key Result deleted');
        }
    });
});

// Add KR - Actually creates a new KR
document.querySelectorAll('.add-kr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const objectiveSection = e.target.closest('.objective-section');
        const krList = objectiveSection.querySelector('.kr-list');
        const krCount = krList.querySelectorAll('.kr-card').length + 1;

        // Create new KR card
        const newKr = document.createElement('div');
        newKr.className = 'kr-card';
        newKr.style.animation = 'slideIn 0.3s ease-out';
        newKr.innerHTML = `
            <div class="kr-header">
                <div class="kr-checkbox">
                    <input type="checkbox" checked id="kr-new-${krCount}">
                    <label for="kr-new-${krCount}">KR ${krCount}</label>
                </div>
                <div class="kr-actions">
                    <button class="btn-icon edit-kr-btn"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon delete-kr-btn"><i class="ph ph-trash"></i></button>
                </div>
            </div>
            <div class="kr-content">
                <h3 class="kr-title">New Key Result - Click edit to customize</h3>
                <div class="kr-meta">
                    <span class="meta-item"><strong>Baseline:</strong> TBD</span>
                    <span class="meta-item"><strong>Owner:</strong> Unassigned</span>
                </div>
            </div>
        `;

        krList.appendChild(newKr);

        // Attach event listeners to new buttons
        newKr.querySelector('.edit-kr-btn').addEventListener('click', (e) => {
            currentEditingKr = newKr;
            editKrModal.querySelector('textarea').value = newKr.querySelector('.kr-title').textContent;
            editKrModal.style.display = 'flex';
        });

        newKr.querySelector('.delete-kr-btn').addEventListener('click', () => {
            if (confirm('Delete this Key Result?')) {
                newKr.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => newKr.remove(), 300);
            }
        });

        showSuccessFeedback('New Key Result added');
    });
});

// Add Objective
document.getElementById('add-objective-btn')?.addEventListener('click', () => {
    const mainContent = document.querySelector('.main-content');
    const objectiveCount = document.querySelectorAll('.objective-section').length + 1;

    const newObjective = document.createElement('section');
    newObjective.className = 'objective-section';
    newObjective.style.animation = 'slideIn 0.3s ease-out';
    newObjective.innerHTML = `
        <div class="objective-header">
            <div class="objective-title-row">
                <h2><i class="ph ph-target"></i> Objective ${objectiveCount}: New Objective - Click edit to customize</h2>
            </div>
            <div class="objective-actions">
                <button class="btn btn-outline-sm edit-objective-btn" data-objective="${objectiveCount}">
                    <i class="ph ph-pencil-simple"></i> Edit Objective
                </button>
                <button class="btn btn-outline-sm add-kr-btn" data-objective="${objectiveCount}">
                    <i class="ph ph-plus"></i> Add KR
                </button>
                <button class="btn btn-outline-sm btn-delete">
                    <i class="ph ph-trash"></i> Delete
                </button>
            </div>
        </div>
        <div class="kr-list">
            <p style="color: #6B7280; text-align: center; padding: 20px;">No Key Results yet. Click "Add KR" to create one.</p>
        </div>
    `;

    // Insert before "Add New Objective" button
    const addBtn = document.querySelector('.add-objective-container');
    mainContent.insertBefore(newObjective, addBtn);

    // Attach event listeners
    newObjective.querySelector('.edit-objective-btn').addEventListener('click', (e) => {
        currentEditingObjective = newObjective;
        editObjectiveModal.querySelector('textarea').value = `New Objective ${objectiveCount}`;
        editObjectiveModal.style.display = 'flex';
    });

    newObjective.querySelector('.add-kr-btn').addEventListener('click', () => {
        // Remove empty state message if exists
        const emptyMsg = newObjective.querySelector('.kr-list p');
        if (emptyMsg) emptyMsg.remove();

        // Use the existing add KR logic
        const krList = newObjective.querySelector('.kr-list');
        const krCount = krList.querySelectorAll('.kr-card').length + 1;

        const newKr = document.createElement('div');
        newKr.className = 'kr-card';
        newKr.innerHTML = `
            <div class="kr-header">
                <div class="kr-checkbox">
                    <input type="checkbox" checked id="kr-${objectiveCount}-${krCount}">
                    <label for="kr-${objectiveCount}-${krCount}">KR ${krCount}</label>
                </div>
                <div class="kr-actions">
                    <button class="btn-icon edit-kr-btn"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon delete-kr-btn"><i class="ph ph-trash"></i></button>
                </div>
            </div>
            <div class="kr-content">
                <h3 class="kr-title">New Key Result - Click edit to customize</h3>
                <div class="kr-meta">
                    <span class="meta-item"><strong>Baseline:</strong> TBD</span>
                    <span class="meta-item"><strong>Owner:</strong> Unassigned</span>
                </div>
            </div>
        `;

        krList.appendChild(newKr);
        showSuccessFeedback('Key Result added');
    });

    newObjective.querySelector('.btn-delete').addEventListener('click', () => {
        if (confirm('Delete this entire Objective and all its Key Results?')) {
            newObjective.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => newObjective.remove(), 300);
            showSuccessFeedback('Objective deleted');
        }
    });

    showSuccessFeedback('New Objective added');
});

// Checkbox pills interaction
document.querySelectorAll('.checkbox-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
        const checkbox = pill.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        pill.classList.toggle('checked');
    });
});

// Continue to KPI Assignment
document.getElementById('continue-to-kpi')?.addEventListener('click', () => {
    window.location.href = 'kpi-assignment.html';
});

// Skip to Benchmark Comparison
document.getElementById('skip-kpi')?.addEventListener('click', () => {
    window.location.href = 'benchmark-comparison.html';
});

// Delete Objective
document.querySelectorAll('.objective-section .btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this entire Objective and all its Key Results?')) {
            const section = btn.closest('.objective-section');
            section.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => section.remove(), 300);
            showSuccessFeedback('Objective deleted');
        }
    });
});

// Initialize - hide modals on load
if (editObjectiveModal) editObjectiveModal.style.display = 'none';
if (editKrModal) editKrModal.style.display = 'none';
