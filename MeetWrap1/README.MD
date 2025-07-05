# MeetWrap

AI-powered meeting transcription and summarization tool.

## Features

- Audio transcription using Whisper
- Meeting summarization with BART/SamSum models
- Key insights extraction
- Web-based interface

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt

2.Run the application:

python app.py
Open http://localhost:5000 in your browser

Usage
Upload an audio file (MP3, WAV, M4A, FLAC, OGG, WMA)

Select transcription and summary models

Click "Process" to analyze

View transcript, summary, and key insights

Supported Formats
Audio: MP3, WAV, M4A, FLAC, OGG, WMA

Max file size: 100MB

Models
Transcription: Whisper (base)

Summarization: BART-Large-CNN, BART-SamSum, KnKarthick

