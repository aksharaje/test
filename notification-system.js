// Enhanced Notification System
// Provides better feedback to users with icons, colors, and actions

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.id = 'notificationContainer';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 3000, options = {}) {
        const id = Date.now();
        const notification = this.createNotification(id, message, type, options);

        this.container.appendChild(notification);
        this.notifications.push({ id, element: notification });

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(id), duration);
        }

        return id;
    }

    createNotification(id, message, type, options) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('data-notification-id', id);
        notification.style.cssText = `
            background: ${this.getBackgroundColor(type)};
            color: ${this.getTextColor(type)};
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 400px;
            opacity: 0;
            transform: translateX(100px);
            transition: all 0.3s ease;
            cursor: pointer;
        `;

        // Icon
        const icon = document.createElement('i');
        icon.className = `ph ${this.getIcon(type)}`;
        icon.style.cssText = `
            font-size: 24px;
            flex-shrink: 0;
        `;

        // Content
        const content = document.createElement('div');
        content.style.cssText = 'flex: 1; font-size: 14px; line-height: 1.4;';

        if (options.title) {
            const title = document.createElement('div');
            title.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
            title.textContent = options.title;
            content.appendChild(title);
        }

        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        content.appendChild(messageEl);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="ph ph-x"></i>';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            opacity: 0.6;
            transition: opacity 0.2s;
        `;
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.6';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.dismiss(id);
        };

        notification.appendChild(icon);
        notification.appendChild(content);
        notification.appendChild(closeBtn);

        // Click to dismiss
        notification.onclick = () => this.dismiss(id);

        return notification;
    }

    dismiss(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return;

        notification.element.classList.remove('show');
        notification.element.style.opacity = '0';
        notification.element.style.transform = 'translateX(100px)';

        setTimeout(() => {
            notification.element.remove();
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 300);
    }

    dismissAll() {
        this.notifications.forEach(n => this.dismiss(n.id));
    }

    getBackgroundColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    getTextColor(type) {
        return '#ffffff';
    }

    getIcon(type) {
        const icons = {
            success: 'ph-check-circle',
            error: 'ph-x-circle',
            warning: 'ph-warning',
            info: 'ph-info'
        };
        return icons[type] || icons.info;
    }
}

// Global instance
const notify = new NotificationSystem();

// Backwards compatible global function
window.showNotification = function(message, type = 'info') {
    notify.show(message, type);
};
