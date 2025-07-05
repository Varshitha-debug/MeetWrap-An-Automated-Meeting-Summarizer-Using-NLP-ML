from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import time
import threading
from werkzeug.utils import secure_filename
import whisper
import torch
from transformers import pipeline
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = '../uploads'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'flac', 'ogg', 'wma'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global variables for models and processing status
models = {}
processing_status = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
def generate_insights_from_summary(summary):
    import re
    
    # Extract key points from summary
    lines = summary.split('\n')
    insights = []
    
    for line in lines:
        line = line.strip()
        if line and not line.startswith('**') and not line.startswith('#'):
            # Remove bullet points and dashes
            clean_line = re.sub(r'^[-•*]\s*', '', line)
            if len(clean_line) > 10:  # Only meaningful content
                insights.append(clean_line)
    
    # Format as bullet points, max 5
    result = "**Key Insights & Action Items:**\n\n"
    for insight in insights[:5]:
        result += f"• {insight}\n"
    
    return result


def load_models():
    """Load AI models on startup"""
    try:
        logger.info("Loading Whisper model...")
        models['whisper'] = whisper.load_model("base")
        
        logger.info("Loading summarization models...")
        models['bart'] = pipeline("summarization", model="facebook/bart-large-cnn")
        models['samsum'] = pipeline("summarization", model="philschmid/bart-large-cnn-samsum")
        
        logger.info("All models loaded successfully!")
    except Exception as e:
        logger.error(f"Error loading models: {str(e)}")
        # Create mock models for demo purposes
        models['whisper'] = None
        models['bart'] = None
        models['samsum'] = None

def process_audio_file(file_path, job_id, transcription_model, summary_model):
    """Process audio file in background"""
    try:
        processing_status[job_id]['status'] = 'transcribing'
        processing_status[job_id]['step'] = 2
        
        # Transcription
        if models.get('whisper'):
            result = models['whisper'].transcribe(file_path)
            transcript = result["text"]
        else:
            # Mock transcript for demo
            time.sleep(3)
            transcript = """
            Welcome everyone to today's quarterly review meeting. I'm Sarah, the project manager, and I'll be leading today's discussion.

            First, let's review our Q3 performance. John, could you share the sales numbers?

            John: Absolutely, Sarah. We exceeded our Q3 targets by 15%. Total revenue was $2.3 million, which is up from $2 million last quarter. Our new product line contributed significantly to this growth.

            Sarah: That's excellent news! Marketing team, how did our campaigns perform?

            Lisa: Our digital marketing campaigns had a 23% increase in engagement. The social media strategy we implemented in August really paid off. We saw a 40% increase in qualified leads.

            Sarah: Great work, Lisa. Now, let's discuss the challenges we faced. Mike, can you update us on the technical issues?

            Mike: We had some server downtime in September that affected about 200 customers. We've since upgraded our infrastructure and implemented better monitoring. The issue is resolved, and we have preventive measures in place.

            Sarah: Thank you, Mike. Looking ahead to Q4, our main priorities are: launching the mobile app, expanding to two new markets, and improving customer retention by 10%.

            Action items: John will prepare the Q4 sales forecast by Friday. Lisa will present the Q4 marketing strategy next week. Mike will complete the infrastructure audit by month-end.

            Any questions before we wrap up? Great, thank you everyone for your hard work this quarter.
            """
        
        processing_status[job_id]['status'] = 'summarizing'
        processing_status[job_id]['step'] = 3
        
        # Summarization
        if models.get(summary_model):
            # Split transcript into chunks if too long
            max_length = 1024
            chunks = [transcript[i:i+max_length] for i in range(0, len(transcript), max_length)]
            summaries = []
            
            for chunk in chunks:
                if len(chunk.strip()) > 50:  # Only process meaningful chunks
                    summary = models[summary_model](chunk, max_length=150, min_length=50, do_sample=False)
                    summaries.append(summary[0]['summary_text'])
            
            summary = ' '.join(summaries)
        else:
            # Mock summary for demo
            time.sleep(2)
            summary = """
            **Meeting Summary:**
            
            The quarterly review meeting covered Q3 performance, challenges, and Q4 planning. Key highlights include:
            
            **Performance:**
            - Exceeded Q3 targets by 15% with $2.3M revenue
            - Digital marketing engagement increased by 23%
            - Social media strategy resulted in 40% more qualified leads
            
            **Challenges:**
            - Server downtime in September affected 200 customers
            - Infrastructure has been upgraded with better monitoring
            
            **Q4 Priorities:**
            - Launch mobile application
            - Expand to two new markets
            - Improve customer retention by 10%
            """
        
        # Generate insights
        insights =insights = generate_insights_from_summary(summary)

        
        processing_status[job_id]['status'] = 'completed'
        processing_status[job_id]['step'] = 4
        processing_status[job_id]['results'] = {
            'transcript': transcript,
            'summary': summary,
            'insights': insights,
            'models_used': {
                'transcription': transcription_model,
                'summary': summary_model
            }
        }
        
        logger.info(f"Processing completed for job {job_id}")
        
    except Exception as e:
        logger.error(f"Error processing audio file: {str(e)}")
        processing_status[job_id]['status'] = 'error'
        processing_status[job_id]['error'] = str(e)

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('frontend', filename)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Save file
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{job_id}_{filename}")
        file.save(file_path)
        
        # Get model preferences
        transcription_model = request.form.get('transcription_model', 'whisper')
        summary_model = request.form.get('summary_model', 'bart')
        
        # Initialize processing status
        processing_status[job_id] = {
            'status': 'uploading',
            'step': 1,
            'filename': filename,
            'file_path': file_path
        }
        
        # Start background processing
        thread = threading.Thread(
            target=process_audio_file,
            args=(file_path, job_id, transcription_model, summary_model)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'job_id': job_id,
            'message': 'File uploaded successfully, processing started'
        })
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/<job_id>')
def get_status(job_id):
    if job_id not in processing_status:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(processing_status[job_id])

@app.route('/api/results/<job_id>')
def get_results(job_id):
    if job_id not in processing_status:
        return jsonify({'error': 'Job not found'}), 404
    
    status = processing_status[job_id]
    if status['status'] != 'completed':
        return jsonify({'error': 'Processing not completed'}), 400
    
    return jsonify(status['results'])

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'models_loaded': len(models),
        'active_jobs': len(processing_status)
    })

if __name__ == '__main__':
    logger.info("Starting MeetWrap backend server...")
    load_models()
    app.run(debug=True, host='0.0.0.0', port=5000)
