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

    // QR Dialog toggle + QR scanning (camera)
    const qrCard = document.getElementById('qr-card');
    const qrDialog = document.getElementById('qr-dialog');
    const closeDialog = document.getElementById('close-dialog');
    const qrScanDialog = document.getElementById('qr-scan-dialog');
    const qrVideo = document.getElementById('qr-video');
    const qrScanStatus = document.getElementById('qr-scan-status');
    const closeQrScan = document.getElementById('close-qr-scan');

    let qrScanner = null;

    const stopQrScanner = () => {
        if (qrScanner) {
            qrScanner.stop();
            qrScanner.destroy();
            qrScanner = null;
        }
        if (qrVideo) {
            qrVideo.srcObject = null;
        }
    };

    const openQrScanner = async () => {
        if (!qrScanDialog || !qrVideo) return;

        if (!window.QrScanner) {
            if (qrScanStatus) {
                qrScanStatus.textContent = 'QR scanning is unavailable (scanner library not loaded).';
            }
            return;
        }

        if (qrScanStatus) {
            qrScanStatus.textContent = 'Requesting camera access...';
        }

        // Use the environment/back camera when available.
        qrScanner = new window.QrScanner(
            qrVideo,
            (result) => {
                const value = typeof result === 'string' ? result : result?.data;
                if (!value) return;

                const routeFromQrValue = (rawValue) => {
                    const trimmed = String(rawValue).trim();

                    // 1) Full URLs: follow them (same-app deep links can be encoded as normal URLs too).
                    if (/^https?:\/\//i.test(trimmed)) {
                        window.location.href = trimmed;
                        return true;
                    }

                    // 2) Year-only codes (e.g. "1864") route to timeline year.
                    if (/^\d{4}$/.test(trimmed)) {
                        window.location.href = `pages/timeline.html?year=${encodeURIComponent(trimmed)}`;
                        return true;
                    }

                    // 3) App deep links (recommended for your QR codes):
                    //    - rwe://home
                    //    - rwe://timeline?year=1864
                    //    - rwe://timeline
                    //    - rwe://recently-added
                    //    - rwe://about
                    // Also supports "rwe:timeline?year=1864"
                    const deep = trimmed.replace(/^rwe:/i, "rwe://");
                    if (/^rwe:\/\//i.test(deep)) {
                        try {
                            const u = new URL(deep);
                            const host = (u.host || "").toLowerCase();
                            const path = (u.pathname || "").replace(/^\/+/, "").toLowerCase();
                            const dest = host || path;

                            if (dest === "home") {
                                window.location.href = "index.html";
                                return true;
                            }
                            if (dest === "timeline") {
                                const year = u.searchParams.get("year");
                                window.location.href = year
                                    ? `pages/timeline.html?year=${encodeURIComponent(year)}`
                                    : "pages/timeline.html";
                                return true;
                            }
                            if (dest === "recently-added" || dest === "recentlyadded") {
                                window.location.href = "pages/recently-added.html";
                                return true;
                            }
                            if (dest === "about") {
                                window.location.href = "pages/about.html";
                                return true;
                            }
                        } catch {
                            // fall through to unknown handling
                        }
                    }

                    // 4) Relative paths inside the app (e.g. "pages/timeline.html?year=1864").
                    if (/^(index\.html|pages\/)/i.test(trimmed)) {
                        window.location.href = trimmed;
                        return true;
                    }

                    // 5) Key/value shorthand (e.g. "page=timeline&year=1864").
                    if (/^(page|route)=/i.test(trimmed)) {
                        try {
                            const params = new URLSearchParams(trimmed);
                            const page = (params.get("page") || params.get("route") || "").toLowerCase();
                            const year = params.get("year");
                            if (page === "timeline") {
                                window.location.href = year
                                    ? `pages/timeline.html?year=${encodeURIComponent(year)}`
                                    : "pages/timeline.html";
                                return true;
                            }
                            if (page === "about") {
                                window.location.href = "pages/about.html";
                                return true;
                            }
                            if (page === "recently-added" || page === "recentlyadded") {
                                window.location.href = "pages/recently-added.html";
                                return true;
                            }
                            if (page === "home") {
                                window.location.href = "index.html";
                                return true;
                            }
                        } catch {
                            // fall through
                        }
                    }

                    return false;
                };

                stopQrScanner();
                qrScanDialog.close();

                if (routeFromQrValue(value)) {
                    return;
                }

                // Unknown QR content: show it so staff can diagnose what the QR contains.
                if (qrScanStatus) {
                    qrScanStatus.textContent = `Unrecognized QR content: ${String(value).trim()}`;
                }
            },
            {
                preferredCamera: 'environment',
                highlightScanRegion: true,
                highlightCodeOutline: true,
            }
        );

        try {
            qrScanDialog.showModal();
            await qrScanner.start();
            if (qrScanStatus) {
                qrScanStatus.textContent = 'Point your camera at the QR code.';
            }
        } catch (err) {
            stopQrScanner();
            if (qrScanStatus) {
                qrScanStatus.textContent = 'Camera access was blocked. Please allow camera permissions and try again.';
            }
        }
    };

    if (qrCard && qrDialog && closeDialog) {
        qrCard.addEventListener('click', () => {
            // Prefer camera-based scanning on mobile app devices; fall back to the help dialog if needed.
            if (qrScanDialog && qrVideo) {
                openQrScanner();
            } else {
                qrDialog.showModal();
            }
        });

        // Also allow opening via keyboard (Enter or Space)
        qrCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (qrScanDialog && qrVideo) {
                    openQrScanner();
                } else {
                    qrDialog.showModal();
                }
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

    if (closeQrScan && qrScanDialog) {
        closeQrScan.addEventListener('click', () => {
            stopQrScanner();
            qrScanDialog.close();
        });
    }

    if (qrScanDialog) {
        // Ensure camera shuts off if the dialog is closed by other means.
        qrScanDialog.addEventListener('close', () => {
            stopQrScanner();
        });
    }

    // Global Image Modal Logic
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModal = document.getElementById('close-image-modal');

    const modalCaption = document.getElementById('modal-caption');
    const modalPrevBtn = document.getElementById('modal-prev-btn');
    const modalNextBtn = document.getElementById('modal-next-btn');

    let currentModalImages = [];
    let currentModalIndex = 0;

    function updateModalView() {
        if (currentModalImages.length === 0) return;
        const img = currentModalImages[currentModalIndex];
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt');
        const desc = img.getAttribute('data-desc');

        if (src) {
            modalImage.src = src;
            modalImage.alt = alt || 'Enlarged Image';
            if (modalCaption) {
                modalCaption.textContent = desc || alt || '';
            }
        }
        
        if (currentModalImages.length > 1) {
            if (modalPrevBtn) modalPrevBtn.style.display = 'block';
            if (modalNextBtn) modalNextBtn.style.display = 'block';
        } else {
            if (modalPrevBtn) modalPrevBtn.style.display = 'none';
            if (modalNextBtn) modalNextBtn.style.display = 'none';
        }
    }

    if (imageModal && modalImage && closeImageModal) {
        // Use capture phase so we intercept BEFORE the native <summary> toggle fires.
        document.body.addEventListener('click', (e) => {
            const img = e.target.closest('img.thumbnail-img-inline');
            if (img) {
                // Prevent details from toggling
                if (img.closest('summary')) {
                    e.preventDefault();
                }

                const card = img.closest('.material-card') || img.closest('.timeline-card');
                if (card) {
                    currentModalImages = Array.from(card.querySelectorAll('img.thumbnail-img-inline'));
                } else {
                    currentModalImages = [img];
                }
                
                currentModalIndex = currentModalImages.indexOf(img);
                if (currentModalIndex === -1) currentModalIndex = 0;

                updateModalView();
                
                // Lock scrolling
                document.body.style.overflow = 'hidden';
                imageModal.showModal();
            }
        }, true);

        if (modalPrevBtn) {
            modalPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentModalImages.length > 0) {
                    currentModalIndex = (currentModalIndex - 1 + currentModalImages.length) % currentModalImages.length;
                    updateModalView();
                }
            });
        }

        if (modalNextBtn) {
            modalNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentModalImages.length > 0) {
                    currentModalIndex = (currentModalIndex + 1) % currentModalImages.length;
                    updateModalView();
                }
            });
        }

        const closeModalFunc = () => {
            // Unlock scrolling
            document.body.style.overflow = '';
            
            imageModal.close();
            setTimeout(() => { 
                modalImage.src = ''; 
                if (modalCaption) modalCaption.textContent = '';
                currentModalImages = [];
                if (modalPrevBtn) modalPrevBtn.style.display = 'none';
                if (modalNextBtn) modalNextBtn.style.display = 'none';
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
