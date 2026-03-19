document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Logic ---
    const adminTrigger = document.getElementById('admin-login-trigger');
    const loginModal = document.getElementById('login-modal');
    const closeLoginDialog = document.getElementById('close-login-dialog');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const adminSection = document.getElementById('admin-section');
    
    // Check if already logged in via Session Storage
    const isLoggedIn = sessionStorage.getItem('rwexhibit_admin_logged_in') === 'true';
    if (isLoggedIn) {
        enableAdminMode();
    }

    if (closeLoginDialog && loginModal) {
        closeLoginDialog.addEventListener('click', () => {
            loginModal.close();
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            // Hardcoded Credentials requested by client
            if (email === 'ally.jacobs@vanderbilt.edu' && password === 'allyjacobs') {
                sessionStorage.setItem('rwexhibit_admin_logged_in', 'true');
                loginModal.close();
                enableAdminMode();
                loadMaterials(); // Re-render to show delete buttons
            } else {
                loginError.style.display = 'block';
            }
        });
    }

    function enableAdminMode() {
        if(adminSection) {
            adminSection.classList.remove('hidden');
        }
        if (adminTrigger) {
            adminTrigger.textContent = 'Logout';
        }
    }

    function disableAdminMode() {
        if(adminSection) {
            adminSection.classList.add('hidden');
        }
        if (adminTrigger) {
            adminTrigger.textContent = 'Admin';
        }
        sessionStorage.removeItem('rwexhibit_admin_logged_in');
        loadMaterials();
    }

    if (adminTrigger) {
        adminTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            const isLoggedInNow = sessionStorage.getItem('rwexhibit_admin_logged_in') === 'true';
            
            if (isLoggedInNow) {
                disableAdminMode();
            } else {
                loginError.style.display = 'none';
                loginForm.reset();
                loginModal.showModal();
            }
        });
    }

    // --- Data Fetching and Rendering ---
    const materialsContainer = document.getElementById('materials-container');
    const uploadForm = document.getElementById('upload-form');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadStatus = document.getElementById('upload-status');

    function loadMaterials() {
        if (!materialsContainer) return;
        
        fetch('/api/materials')
            .then(response => {
                if(!response.ok) throw new Error('Not found or server error');
                return response.json();
            })
            .then(data => {
                renderMaterials(data);
            })
            .catch(error => {
                console.error('Error fetching materials:', error);
                materialsContainer.innerHTML = '<p class="status-error" style="grid-column: 1/-1;">Could not load materials. Ensure the python server is running.</p>';
            });
    }

    function renderMaterials(materials) {
        materialsContainer.innerHTML = ''; // Clear loading text

        if (materials.length === 0) {
            materialsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-secondary-dark-gray);">No materials have been added recently.</p>';
            return;
        }

        const isAdmin = sessionStorage.getItem('rwexhibit_admin_logged_in') === 'true';

        materials.forEach(item => {
            const card = document.createElement('article');
            card.className = 'material-card';

            const dateStr = new Date(item.timestamp * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Delete button mapping
            let deleteBtnHTML = '';
            if (isAdmin) {
                deleteBtnHTML = `<button class="btn-delete" data-id="${item.id}" aria-label="Delete ${item.title}">&times;</button>`;
            }

            const isPdf = item.imagePath.toLowerCase().endsWith('.pdf');
            
            let mediaHTML = '';
            if (isPdf) {
                mediaHTML = `
                    <a href="../${item.imagePath}" target="_blank" style="text-decoration: none; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-primary-black);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 10px;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <span style="font-family: var(--font-body); font-weight: bold;">View PDF</span>
                    </a>
                `;
            } else {
                mediaHTML = `<img src="../${item.imagePath}" alt="${item.title}" class="material-image thumbnail-img-inline">`;
            }

            card.innerHTML = `
                ${deleteBtnHTML}
                <div class="material-image-container">
                    ${mediaHTML}
                </div>
                <div class="material-content">
                    <h3 class="material-title">${item.title}</h3>
                    <div class="material-date">Added on ${dateStr}</div>
                </div>
            `;
            materialsContainer.appendChild(card);
        });

        // Attach delete event listeners
        if (sessionStorage.getItem('rwexhibit_admin_logged_in') === 'true') {
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', handleDelete);
            });
        }
    }

    // --- Upload Logic ---
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById('material-title').value;
            const fileInput = document.getElementById('material-image').files[0];

            if (!titleInput || !fileInput) return;

            const formData = new FormData();
            formData.append('title', titleInput);
            formData.append('image', fileInput);

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            uploadStatus.textContent = '';
            uploadStatus.className = 'status-message';

            fetch('/api/materials', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Upload failed');
                }
                return response.json();
            })
            .then(data => {
                uploadForm.reset();
                uploadStatus.textContent = 'Material uploaded successfully!';
                uploadStatus.classList.add('status-success');
                loadMaterials(); // Refresh list
                
                setTimeout(() => {
                    uploadStatus.textContent = '';
                    uploadStatus.classList.remove('status-success');
                }, 4000);
            })
            .catch(error => {
                console.error('Upload Error:', error);
                uploadStatus.textContent = 'Error uploading material. Please try again.';
                uploadStatus.classList.add('status-error');
            })
            .finally(() => {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Material';
            });
        });
    }

    // --- Delete Logic ---
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    console.log("Delete modal found:", deleteConfirmModal);
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    let materialIdToDelete = null;

    if (cancelDeleteBtn && deleteConfirmModal) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteConfirmModal.close();
        });
    }

    if (confirmDeleteBtn && deleteConfirmModal) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (!materialIdToDelete) return;

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Deleting...';

            fetch(`/api/materials/${materialIdToDelete}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) throw new Error('Delete failed');
                loadMaterials();
                deleteConfirmModal.close();
            })
            .catch(error => {
                console.error('Delete Error:', error);
                alert("Failed to delete material.");
            })
            .finally(() => {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Delete';
                materialIdToDelete = null;
            });
        });
    }

    function handleDelete(e) {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id || !deleteConfirmModal) return;

        materialIdToDelete = id;
        deleteConfirmModal.showModal();
    }

    // --- Global Image Modal Overlay Overrides ---
    // Specifically because image modal logic is usually bound in main.js,
    // we just make sure .thumbnail-img-inline works. Since it attaches to document.body in main.js
    // it will automatically work here as I set class="material-image thumbnail-img-inline"

    // Load materials on initialization
    loadMaterials();
});
