// KPI Assignment Interactive Functionality

// Modal Management
const addKpiModal = document.getElementById('add-kpi-modal');
const closeBtns = document.querySelectorAll('.close-btn, .close-modal-btn');
let currentKpiSection = null;

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

// Close modal handlers
closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (addKpiModal) addKpiModal.style.display = 'none';
        currentKpiSection = null;
    });
});

// Close on overlay click
if (addKpiModal) {
    addKpiModal.addEventListener('click', (e) => {
        if (e.target === addKpiModal) {
            addKpiModal.style.display = 'none';
            currentKpiSection = null;
        }
    });
}

// KPI Checkbox Toggle
document.querySelectorAll('.kpi-card input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
        const card = e.target.closest('.kpi-card');
        if (e.target.checked) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
        updateKpiCount();
    });
});

// Add KPI Button
document.querySelectorAll('.add-kpi-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentKpiSection = e.target.closest('.kpi-section');
        if (addKpiModal) {
            // Clear previous values
            addKpiModal.querySelectorAll('input').forEach(input => input.value = '');
            addKpiModal.querySelector('textarea').value = '';
            addKpiModal.querySelector('select').selectedIndex = 1; // Default to Supporting
            addKpiModal.style.display = 'flex';
        }
    });
});

// Save New KPI - Actually add it to the DOM
addKpiModal?.querySelector('.btn-primary')?.addEventListener('click', () => {
    const kpiName = addKpiModal.querySelector('input[type="text"]').value;
    const kpiDesc = addKpiModal.querySelector('textarea').value;
    const kpiType = addKpiModal.querySelector('select').value;

    if (!kpiName.trim()) {
        alert('Please enter a KPI name');
        return;
    }

    if (currentKpiSection) {
        const kpiGrid = currentKpiSection.querySelector('.kpi-grid');
        const kpiCount = kpiGrid.querySelectorAll('.kpi-card').length + 1;

        // Determine tag class based on type
        let tagClass = 'tag-gray';
        let tagLabel = 'Supporting';
        if (kpiType === 'Primary') {
            tagClass = 'tag-blue';
            tagLabel = 'Primary';
        } else if (kpiType === 'Optional') {
            tagClass = 'tag-outline';
            tagLabel = 'Optional';
        }

        // Create new KPI card
        const newKpiCard = document.createElement('div');
        newKpiCard.className = 'kpi-card active';
        newKpiCard.style.animation = 'slideIn 0.3s ease-out';
        newKpiCard.innerHTML = `
            <div class="kpi-header">
                <input type="checkbox" checked id="kpi-custom-${kpiCount}">
                <label for="kpi-custom-${kpiCount}"><strong>${kpiName}</strong></label>
                <button class="btn-icon"><i class="ph ph-gear"></i></button>
            </div>
            <p class="kpi-desc">${kpiDesc || 'No description provided'}</p>
            <div class="kpi-meta">
                <span class="tag ${tagClass}">${tagLabel}</span>
                <span class="tag" style="background: #FEF3C7; color: #92400E;">Custom</span>
            </div>
        `;

        kpiGrid.appendChild(newKpiCard);

        // Attach checkbox listener
        newKpiCard.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
            if (e.target.checked) {
                newKpiCard.classList.add('active');
            } else {
                newKpiCard.classList.remove('active');
            }
            updateKpiCount();
        });

        // Attach gear button listener
        newKpiCard.querySelector('.btn-icon').addEventListener('click', () => {
            alert('KPI settings would open here:\n\n- Configure thresholds\n- Set measurement frequency\n- Define data source\n- Customize alerts');
        });

        showSuccessFeedback(`KPI "${kpiName}" added successfully!`);
        updateKpiCount();
    }

    addKpiModal.style.display = 'none';
    currentKpiSection = null;
});

// KPI Settings (Gear Icon)
document.querySelectorAll('.kpi-card .btn-icon').forEach(btn => {
    btn.addEventListener('click', () => {
        alert('KPI settings would open here:\n\n- Configure thresholds\n- Set measurement frequency\n- Define data source\n- Customize alerts');
    });
});

// Continue to Benchmark Comparison
document.getElementById('continue-to-benchmark')?.addEventListener('click', () => {
    // Count selected KPIs
    const selectedKpis = document.querySelectorAll('.kpi-card input[type="checkbox"]:checked').length;

    if (selectedKpis === 0) {
        alert('Please select at least one KPI before continuing.');
        return;
    }

    window.location.href = 'benchmark-comparison.html';
});

// Skip to Measurement Framework
document.getElementById('skip-benchmark')?.addEventListener('click', () => {
    const selectedKpis = document.querySelectorAll('.kpi-card input[type="checkbox"]:checked').length;

    if (selectedKpis === 0) {
        alert('Please select at least one KPI before continuing.');
        return;
    }

    window.location.href = 'measurement-framework.html';
});

// Initialize - hide modal on load
if (addKpiModal) addKpiModal.style.display = 'none';

// Real-time KPI count update
function updateKpiCount() {
    const totalKpis = document.querySelectorAll('.kpi-card input[type="checkbox"]:checked').length;
    const primaryKpis = document.querySelectorAll('.kpi-card.active .tag-blue').length;
    const supportingKpis = document.querySelectorAll('.kpi-card.active .tag-gray').length;

    // Update stats if they exist
    const stats = document.querySelectorAll('.stat-value');
    if (stats.length >= 2) {
        stats[1].textContent = totalKpis;
        if (stats.length >= 4) {
            stats[2].textContent = primaryKpis;
            stats[3].textContent = supportingKpis;
        }
    }
}

// Listen for checkbox changes
document.querySelectorAll('.kpi-card input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', updateKpiCount);
});
