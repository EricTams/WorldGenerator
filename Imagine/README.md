# Imagine

A command-line tool for generating, editing, and analyzing images using OpenAI's image APIs and Black Forest Labs' Flux models.

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set up your OpenAI API key using one of these methods:

   - Create a `.env` file:
     ```
     OPENAI_API_KEY=your_api_key_here
     ```

   - Create an `openai_api_key.txt` file with just your API key:
     ```
     sk-your-api-key-here
     ```

   - Set the OPENAI_API_KEY environment variable
     ```bash
     export OPENAI_API_KEY=your_api_key_here
     ```

4. For Black Forest Labs support, set up your BFL API key:
   - Set the BFL_API_KEY environment variable:
     ```bash
     export BFL_API_KEY=your_bfl_api_key_here
     ```
   - Or create a `bfl_api_key.txt` file with your API key

## Usage

The tool supports three main operations:
1. **Generate** - Create new images from text prompts
2. **Edit** - Modify existing images with optional masks
3. **Analyze** - Analyze images or text using OpenAI's vision API

You can use the tool in two ways:
- Directly call the Python script with `python imagine.py`
- Use the executable wrapper script with `./imagine`

### Generate an image from a prompt

```bash
./imagine --prompt "a beautiful sunset over mountains" --output sunset.png
```

### Edit an existing image

```bash
./imagine --input photo.png --prompt "add flowers and butterflies" --output enhanced.png
```

### Edit an image with a mask

```bash
./imagine --input portrait.png --mask face_mask.png --prompt "add sunglasses" --output portrait_with_glasses.png
```

### Analyze an image

```bash
./imagine --operation analyze --input photo.jpg --prompt "What can you tell me about this image?" --output analysis.txt
```

## Options

### Core Parameters

- `--output`: Output image filename or text filename for analysis (required)
- `--prompt`: Text prompt for image generation, editing, or analysis
- `--input`: Path to input image or URL for editing or analysis
- `--mask`: Path to mask image or URL for targeted editing (optional)
- `--operation`: Operation mode: "auto", "generate", "edit", or "analyze" (default: "auto")

### API Configuration

- `--provider`: Image generation provider: "openai" or "bfl" (default: "openai")
- `--api-key`: OpenAI API key (defaults to OPENAI_API_KEY environment variable)
- `--api-base`: OpenAI API base URL (optional)
- `--bfl-api-key`: Black Forest Labs API key (defaults to BFL_API_KEY environment variable)

### Image Generation/Editing Parameters

- `--detail`: Detail level for analysis: "auto", "low", or "high" (default: "auto")
- `--background`: Background type for generation: "auto", "transparent", or "opaque" (default: "auto")
- `--quality`: Image quality: "auto", "high", "medium", or "low" (default: "auto")
- `--size`: Image size: "auto", "1024x1024", "1792x1024", "1024x1792", "1536x1024", or "1024x1536" (default: "auto")
- `--output-format`: Output format: "png", "jpeg", or "webp" (default: "png")
- `--output-compression`: Output compression level (0-100, default: 100)
- `--moderation`: Moderation level: "auto" or "low" (default: "auto")

### Black Forest Labs (BFL) Specific Parameters

- `--bfl-model`: BFL model to use: "flux-kontext-pro", "flux-kontext-max", "flux-pro-1.1-ultra", "flux-pro-1.1", "flux-pro", or "flux-dev" (default: "flux-pro-1.1")
- `--seed`: Seed for reproducibility (BFL only)
- `--safety-tolerance`: Safety tolerance 0=strict, 6=permissive (BFL generation default: 6, BFL edit mode max: 2)

## Examples

### Generate Images

Generate a fantasy landscape with OpenAI:
```bash
python imagine.py --prompt "fantasy landscape with dragons and castles in the style of Hayao Miyazaki" --output fantasy.png
```

Generate with Black Forest Labs Flux:
```bash
python imagine.py --provider bfl --prompt "cyberpunk street scene with neon lights" --output cyberpunk.png
```

Generate with specific BFL model:
```bash
python imagine.py --provider bfl --bfl-model flux-pro-1.1-ultra --prompt "photorealistic portrait of a robot" --output robot.png
```

Generate a high-quality image with specific size:
```bash
python imagine.py --prompt "futuristic cityscape at night" --quality high --size 1792x1024 --output cityscape.png
```

### Edit Images

Edit a portrait to add a crown with OpenAI:
```bash
python imagine.py --input portrait.jpg --prompt "add a golden crown" --output portrait_with_crown.jpg
```

Edit with Black Forest Labs (uses flux-kontext-pro):
```bash
python imagine.py --provider bfl --input portrait.jpg --prompt "add a golden crown" --output portrait_with_crown.jpg
```

Edit with mask and quality settings:
```bash
python imagine.py --input landscape.png --mask sky_mask.png --prompt "change to stormy sky with lightning" --quality high --output stormy_landscape.png
```

Edit an image from a URL:
```bash
python imagine.py --input https://example.com/images/photo.jpg --prompt "add a sunset background" --output edited_photo.png
```

### Analyze Images

Analyze an image and save output as text:
```bash
python imagine.py --operation analyze --input artwork.jpg --prompt "Analyze the artistic style and composition of this image" --output art_analysis.txt
```

Analyze an image with high detail and save as JSON:
```bash
python imagine.py --operation analyze --input document.png --detail high --output analysis.json
```

Analyze an image from a URL:
```bash
python imagine.py --operation analyze --input https://example.com/images/artwork.jpg --prompt "Describe this artwork in detail" --output artwork_analysis.txt
```

## Operation Auto-Detection

When `--operation` is set to "auto" (the default):
- If `--input` is provided, the operation will be "edit"
- If only `--prompt` is provided (no input image), the operation will be "generate"
- If neither `--prompt` nor `--input` is provided, the operation will be "analyze"

## License

MIT