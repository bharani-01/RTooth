import { apiRequest, getUserProfile } from './api.js';

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
  let imagesData = [];
  let activeFilter = 'all';
  let activeElementBeforeModal = null;

  // Load Header Profile Details
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'patient') {
    populatePatientHeader(initialProfile);
  }

  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'patient') {
      populatePatientHeader(profile);
    }
  });

  // Initialize mobile menu
  if (window.initMobileMenu) {
    window.initMobileMenu();
  }

  // DOM Elements
  const uploadForm = document.getElementById('gallery-upload-form');
  const fileInput = document.getElementById('image-file');
  const fileDropArea = document.getElementById('file-drop-area');
  const dropTextLabel = document.getElementById('drop-text-label');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const uploadPreviewImg = document.getElementById('upload-preview-img');
  const btnClearPreview = document.getElementById('btn-clear-preview');
  
  const uploadError = document.getElementById('upload-error');
  const uploadSuccess = document.getElementById('upload-success');
  const btnSubmitUpload = document.getElementById('btn-submit-upload');

  const galleryContainer = document.getElementById('gallery-container');
  const filterTabs = document.querySelectorAll('.filter-tab');

  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxBadge = document.getElementById('lightbox-badge');
  const lightboxDate = document.getElementById('lightbox-date');
  const lightboxPatientDesc = document.getElementById('lightbox-patient-desc');
  const lightboxDocNotes = document.getElementById('lightbox-doc-notes');
  const lightboxDocNotesSection = document.getElementById('lightbox-doc-notes-section');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');

  // Load Gallery Images
  loadGallery();

  // ── Drag and Drop Event Listeners ──
  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropArea.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropArea.classList.remove('dragover');
    }, false);
  });

  fileDropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      fileInput.files = files;
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  btnClearPreview.addEventListener('click', (e) => {
    e.preventDefault();
    resetUploadPreview();
  });

  function handleFileSelected(file) {
    if (!file.type.match('image.*')) {
      showUploadError('Please select a valid image file (PNG, JPEG, WEBP).');
      resetUploadPreview();
      return;
    }
    if (file.size > 10485760) {
      showUploadError('File size exceeds the 10MB limit.');
      resetUploadPreview();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadPreviewImg.src = e.target.result;
      fileDropArea.style.display = 'none';
      imagePreviewContainer.style.display = 'block';
      clearUploadMessages();
    };
    reader.readAsDataURL(file);
  }

  function resetUploadPreview() {
    fileInput.value = '';
    uploadPreviewImg.src = '';
    imagePreviewContainer.style.display = 'none';
    fileDropArea.style.display = 'block';
  }

  // ── Form Upload Execution ──
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearUploadMessages();

    const file = fileInput.files[0];
    const imageType = document.getElementById('image-type').value;
    const description = document.getElementById('image-desc').value;

    if (!file) {
      showUploadError('Please select a photograph to upload.');
      return;
    }

    btnSubmitUpload.disabled = true;
    btnSubmitUpload.innerText = 'Uploading...';

    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('image_type', imageType);
      formData.append('description', description);

      const token = localStorage.getItem('supabase_auth_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/v1/patients/me/images', {
        method: 'POST',
        headers,
        body: formData
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to upload image.');
      }

      showUploadSuccess('Photograph uploaded successfully!');
      resetUploadPreview();
      document.getElementById('image-type').value = '';
      document.getElementById('image-desc').value = '';
      
      // Reload gallery
      await loadGallery();
    } catch (err) {
      console.error('[Upload Photo Error]', err);
      showUploadError(err.message || 'An error occurred during image upload.');
    } finally {
      btnSubmitUpload.disabled = false;
      btnSubmitUpload.innerText = 'Upload Photograph';
    }
  });
  // ── Gallery Loading & Filtering ──
  async function loadGallery() {
    try {
      const response = await apiRequest('/patients/me/images');
      imagesData = response.data?.images || [];
      renderGallery();
    } catch (err) {
      console.error('[Load Gallery Error]', err);
      galleryContainer.innerHTML = `
        <div class="gallery-empty-state" style="border-color: #fee2e2;">
          <svg style="color: #ef4444;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h4 style="color: #b91c1c;">Failed to load gallery</h4>
          <p>Please check your internet connection or log in again.</p>
        </div>
      `;
    }
  }

  function renderGallery() {
    galleryContainer.innerHTML = '';

    const filtered = imagesData.filter(img => {
      if (activeFilter === 'all') return true;
      return img.image_type === activeFilter;
    });

    if (filtered.length === 0) {
      galleryContainer.innerHTML = `
        <div class="gallery-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <h4>No photographs found</h4>
          <p>${activeFilter === 'all' 
            ? 'Start chronological monitoring by uploading your first photograph.' 
            : `No photos logged under the ${activeFilter} category.`}</p>
        </div>
      `;
      return;
    }

    filtered.forEach(img => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      
      let badgeClass = 'lesion';
      if (img.image_type === 'Mouth Opening Image') badgeClass = 'opening';
      else if (img.image_type === 'Progression Image') badgeClass = 'progression';

      const uploadDateStr = new Date(img.uploaded_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const hasDocNotes = img.doctor_notes && img.doctor_notes.trim().length > 0;

      card.innerHTML = `
        <div class="gallery-card-media">
          <img src="${escapeHtml(img.file_url)}" alt="${escapeHtml(img.image_type)} photograph">
          <span class="gallery-card-badge ${badgeClass}">${escapeHtml(img.image_type)}</span>
        </div>
        <div class="gallery-card-details">
          <span class="gallery-card-date">${uploadDateStr}</span>
          <p class="gallery-card-notes">${escapeHtml(img.description) || 'No patient annotations provided.'}</p>
          <div class="gallery-card-doc-status">
            ${hasDocNotes 
              ? `<span class="doc-notes-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
                  Clinical feedback
                 </span>`
              : `<span class="doc-notes-indicator empty">
                  No feedback yet
                 </span>`
            }
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        openLightbox(img);
      });

      galleryContainer.appendChild(card);
    });
  }

  // Filter tabs behavior
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter');
      renderGallery();
    });
  });

  // ── Lightbox Viewers ──
  function openLightbox(img) {
    activeElementBeforeModal = document.activeElement;
    lightboxImg.src = img.file_url;
    lightboxBadge.innerText = img.image_type;
    
    // Reset classes
    lightboxBadge.className = 'lightbox-badge';
    if (img.image_type === 'Mouth Opening Image') lightboxBadge.classList.add('opening');
    else if (img.image_type === 'Progression Image') lightboxBadge.classList.add('progression');

    const dateStr = new Date(img.uploaded_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    lightboxDate.innerText = `Uploaded on ${dateStr}`;
    lightboxPatientDesc.innerText = img.description || 'No notes provided.';

    if (img.doctor_notes && img.doctor_notes.trim().length > 0) {
      lightboxDocNotes.innerText = img.doctor_notes;
      lightboxDocNotesSection.style.display = 'block';
    } else {
      lightboxDocNotes.innerText = 'No notes provided.';
      lightboxDocNotesSection.style.display = 'none';
    }

    lightboxModal.classList.add('active');
    btnCloseLightbox.focus();
  }

  function closeLightbox() {
    lightboxModal.classList.remove('active');
    if (activeElementBeforeModal) {
      activeElementBeforeModal.focus();
    }
  }

  btnCloseLightbox.addEventListener('click', closeLightbox);

  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
      closeLightbox();
    }
  });

  // Accessible keyboard event listener
  document.addEventListener('keydown', (e) => {
    if (lightboxModal.classList.contains('active')) {
      if (e.key === 'Escape') {
        closeLightbox();
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        btnCloseLightbox.focus();
      }
    }
  });

  // ── Utility Handlers ──
  function showUploadError(msg) {
    uploadError.innerText = msg;
    uploadError.style.display = 'block';
    uploadSuccess.style.display = 'none';
  }

  function showUploadSuccess(msg) {
    uploadSuccess.innerText = msg;
    uploadSuccess.style.display = 'block';
    uploadError.style.display = 'none';
  }

  function clearUploadMessages() {
    uploadError.style.display = 'none';
    uploadSuccess.style.display = 'none';
  }

  function populatePatientHeader(profile) {
    const fullName = `${profile.first_name} ${profile.last_name}`;
    const nameBadge = document.getElementById('patient-name-badge');
    const avatar = document.getElementById('patient-avatar');
    if (nameBadge) nameBadge.innerText = fullName;
    if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
  }
});
