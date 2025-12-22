// Chart initialization for Measurement Framework visualizations
// Uses Chart.js to create interactive preview charts

// Wait for DOM and Chart.js to be ready
window.addEventListener('DOMContentLoaded', () => {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded. Charts will not be displayed.');
        return;
    }

    // Set global chart defaults
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#6b7280';
    Chart.defaults.plugins.legend.display = true;
    Chart.defaults.plugins.legend.position = 'bottom';

    // Initialize all charts
    initLoginSuccessChart();
    initActivationFunnelChart();
    initSupportTicketsChart();
});

// 1. Login Success Rate - Line Chart with Device Segmentation
function initLoginSuccessChart() {
    const canvas = document.getElementById('loginSuccessChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Generate sample data for last 30 days
    const labels = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    // Simulate data with upward trend toward 95% target
    const generateTrendData = (start, target, variance) => {
        return labels.map((_, i) => {
            const progress = i / (labels.length - 1);
            const trend = start + (target - start) * progress;
            const noise = (Math.random() - 0.5) * variance;
            return Math.max(0, Math.min(100, trend + noise));
        });
    };

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'iOS',
                    data: generateTrendData(85, 95, 3),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Android',
                    data: generateTrendData(84, 94, 3.5),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Web',
                    data: generateTrendData(88, 96, 2.5),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Commit Target (95%)',
                    data: Array(labels.length).fill(95),
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Login Success Rate - 30 Day Trend (7-day rolling average)',
                    font: {
                        size: 14,
                        weight: '600'
                    },
                    color: '#1f2937',
                    padding: {
                        bottom: 20
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    bodySpacing: 6,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 80,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// 2. Activation Rate - Funnel Chart (using horizontal bar chart)
function initActivationFunnelChart() {
    const canvas = document.getElementById('activationFunnelChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Funnel stages with conversion data
    const stages = [
        'Sign Up Complete',
        'Profile Created',
        'First Action',
        'Second Action',
        'Activated (D0)'
    ];

    const values = [100, 82, 68, 61, 55]; // Percentages showing funnel drop-off
    const users = [10000, 8200, 6800, 6100, 5500]; // Actual user counts

    // Generate colors with gradient effect
    const colors = [
        'rgba(16, 185, 129, 0.9)',
        'rgba(16, 185, 129, 0.75)',
        'rgba(16, 185, 129, 0.6)',
        'rgba(16, 185, 129, 0.45)',
        'rgba(16, 185, 129, 0.3)'
    ];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stages,
            datasets: [{
                label: 'Conversion Rate',
                data: values,
                backgroundColor: colors,
                borderColor: '#10b981',
                borderWidth: 2,
                barThickness: 50
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bars
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Activation Funnel - Step-by-Step Conversion',
                    font: {
                        size: 14,
                        weight: '600'
                    },
                    color: '#1f2937',
                    padding: {
                        bottom: 20
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const dropoff = index > 0 ? (values[index - 1] - values[index]).toFixed(1) : 0;
                            return [
                                'Conversion: ' + context.parsed.x.toFixed(1) + '%',
                                'Users: ' + users[index].toLocaleString(),
                                index > 0 ? 'Drop-off: ' + dropoff + '%' : ''
                            ].filter(Boolean);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// 3. Support Tickets - Stacked Bar Chart by Issue Type
function initSupportTicketsChart() {
    const canvas = document.getElementById('supportTicketsChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Last 12 weeks
    const labels = [];
    for (let i = 11; i >= 0; i--) {
        labels.push(`W${12 - i}`);
    }

    // Generate data showing downward trend toward target of 100 tickets/week
    const generateTicketData = (start, end, variance) => {
        return labels.map((_, i) => {
            const progress = i / (labels.length - 1);
            const trend = start + (end - start) * progress;
            const noise = (Math.random() - 0.5) * variance;
            return Math.max(0, trend + noise);
        });
    };

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Login Issues',
                    data: generateTicketData(50, 30, 8),
                    backgroundColor: '#667eea',
                    borderColor: '#667eea',
                    borderWidth: 1
                },
                {
                    label: 'Password Reset',
                    data: generateTicketData(40, 28, 6),
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'Account Access',
                    data: generateTicketData(35, 22, 5),
                    backgroundColor: '#f59e0b',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                },
                {
                    label: 'Other',
                    data: generateTicketData(25, 20, 4),
                    backgroundColor: '#ef4444',
                    borderColor: '#ef4444',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Support Tickets by Type - 12 Week Trend',
                    font: {
                        size: 14,
                        weight: '600'
                    },
                    color: '#1f2937',
                    padding: {
                        bottom: 20
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    bodySpacing: 6,
                    callbacks: {
                        footer: function(tooltipItems) {
                            let total = 0;
                            tooltipItems.forEach(item => {
                                total += item.parsed.y;
                            });
                            return 'Total: ' + Math.round(total) + ' tickets';
                        },
                        label: function(context) {
                            return context.dataset.label + ': ' + Math.round(context.parsed.y) + ' tickets';
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value;
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}
