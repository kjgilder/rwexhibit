document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Logic ---
    const adminTrigger = document.getElementById('admin-login-trigger');
    const loginModal = document.getElementById('login-modal');
    const closeLoginDialog = document.getElementById('close-login-dialog');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const adminSection = document.getElementById('admin-section');
    const reorderHint = document.getElementById('reorder-hint');
    
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

            if (email === 'ally.jacobs@vanderbilt.edu' && password === 'allyjacobs') {
                sessionStorage.setItem('rwexhibit_admin_logged_in', 'true');
                loginModal.close();
                enableAdminMode();
                loadMaterials();
            } else {
                loginError.style.display = 'block';
            }
        });
    }

    function enableAdminMode() {
        if(adminSection) adminSection.classList.remove('hidden');
        if(reorderHint) reorderHint.classList.remove('hidden');
        if (adminTrigger) adminTrigger.textContent = 'Logout';
    }

    function disableAdminMode() {
        if(adminSection) adminSection.classList.add('hidden');
        if(reorderHint) reorderHint.classList.add('hidden');
        if (adminTrigger) adminTrigger.textContent = 'Admin';
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

    // --- State & Constants ---
    // In production (Vercel), we use relative paths. Locally, we use the server port.
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000' 
        : '';
    
    // Helper to format media path (handles both local relative paths and remote Vercel Blob URLs)
    function formatPath(path) {
        if (!path) return '';
        const trimmedPath = path.trim();
        // If it's an absolute URL (starts with http), return it directly
        if (trimmedPath.startsWith('http')) return trimmedPath;
        
        // Ensure no double slashes when prepending API_BASE
        const cleanPath = trimmedPath.startsWith('/') ? trimmedPath.slice(1) : trimmedPath;
        return API_BASE ? `${API_BASE}/${cleanPath}` : `/${cleanPath}`;
    }

    const materialsContainer = document.getElementById('materials-container');
    const uploadForm = document.getElementById('upload-form');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('material-image');
    const stagingArea = document.getElementById('file-staging-area');
    const uploadStatus = document.getElementById('upload-status');
    
    let stagedFiles = [];
    let materialsList = []; // Kept in memory for editing
    let sortableInstance = null;

    // --- Loading & Rendering ---
    function loadMaterials() {
        if (!materialsContainer) return;
        
        fetch(`${API_BASE}/api/materials`)
            .then(res => res.json())
            .then(data => {
                materialsList = data; // Save to global state
                renderMaterials(data);
                if (sessionStorage.getItem('rwexhibit_admin_logged_in') === 'true') {
                    initSortable();
                }
            })
            .catch(err => {
                console.error('Error loading materials:', err);
                materialsContainer.innerHTML = '<p class="status-error">Could not load materials. Ensure server is running or cloud storage is configured.</p>';
            });
    }

    function renderMaterials(materials) {
        materialsContainer.innerHTML = ''; 
        if (materials.length === 0) {
            materialsContainer.innerHTML = '<p style="grid-column:1/-1; text-align:center;">No materials found.</p>';
            return;
        }

        const isAdmin = sessionStorage.getItem('rwexhibit_admin_logged_in') === 'true';

        materials.forEach(item => {
            const card = document.createElement('article');
            card.className = 'material-card';
            card.dataset.id = item.id;

            const items = item.items || [];
            let mediaHTML = '';

            if (items.length === 1) {
                const doc = items[0];
                const isPdf = doc.path.toLowerCase().endsWith('.pdf');
                mediaHTML = isPdf 
                    ? `<a href="${formatPath(doc.path)}" target="_blank" class="pdf-link-placeholder">
                        <svg viewBox="0 0 24 24" width="64" height="64" style="fill:none; stroke:currentColor; stroke-width:2;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>View PDF</span>
                      </a>`
                    : `<img src="${formatPath(doc.path)}" class="material-image thumbnail-img-inline">`;
            } else if (items.length > 1) {
                mediaHTML = `
                    <div class="document-carousel-container" style="height:100%">
                        <div class="carousel-track">
                            ${items.map(it => `
                                <div class="carousel-slide">
                                    ${it.path.toLowerCase().endsWith('.pdf') 
                                        ? `<iframe src="${formatPath(it.path)}#view=FitW"></iframe>` 
                                        : `<img src="${formatPath(it.path)}" class="thumbnail-img-inline">`}
                                </div>
                            `).join('')}
                        </div>
                        <button class="carousel-btn prev" aria-label="Previous" type="button">&#10094;</button>
                        <button class="carousel-btn next" aria-label="Next" type="button">&#10095;</button>
                        <div class="carousel-dots">
                            ${items.map((_, i) => `<span class="dot ${i===0?'active':''}" data-index="${i}"></span>`).join('')}
                        </div>
                    </div>
                `;
            }

            const currentDesc = items[0]?.description || "";

            card.innerHTML = `
                ${isAdmin ? `
                    <div class="admin-card-actions">
                        <div class="drag-handle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
                        <button class="btn-edit" data-id="${item.id}" title="Edit metadata">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-delete" data-id="${item.id}" title="Delete">&times;</button>
                    </div>
                ` : ''}
                <div class="material-image-container">${mediaHTML}</div>
                <div class="material-content">
                    <h3 class="material-title">${item.title}</h3>
                    <div class="material-date">Added on ${new Date(item.timestamp*1000).toLocaleDateString()}</div>
                    <p class="material-description" id="desc-${item.id}">${currentDesc}</p>
                </div>
            `;
            materialsContainer.appendChild(card);

            if (items.length > 1) {
                initCarousel(card.querySelector('.document-carousel-container'), items, card.querySelector(`#desc-${item.id}`));
            }
        });

        if (isAdmin) {
            document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', handleDelete));
            document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', handleEdit));
        }
    }

    // --- Carousel Logic ---
    function initCarousel(container, items, descElement) {
        if (!container || !items || items.length === 0) return;
        const track = container.querySelector('.carousel-track');
        const dots = container.querySelectorAll('.dot');
        let index = 0;

        const update = () => {
            track.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach((d, i) => d.classList.toggle('active', i === index));
            if (descElement) {
                descElement.textContent = items[index].description || ""; 
            }
        };

        container.querySelector('.next').addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault(); index = (index+1) % items.length; update();
        });
        container.querySelector('.prev').addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault(); index = (index-1+items.length) % items.length; update();
        });
        dots.forEach(d => d.addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault(); index = parseInt(d.dataset.index); update();
        }));
    }

    // --- Staging Area Management ---
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files);
            files.forEach(f => {
                stagedFiles.push({
                    file: f,
                    id: Math.random().toString(36).substr(2, 9),
                    description: ""
                });
            });
            fileInput.value = ""; 
            renderStaging();
        });
    }

    function renderStaging() {
        if (!stagingArea) return;
        stagingArea.innerHTML = '';
        
        stagedFiles.forEach(sf => {
            const row = document.createElement('div');
            row.className = 'staged-file-card';
            
            const isImage = sf.file.type.startsWith('image/');
            const thumbHTML = isImage 
                ? `<img src="${URL.createObjectURL(sf.file)}">`
                : `<svg viewBox="0 0 24 24" style="fill:none; stroke:currentColor; stroke-width:2;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

            row.innerHTML = `
                <div class="staged-thumb">${thumbHTML}</div>
                <div class="staged-info">
                    <div class="staged-filename">${sf.file.name}</div>
                    <input type="text" class="staged-desc-input" placeholder="Item description" value="${sf.description}" data-id="${sf.id}">
                </div>
                <button type="button" class="btn-remove-staged" data-id="${sf.id}">&times;</button>
            `;
            stagingArea.appendChild(row);
        });

        const btnCount = uploadBtn.querySelector('span');
        if (btnCount) btnCount.textContent = `(${stagedFiles.length} files)`;

        stagingArea.querySelectorAll('.staged-desc-input').forEach(inp => {
            inp.addEventListener('input', e => {
                const sf = stagedFiles.find(s => s.id === e.target.dataset.id);
                if (sf) sf.description = e.target.value;
            });
        });
        stagingArea.querySelectorAll('.btn-remove-staged').forEach(btn => {
            btn.addEventListener('click', () => {
                stagedFiles = stagedFiles.filter(s => s.id !== btn.dataset.id);
                renderStaging();
            });
        });
    }

    // --- Upload ---
    if (uploadForm) {
        uploadForm.addEventListener('submit', async e => {
            e.preventDefault();
            const title = document.getElementById('material-title').value;
            if (!title || stagedFiles.length === 0) return;

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            
            const formData = new FormData();
            formData.append('title', title);
            
            stagedFiles.forEach((sf, i) => {
                formData.append('image', sf.file);
                formData.append(`desc_${i}`, sf.description);
            });

            try {
                const res = await fetch(`${API_BASE}/api/materials`, { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload failed');
                uploadForm.reset();
                stagedFiles = [];
                renderStaging();
                uploadStatus.textContent = 'Uploaded Successfully!';
                loadMaterials();
                setTimeout(() => uploadStatus.textContent = '', 3000);
            } catch (err) {
                console.error(err);
                uploadStatus.textContent = 'Upload failed.';
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = 'Upload Material <span>(0 files)</span>';
            }
        });
    }

    // --- Edit Mode ---
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const editItemsContainer = document.getElementById('edit-items-container');
    const closeEditModalBtn = document.getElementById('close-edit-modal');
    let currentEditId = null;

    function handleEdit(e) {
        const id = e.currentTarget.dataset.id;
        const item = materialsList.find(m => m.id === id);
        if (!item) return;

        currentEditId = id;
        document.getElementById('edit-title').value = item.title;
        
        editItemsContainer.innerHTML = '';
        item.items.forEach((it, idx) => {
            const row = document.createElement('div');
            row.className = 'staged-file-card';
            row.style.gridTemplateColumns = '60px 1fr';
            row.style.marginBottom = '10px';

            const isPdf = it.path.toLowerCase().endsWith('.pdf');
            const thumbHTML = isPdf 
                ? `<svg viewBox="0 0 24 24" width="24" height="24" style="fill:none; stroke:currentColor; stroke-width:1;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
                : `<img src="${formatPath(it.path)}" style="width:100%; height:100%; object-fit:cover;">`;

            row.innerHTML = `
                <div class="staged-thumb" style="width:60px; height:45px;">${thumbHTML}</div>
                <div class="staged-info">
                    <textarea class="edit-item-desc" data-index="${idx}" style="width:100%; min-height:60px; padding:8px; border-radius:4px; border:1px solid #ddd; font-family:var(--font-body); font-size:0.85rem;">${it.description || ""}</textarea>
                </div>
            `;
            editItemsContainer.appendChild(row);
        });

        editModal.showModal();
    }

    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => editModal.close());

    if (editForm) {
        editForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentEditId) return;

            const saveBtn = document.getElementById('save-edit-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const updatedItems = Array.from(editItemsContainer.querySelectorAll('.edit-item-desc')).map(ta => ({
                index: parseInt(ta.dataset.index),
                description: ta.value
            }));

            const payload = {
                title: document.getElementById('edit-title').value,
                items: updatedItems
            };

            try {
                const url = `${API_BASE}/api/materials?id=${encodeURIComponent(currentEditId)}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const statusMsg = document.createElement('div');
                    statusMsg.textContent = 'Changes saved successfully!';
                    statusMsg.style.cssText = 'color:green; text-align:center; margin-bottom:10px; font-weight:bold;';
                    editForm.prepend(statusMsg);
                    
                    setTimeout(() => {
                        editModal.close();
                        loadMaterials();
                    }, 1000);
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    const msg = errorData.error || "Unknown server error";
                    alert(`Failed to save changes: ${msg}`);
                }
            } catch (err) { 
                console.error(err); 
                alert(`Error saving changes: ${err.message}`);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        });
    }

    // --- SortableJS ---
    function initSortable() {
        if (typeof Sortable === 'undefined') {
            console.warn('SortableJS library not loaded');
            return;
        }
        if (sortableInstance) sortableInstance.destroy();
        
        sortableInstance = Sortable.create(materialsContainer, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: () => {
                const url = `${API_BASE}/api/materials?action=reorder`;
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ids)
                }).catch(err => console.error(err));
            }
        });
    }

    // --- Delete ---
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    let deleteId = null;

    function handleDelete(e) {
        deleteId = e.currentTarget.dataset.id;
        deleteConfirmModal.showModal();
    }
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.close());

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!deleteId) return;
            try {
                const url = `${API_BASE}/api/materials?id=${encodeURIComponent(deleteId)}`;
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    deleteConfirmModal.close();
                    loadMaterials();
                }
            } catch (err) { console.error(err); }
        });
    }

    loadMaterials();
});
