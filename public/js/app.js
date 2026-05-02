// Setup User Info
document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const nameEl = document.getElementById('userNameDisplay');
        if (nameEl) nameEl.textContent = `Hello, ${user.name}`;
    }
});

// Drag and Drop Logic
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const cancelBtn = document.getElementById('cancelBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const loader = document.getElementById('loader');
const errorAlert = document.getElementById('errorAlert');

let selectedFile = null;

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showAppError('Please select an image file (JPG, PNG).');
        return;
    }
    
    errorAlert.style.display = 'none';
    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        dropZone.style.display = 'none';
        previewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        previewContainer.style.display = 'none';
        dropZone.style.display = 'block';
    });
}

function showAppError(msg) {
    if (errorAlert) {
        errorAlert.textContent = msg;
        errorAlert.style.display = 'block';
    } else {
        alert(msg);
    }
}

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        
        loader.style.display = 'flex';
        errorAlert.style.display = 'none';
        
        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            
            // Backend expects auth token if you protected the route, but detect.js is open in this backend
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/detect', {
                method: 'POST',
                headers: headers,
                body: formData
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Navigate to result page with the scan ID in the URL
                window.location.href = '/result.html?id=' + data.scan_id;
            } else {
                loader.style.display = 'none';
                showAppError(data.error || 'Failed to analyze image.');
            }
            
        } catch (err) {
            loader.style.display = 'none';
            showAppError('Connection error. Is the backend running?');
        }
    });
}
