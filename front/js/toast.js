export function showToast(message, type = 'info', duration = 4000) {

    const container = document.getElementById('toast-container');

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = icons[type] || icons.info;

    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fermer');

    const removeToast = () => {
        toast.remove();
    };

    close.addEventListener('click', removeToast);

    toast.append(icon, text, close);
    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
}