# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"imagine" is a command-line tool for generating, editing, and analyzing images using OpenAI's image generation and vision APIs, as well as Black Forest Labs' Flux models.

Key capabilities:
- Create new images from text prompts
- Edit existing images with optional masks
- Analyze images or text using OpenAI's vision API
- Save generated images or analysis results to specified output files

## Architecture

The tool consists of:
- `imagine.py`: Main script with CLI interface and core functionality
- Three primary operations:
  1. `generate_image()`: Create new images from text prompts
  2. `edit_image()`: Modify existing images with optional masks
  3. `analyze_image()` and `analyze_text()`: Analyze images or text

## Commands

### Installation
```bash
pip install -r requirements.txt
```

### Running the Tool

The tool can be run in two ways:
1. Through the Python script: `python imagine.py [options]`
2. Using the zsh wrapper script: `./imagine [options]`

#### Generate Images
```bash
./imagine --prompt "a beautiful sunset over mountains" --output sunset.png
./imagine --prompt "fantasy landscape" --quality high --size 1792x1024 --output fantasy.png
```

#### Edit Images
```bash
./imagine --input photo.png --prompt "add flowers" --output enhanced.png
./imagine --input portrait.png --mask face_mask.png --prompt "add sunglasses" --output result.png
```

#### Analyze Images
```bash
./imagine --operation analyze --input photo.jpg --prompt "What can you tell me about this image?" --output analysis.txt
./imagine --operation analyze --input document.png --detail high --output analysis.json
```

#### Using URLs as input
```bash
./imagine --input https://example.com/images/photo.jpg --prompt "add a beach background" --output edited.png
```

### Running Tests
```bash
python -m unittest discover tests
```

### Linting
```bash
flake8 *.py
```

## API Parameters

The tool supports most OpenAI image API parameters:

- Operation mode: auto, generate, edit, analyze
- Image quality: auto, high, medium, low
- Size options: 1024x1024, 1792x1024, 1024x1792, 1536x1024, 1024x1536
- Background: auto, transparent, opaque
- Detail (for analysis): auto, low, high
- Output formats: png, jpeg, webp
- Output compression: 0-100
- Moderation: auto, low

## API Key Configuration

The tool supports multiple providers and will look for API keys in the following locations (in order of priority):

### OpenAI
1. Command-line parameter: `--api-key`
2. Environment variable: `OPENAI_API_KEY`
3. `.env` file in the project directory
4. `openai_api_key.txt` file in the project directory

### Black Forest Labs
1. Command-line parameter: `--bfl-api-key`
2. Environment variable: `BFL_API_KEY`
3. `.env` file in the project directory
4. `bfl_api_key.txt` file in the project directory

This makes it flexible to use in different environments and workflows.