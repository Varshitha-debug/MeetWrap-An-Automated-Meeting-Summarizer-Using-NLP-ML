class MeetWrap {
    constructor() {
        this.currentJobId = null;
        this.selectedFile = null;
        this.apiBaseUrl = 'http://localhost:5000/api';
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkBackendHealth();
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.audioFile = document.getElementById('audioFile');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.removeFile = document.getElementById('removeFile');
        
        // Model selection
        this.transcriptionModel = document.getElementById('transcriptionModel');
        this.summaryModel = document.getElementById('summaryModel');
        this.processBtn = document.getElementById('processBtn');
        
        // Sections
        this.uploadSection = document.getElementById('uploadSection');
        this.processingSection = document.getElementById('processingSection');
        this.resultsSection = document.getElementById('resultsSection');
        
        // Processing steps
        this.steps = {
            step1: document.getElementById('step1'),
            step2: document.getElementById('step2'),
            step3: document.getElementById('step3'),
            step4: document.getElementById('step4')
        };
        
        // Results elements
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabPanels = document.querySelectorAll('.tab-panel');
        this.transcriptContent = document.getElementById('transcriptContent');
        this.summaryContent = document.getElementById('summaryContent');
        this.insightsContent = document.getElementById('insightsContent');
        
        // Action buttons
        this.downloadBtn = document.getElementById('downloadBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.newAnalysisBtn = document.getElementById('newAnalysisBtn');
        this.copyBtns = document.querySelectorAll('.copy-btn');
        
        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
    }

    attachEventListeners() {
        // File upload events
        this.uploadArea.addEventListener('click', () => this.audioFile.click());
        this.uploadBtn.addEventListener('click', () => this.audioFile.click());
        this.audioFile.addEventListener('change', (e) => this.handleFileSelect(e));
        this.removeFile.addEventListener('click', () => this.clearFile());
        
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Process button
        this.processBtn.addEventListener('click', () => this.processFile());
        
        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Action buttons
        this.downloadBtn.addEventListener('click', () => this.downloadResults());
        this.shareBtn.addEventListener('click', () => this.shareResults());
        this.newAnalysisBtn.addEventListener('click', () => this.startNewAnalysis());
        
        // Copy buttons
        this.copyBtns.forEach(btn => {
            btn.addEventListener('click', () => this.copyToClipboard(btn.dataset.copy));
        });
    }

    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            if (response.ok) {
                this.showToast('Backend connected successfully!', 'success');
            } else {
                this.showToast('Backend connection failed', 'error');
            }
        } catch (error) {
            this.showToast('Backend is not running. Please start the server.', 'error');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        // Validate file type
        const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/ogg', 'audio/wma'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'wma'];
        
        if (!allowedExtensions.includes(fileExtension)) {
            this.showToast('Please select a valid audio file (MP3, WAV, M4A, FLAC, OGG, WMA)', 'error');
            return;
        }

        // Check file size (100MB limit)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showToast('File size must be less than 100MB', 'error');
            return;
        }

        this.selectedFile = file;
        this.displayFileInfo(file);
        this.processBtn.disabled = false;
    }

    displayFileInfo(file) {
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.fileInfo.style.display = 'block';
        this.uploadArea.style.display = 'none';
    }

    clearFile() {
        this.selectedFile = null;
        this.audioFile.value = '';
        this.fileInfo.style.display = 'none';
        this.uploadArea.style.display = 'block';
        this.processBtn.disabled = true;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async processFile() {
        if (!this.selectedFile) {
            this.showToast('Please select a file first', 'error');
            return;
        }

        try {
            this.showProcessingSection();
            this.updateProcessingStep(1);

            const formData = new FormData();
            formData.append('audio', this.selectedFile);
            formData.append('transcription_model', this.transcriptionModel.value);
            formData.append('summary_model', this.summaryModel.value);

            const response = await fetch(`${this.apiBaseUrl}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            this.currentJobId = result.job_id;
            
            this.showToast('File uploaded successfully!', 'success');
            this.pollJobStatus();

        } catch (error) {
            this.showToast('Error uploading file: ' + error.message, 'error');
            this.showUploadSection();
        }
    }

    async pollJobStatus() {
        if (!this.currentJobId) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/status/${this.currentJobId}`);
            const status = await response.json();

            this.updateProcessingStep(status.step);

            if (status.status === 'completed') {
                await this.loadResults();
            } else if (status.status === 'error') {
                this.showToast('Processing failed: ' + status.error, 'error');
                this.showUploadSection();
            } else {
                // Continue polling
                setTimeout(() => this.pollJobStatus(), 2000);
            }

        } catch (error) {
            this.showToast('Error checking status: ' + error.message, 'error');
            this.showUploadSection();
        }
    }

    async loadResults() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/results/${this.currentJobId}`);
            const results = await response.json();

            this.displayResults(results);
            this.showResultsSection();
            this.showToast('Analysis completed successfully!', 'success');

        } catch (error) {
            this.showToast('Error loading results: ' + error.message, 'error');
            this.showUploadSection();
        }
    }

    displayResults(results) {
        this.transcriptContent.textContent = results.transcript;
        this.summaryContent.innerHTML = this.formatMarkdown(results.summary);
        this.insightsContent.innerHTML = this.formatMarkdown(results.insights);
        
        this.currentResults = results;
    }

    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/•/g, '•')
            .replace(/\n/g, '<br>');
    }

    updateProcessingStep(step) {
        // Reset all steps
        Object.values(this.steps).forEach(stepEl => {
            stepEl.classList.remove('active');
        });

        // Activate current and previous steps
        for (let i = 1; i <= step; i++) {
            if (this.steps[`step${i}`]) {
                this.steps[`step${i}`].classList.add('active');
            }
        }
    }

    showUploadSection() {
        this.uploadSection.style.display = 'block';
        this.processingSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
    }

    showProcessingSection() {
        this.uploadSection.style.display = 'none';
        this.processingSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
    }

    showResultsSection() {
        this.uploadSection.style.display = 'none';
        this.processingSection.style.display = 'none';
        this.resultsSection.style.display = 'block';
    }

    switchTab(tabName) {
        // Update tab buttons
        this.tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab panels
        this.tabPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === tabName) {
                panel.classList.add('active');
            }
        });
    }

    async copyToClipboard(contentType) {
    let text = '';
    
    switch (contentType) {
        case 'transcript':
            text = this.currentResults.transcript;
            break;
        case 'summary':
            text = this.currentResults.summary;
            break;
        case 'insights':
            text = this.currentResults.insights;
            break;
    }

    try {
        await navigator.clipboard.writeText(text);
        this.showToast('Copied to clipboard!', 'success');
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showToast('Copied to clipboard!', 'success');
    }
}

    downloadResults() {
        if (!this.currentResults) return;

        const content = `
MEETWRAP ANALYSIS RESULTS
========================

TRANSCRIPT:
${this.currentResults.transcript}

SUMMARY:
${this.currentResults.summary}

KEY INSIGHTS:
${this.currentResults.insights}

Generated on: ${new Date().toLocaleString()}
Models used: ${this.currentResults.models_used.transcription} (Transcription), ${this.currentResults.models_used.summary} (Summary)
        `;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meetwrap-analysis-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Results downloaded!', 'success');
    }

    shareResults() {
        if (!this.currentResults) return;

        const shareText = `Check out my meeting analysis from MeetWrap!\n\nSummary: ${this.currentResults.summary.substring(0, 200)}...`;
        
        if (navigator.share) {
            navigator.share({
                title: 'MeetWrap Analysis Results',
                text: shareText,
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText).then(() => {
                this.showToast('Share text copied to clipboard!', 'success');
            });
        }
    }

    startNewAnalysis() {
        this.currentJobId = null;
        this.selectedFile = null;
        this.currentResults = null;
        this.clearFile();
        this.showUploadSection();
        this.showToast('Ready for new analysis!', 'info');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-circle' : 
                    'fa-info-circle';
        
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;

        this.toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MeetWrap();
});