// result.js — loads scan data and renders result page

var token = localStorage.getItem('token');
if (!token) { window.location.href = '/login.html'; }

document.getElementById('logoutBtn').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
});

function md(text) {
    if (!text) return '<p>No advice available.</p>';
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^## (.+)$/gm, '<h2 style="color:#047857;margin:1rem 0 .3rem">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 style="color:#10b981;margin:.8rem 0 .2rem">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 style="color:#047857;margin:1rem 0 .3rem">$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li style="margin:.3rem 0">$1</li>')
        .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, '<ul style="padding-left:1.5rem;margin:.5rem 0">$&</ul>')
        .replace(/\n\n/g, '<br><br>');
}

function showError(msg) {
    var el = document.getElementById('statusMsg');
    el.textContent = msg;
    el.style.color = '#991b1b';
    el.style.background = '#fef2f2';
    el.style.padding = '1rem';
    el.style.borderRadius = '8px';
}

var params = new URLSearchParams(window.location.search);
var scanId = params.get('id');

if (!scanId) {
    showError('No scan ID in URL. Go back and upload an image.');
} else {
    fetch('/api/detect/' + scanId, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (!data.success || !data.scan) {
            showError('Could not load result: ' + (data.error || 'Unknown error'));
            return;
        }

        document.getElementById('statusMsg').style.display = 'none';
        document.getElementById('resultContent').style.display = 'block';

        var s = data.scan;
        document.getElementById('diseaseName').textContent = s.disease_name || 'Unknown';
        document.getElementById('cropName').textContent = 'Crop: ' + (s.crop_type || 'Unknown');

        var sevEl = document.getElementById('severityValue');
        sevEl.textContent = s.severity_level || 'Unknown';
        var sev = (s.severity_level || '').toLowerCase();
        sevEl.style.color = sev === 'healthy' ? 'var(--primary)' : sev === 'mild' ? 'var(--warning)' : 'var(--danger)';

        document.getElementById('confidenceValue').textContent = (s.confidence || 0) + '%';
        document.getElementById('areaValue').textContent = (s.affected_area_percent || 0) + '%';
        document.getElementById('treatmentAdvice').innerHTML = md(s.treatment_advice);
    })
    .catch(function (err) {
        showError('Network error: ' + err.message);
    });

    // ── Feedback UI Logic ───────────────────────────────────────────────────
    var btnFeedbackYes = document.getElementById('btnFeedbackYes');
    var btnFeedbackNo = document.getElementById('btnFeedbackNo');
    var feedbackForm = document.getElementById('feedbackForm');
    var submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
    var feedbackPrompt = document.getElementById('feedbackPrompt');
    var feedbackSuccess = document.getElementById('feedbackSuccess');
    var improvedAdviceNotice = document.getElementById('improvedAdviceNotice');

    function submitFeedback(wasCorrect, details) {
        var payload = { scan_id: scanId, was_correct: wasCorrect };
        if (details) {
            payload.correct_disease = details.disease;
            payload.comments = details.comments;
        }

        return fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        }).then(function(r) { return r.json(); });
    }

    btnFeedbackYes.addEventListener('click', function() {
        submitFeedback(true).then(function(res) {
            if (res.success) {
                feedbackPrompt.style.display = 'none';
                feedbackSuccess.style.display = 'block';
            } else {
                alert('Error submitting feedback: ' + res.error);
            }
        }).catch(function(err) {
            alert('Error: ' + err.message);
        });
    });

    btnFeedbackNo.addEventListener('click', function() {
        feedbackPrompt.style.display = 'none';
        feedbackForm.style.display = 'block';
    });

    submitFeedbackBtn.addEventListener('click', function() {
        var disease = document.getElementById('correctDisease').value;
        var comments = document.getElementById('feedbackComments').value;
        
        submitFeedbackBtn.disabled = true;
        submitFeedbackBtn.textContent = 'Submitting...';
        
        feedbackSuccess.style.display = 'block';
        improvedAdviceNotice.style.display = 'inline';
        
        submitFeedback(false, { disease: disease, comments: comments }).then(function(res) {
            if (res.success) {
                feedbackForm.style.display = 'none';
                improvedAdviceNotice.style.display = 'none';
                
                if (res.improved_advice) {
                    document.getElementById('treatmentAdvice').innerHTML = md(res.improved_advice);
                    // Add a visual cue that it was updated
                    document.getElementById('treatmentAdvice').style.border = '2px solid #10b981';
                    document.getElementById('treatmentAdvice').style.padding = '1rem';
                    document.getElementById('treatmentAdvice').style.borderRadius = '8px';
                }
            } else {
                alert('Error submitting feedback: ' + res.error);
                submitFeedbackBtn.disabled = false;
                submitFeedbackBtn.textContent = 'Submit Correction';
                feedbackSuccess.style.display = 'none';
            }
        }).catch(function(err) {
            alert('Error: ' + err.message);
            submitFeedbackBtn.disabled = false;
            submitFeedbackBtn.textContent = 'Submit Correction';
            feedbackSuccess.style.display = 'none';
        });
    });
}

