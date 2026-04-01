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

    const modalCaption = document.getElementById('modal-caption');

    if (imageModal && modalImage && closeImageModal) {
        // Use capture phase so we intercept BEFORE the native <summary> toggle fires.
        document.body.addEventListener('click', (e) => {
            const img = e.target.closest('img.thumbnail-img-inline');
            if (img) {
                const src = img.getAttribute('src');
                const alt = img.getAttribute('alt');

                // Prevent details from toggling
                if (img.closest('summary')) {
                    e.preventDefault();
                }

                if (src) {
                    modalImage.src = src;
                    modalImage.alt = alt || 'Enlarged Image';
                    if (modalCaption) {
                        modalCaption.textContent = alt || '';
                    }
                    
                    // Lock scrolling
                    document.body.style.overflow = 'hidden';
                    imageModal.showModal();
                }
            }
        }, true);

        const closeModalFunc = () => {
            // Unlock scrolling
            document.body.style.overflow = '';
            
            imageModal.close();
            setTimeout(() => { 
                modalImage.src = ''; 
                if (modalCaption) modalCaption.textContent = '';
            }, 300);
        };

        closeImageModal.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModalFunc();
        });

        // Close on backdrop click
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeModalFunc();
            }
        });
    }

    // Document Carousel Logic
    window.initCarousels = function() {
        const containers = document.querySelectorAll('.document-carousel-container');
        containers.forEach(container => {
            // Prevent double initialization
            if (container.dataset.initialized) return;
            container.dataset.initialized = "true";

            const track = container.querySelector('.document-carousel');
            const btnPrev = container.querySelector('.carousel-nav.prev');
            const btnNext = container.querySelector('.carousel-nav.next');
            const dots = container.querySelectorAll('.pagination-dot');

            if (!track || !btnPrev || !btnNext) return;

            const updateDots = () => {
                const index = Math.round(track.scrollLeft / track.offsetWidth);
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i === index);
                });
            };

            btnPrev.addEventListener('click', () => {
                track.scrollBy({ left: -track.offsetWidth, behavior: 'smooth' });
            });

            btnNext.addEventListener('click', () => {
                track.scrollBy({ left: track.offsetWidth, behavior: 'smooth' });
            });

            track.addEventListener('scroll', updateDots);
            
            // Initial dot state
            updateDots();
        });
    };

    // Team Profile Modal Logic
    window.initTeamModals = function() {
        const teamModal = document.getElementById('team-modal');
        const modalImg = document.getElementById('modal-img');
        const modalName = document.getElementById('modal-name');
        const modalMajor = document.getElementById('modal-major');
        const modalMinor = document.getElementById('modal-minor');
        const modalYear = document.getElementById('modal-year');
        const closeBtn = document.querySelector('.modal-close-btn');

        if (!teamModal) return;

        const teamCards = document.querySelectorAll('.team-card');
        teamCards.forEach(card => {
            card.addEventListener('click', () => {
                const { name, major, minor, year, img } = card.dataset;
                
                if (modalImg) {
                    modalImg.src = img;
                    modalImg.alt = name;
                }
                if (modalName) modalName.textContent = name;
                if (modalMajor) modalMajor.textContent = major;
                if (modalMinor) {
                    modalMinor.textContent = minor;
                    modalMinor.style.display = minor ? 'block' : 'none';
                }
                if (modalYear) modalYear.textContent = year;

                teamModal.showModal();
            });

            // Keyboard support
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `View profile of ${card.dataset.name}`);
        });

        const closeModal = () => {
            teamModal.classList.add('closing');
            teamModal.close();
            teamModal.classList.remove('closing');
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        // Close on backdrop click
        teamModal.addEventListener('click', (e) => {
            if (e.target === teamModal) {
                closeModal();
            }
        });
    };

    initCarousels();
    initTeamModals();
});
