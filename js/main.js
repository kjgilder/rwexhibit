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

    // Global Image Modal Logic
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModal = document.getElementById('close-image-modal');

    if (imageModal && modalImage && closeImageModal) {
        // Use event delegation for dynamically injected HTML (Timeline)
        document.body.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('thumbnail-img-inline')) {
                const src = e.target.getAttribute('src');
                const alt = e.target.getAttribute('alt');

                if (src) {
                    modalImage.src = src;
                    modalImage.alt = alt || "Enlarged Image";
                    imageModal.showModal();
                }
            }
        });

        closeImageModal.addEventListener('click', () => {
            imageModal.close();
            // Clear src slightly after transition to avoid flicker
            setTimeout(() => { modalImage.src = ''; }, 300);
        });

        // Close on backdrop click
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.close();
                setTimeout(() => { modalImage.src = ''; }, 300);
            }
        });

        // Add keyboard support (Escape key is handled natively by <dialog>, we handle enter/space on the close button natively too)
    }
});
