/**
 * Workflow Data Management
 * Handles data persistence across PM workflow pages using localStorage
 */

const WorkflowData = {
    // Storage keys
    KEYS: {
        CONTEXT: 'pm_workflow_context',
        GOALS: 'pm_workflow_goals',
        OKRS: 'pm_workflow_okrs',
        KPIS: 'pm_workflow_kpis',
        BENCHMARKS: 'pm_workflow_benchmarks',
        MEASUREMENTS: 'pm_workflow_measurements',
        SCOPE: 'pm_workflow_scope'
    },

    /**
     * Save context data from goal setting page
     */
    saveContext(data) {
        try {
            localStorage.setItem(this.KEYS.CONTEXT, JSON.stringify({
                ...data,
                timestamp: new Date().toISOString()
            }));
            console.log('Context saved:', data);
        } catch (e) {
            console.error('Error saving context:', e);
        }
    },

    /**
     * Get context data
     */
    getContext() {
        try {
            const data = localStorage.getItem(this.KEYS.CONTEXT);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error getting context:', e);
            return null;
        }
    },

    /**
     * Save goals data
     */
    saveGoals(goals) {
        try {
            localStorage.setItem(this.KEYS.GOALS, JSON.stringify({
                goals,
                timestamp: new Date().toISOString()
            }));
            console.log('Goals saved:', goals);
        } catch (e) {
            console.error('Error saving goals:', e);
        }
    },

    /**
     * Get goals data
     */
    getGoals() {
        try {
            const data = localStorage.getItem(this.KEYS.GOALS);
            return data ? JSON.parse(data).goals : null;
        } catch (e) {
            console.error('Error getting goals:', e);
            return null;
        }
    },

    /**
     * Save OKRs data
     */
    saveOKRs(okrs) {
        try {
            localStorage.setItem(this.KEYS.OKRS, JSON.stringify({
                okrs,
                timestamp: new Date().toISOString()
            }));
            console.log('OKRs saved:', okrs);
        } catch (e) {
            console.error('Error saving OKRs:', e);
        }
    },

    /**
     * Get OKRs data
     */
    getOKRs() {
        try {
            const data = localStorage.getItem(this.KEYS.OKRS);
            return data ? JSON.parse(data).okrs : null;
        } catch (e) {
            console.error('Error getting OKRs:', e);
            return null;
        }
    },

    /**
     * Save KPIs data
     */
    saveKPIs(kpis) {
        try {
            localStorage.setItem(this.KEYS.KPIS, JSON.stringify({
                kpis,
                timestamp: new Date().toISOString()
            }));
            console.log('KPIs saved:', kpis);
        } catch (e) {
            console.error('Error saving KPIs:', e);
        }
    },

    /**
     * Get KPIs data
     */
    getKPIs() {
        try {
            const data = localStorage.getItem(this.KEYS.KPIS);
            return data ? JSON.parse(data).kpis : null;
        } catch (e) {
            console.error('Error getting KPIs:', e);
            return null;
        }
    },

    /**
     * Check if workflow has previous data
     */
    hasWorkflowData() {
        return !!this.getContext();
    },

    /**
     * Clear all workflow data
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('All workflow data cleared');
    },

    /**
     * Get workflow summary for display
     */
    getWorkflowSummary() {
        const context = this.getContext();
        const goals = this.getGoals();
        const okrs = this.getOKRs();

        return {
            hasData: !!context,
            context: context,
            goalsCount: goals ? goals.length : 0,
            okrsCount: okrs ? okrs.length : 0,
            lastUpdated: context ? context.timestamp : null
        };
    },

    /**
     * Display workflow banner on pages
     */
    showWorkflowBanner(containerId = 'workflow-banner-container') {
        const summary = this.getWorkflowSummary();

        if (!summary.hasData) {
            return; // No previous data, don't show banner
        }

        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const lastUpdated = new Date(summary.lastUpdated).toLocaleDateString();

        container.innerHTML = `
            <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="ph ph-info" style="font-size: 24px; color: #3b82f6;"></i>
                    <div>
                        <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px;">
                            Continuing Previous Workflow
                        </div>
                        <div style="font-size: 14px; color: #1e40af;">
                            Using data from ${summary.context.strategy || 'previous session'} • Last updated ${lastUpdated}
                        </div>
                    </div>
                </div>
                <button onclick="WorkflowData.startFresh()" class="btn-outline-sm" style="padding: 8px 16px; border: 1px solid #3b82f6; background: white; color: #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    <i class="ph ph-x"></i> Start Fresh
                </button>
            </div>
        `;
    },

    /**
     * Start fresh workflow (with confirmation)
     */
    startFresh() {
        if (confirm('Are you sure you want to start a new workflow? This will clear all previous data.')) {
            this.clearAll();
            window.location.reload();
        }
    }
};

// Make globally available
window.WorkflowData = WorkflowData;
