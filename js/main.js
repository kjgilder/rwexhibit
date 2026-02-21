document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.querySelector('.nav-toggle');
    const mainNav = document.querySelector('.main-nav');

    if (navToggle && mainNav) {
        navToggle.addEventListener('click', () => {
            const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', !isExpanded);
            mainNav.classList.toggle('active');
        });
    }

    // QR Dialog toggle
    const qrCard = document.getElementById('qr-card');
    const qrDialog = document.getElementById('qr-dialog');
    const closeDialog = document.getElementById('close-dialog');

    if (qrCard && qrDialog && closeDialog) {
        qrCard.addEventListener('click', () => {
            qrDialog.showModal();
        });
        
        // Also allow opening via keyboard (Enter or Space)
        qrCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                qrDialog.showModal();
            }
        });

        closeDialog.addEventListener('click', () => {
            qrDialog.close();
        });

        // Close on backdrop click
        qrDialog.addEventListener('click', (e) => {
            const dialogDimensions = qrDialog.getBoundingClientRect();
            if (
                e.clientX < dialogDimensions.left ||
                e.clientX > dialogDimensions.right ||
                e.clientY < dialogDimensions.top ||
                e.clientY > dialogDimensions.bottom
            ) {
                qrDialog.close();
            }
        });
    }
});
