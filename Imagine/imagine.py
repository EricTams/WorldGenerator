#!/usr/bin/env python3
import os
import argparse
import base64
import io
import json
import uuid
import tempfile
import time
import requests
from PIL import Image
from openai import OpenAI
from elevenlabs import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

def load_api_key_from_file(filename='openai_api_key.txt'):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    api_key_file = os.path.join(script_dir, filename)

    if os.path.exists(api_key_file):
        try:
            with open(api_key_file, 'r') as f:
                api_key = f.read().strip()
                if api_key:
                    return api_key
        except Exception as e:
            print(f"Warning: Failed to read API key from file: {e}")

    return None

def load_elevenlabs_api_key():
    """Load ElevenLabs API key from various sources."""
    # Try command line arg, env var, .env file, or elevenlabs_api_key.txt
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        api_key = load_api_key_from_file('elevenlabs_api_key.txt')
    return api_key

def load_bfl_api_key():
    """Load Black Forest Labs API key from various sources."""
    api_key = os.getenv("BFL_API_KEY")
    if not api_key:
        api_key = load_api_key_from_file('bfl_api_key.txt')
    return api_key

file_api_key = load_api_key_from_file()
if file_api_key and not os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = file_api_key

elevenlabs_file_api_key = load_api_key_from_file('elevenlabs_api_key.txt')
if elevenlabs_file_api_key and not os.getenv("ELEVENLABS_API_KEY"):
    os.environ["ELEVENLABS_API_KEY"] = elevenlabs_file_api_key

bfl_file_api_key = load_api_key_from_file('bfl_api_key.txt')
if bfl_file_api_key and not os.getenv("BFL_API_KEY"):
    os.environ["BFL_API_KEY"] = bfl_file_api_key

def process_image(image_path):
    """Process an image file or URL and return it as a PIL Image object."""
    if image_path.startswith(('http://', 'https://')):
        try:
            import requests
            from io import BytesIO

            response = requests.get(image_path, stream=True)
            response.raise_for_status()  
            return Image.open(BytesIO(response.content))
        except ImportError:
            raise ImportError("The 'requests' library is required for downloading images. Install it with 'pip install requests'")
        except Exception as e:
            raise ValueError(f"Failed to download image from URL: {e}")
    else:
        # local file
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        return Image.open(image_path)

def generate_image(prompt, api_key=None, api_base=None, background="auto", quality="auto",
                   size="1024x1024", output_format="png", output_compression=100, moderation="auto"):
    """Generate an image using OpenAI's image generation API."""

    client_params = {
        "api_key": api_key or os.getenv("OPENAI_API_KEY")
    }
    if api_base:
        client_params["base_url"] = api_base

    client = OpenAI(**client_params)

    generate_params = {
        "prompt": prompt,
        "model": "gpt-image-1",
        "n": 1
    }

    if background != "auto":
        generate_params["background"] = background
    if quality != "auto":
        generate_params["quality"] = quality
    if size != "auto":
        generate_params["size"] = size
    if output_format != "auto":
        generate_params["output_format"] = output_format

    generate_params["output_compression"] = output_compression

    if moderation != "auto":
        generate_params["moderation"] = moderation

    response = client.images.generate(**generate_params)

    image_data = response.data[0]

    if hasattr(image_data, 'b64_json') and image_data.b64_json:
        image_bytes = base64.b64decode(image_data.b64_json)
        return Image.open(io.BytesIO(image_bytes))
    elif hasattr(image_data, 'url') and image_data.url:
        raise NotImplementedError("URL response handling is not implemented")
    else:
        raise ValueError("No image data found in the response")

def edit_image(input_image, prompt, mask_image=None, api_key=None, api_base=None,
               quality="auto", size="auto"):
    """Edit an image using OpenAI's image edit API."""

    client_params = {
        "api_key": api_key or os.getenv("OPENAI_API_KEY")
    }
    if api_base:
        client_params["base_url"] = api_base

    client = OpenAI(**client_params)

    # Create unique temporary filenames
    unique_id = str(uuid.uuid4())
    temp_dir = tempfile.gettempdir()
    temp_input_path = os.path.join(temp_dir, f"input_{unique_id}.png")
    input_image.save(temp_input_path, format="PNG")

    edit_params = {
        "image": open(temp_input_path, "rb"),
        "prompt": prompt,
        "model": "gpt-image-1"
    }

    if quality != "auto":
        edit_params["quality"] = quality
    if size != "auto":
        edit_params["size"] = size

    temp_mask_path = None
    if mask_image:
        temp_mask_path = os.path.join(temp_dir, f"mask_{unique_id}.png")
        mask_image.save(temp_mask_path, format="PNG")
        edit_params["mask"] = open(temp_mask_path, "rb")

    try:
        response = client.images.edit(**edit_params)

        image_data = response.data[0]

        if hasattr(image_data, 'b64_json') and image_data.b64_json:
            image_bytes = base64.b64decode(image_data.b64_json)
            return Image.open(io.BytesIO(image_bytes))
        elif hasattr(image_data, 'url') and image_data.url:
            raise NotImplementedError("URL response handling is not implemented")
        else:
            raise ValueError("No image data found in the response")

    finally:
        edit_params["image"].close()
        os.remove(temp_input_path)

        if mask_image and "mask" in edit_params and temp_mask_path:
            edit_params["mask"].close()
            os.remove(temp_mask_path)

def create_variations(input_image, api_key=None, api_base=None, n=1, size="1024x1024"):
    """Create variations of an image using OpenAI's variations API."""
    
    client_params = {
        "api_key": api_key or os.getenv("OPENAI_API_KEY")
    }
    if api_base:
        client_params["base_url"] = api_base

    client = OpenAI(**client_params)

    # Create unique temporary filename
    unique_id = str(uuid.uuid4())
    temp_dir = tempfile.gettempdir()
    temp_input_path = os.path.join(temp_dir, f"input_{unique_id}.png")
    input_image.save(temp_input_path, format="PNG")

    variation_params = {
        "image": open(temp_input_path, "rb"),
        "n": n
    }

    if size != "auto":
        variation_params["size"] = size

    try:
        response = client.images.create_variation(**variation_params)

        # Return the first variation (or all if n > 1)
        if n == 1:
            image_data = response.data[0]
            if hasattr(image_data, 'b64_json') and image_data.b64_json:
                image_bytes = base64.b64decode(image_data.b64_json)
                return Image.open(io.BytesIO(image_bytes))
            elif hasattr(image_data, 'url') and image_data.url:
                raise NotImplementedError("URL response handling is not implemented")
            else:
                raise ValueError("No image data found in the response")
        else:
            # Return list of images for multiple variations
            images = []
            for image_data in response.data:
                if hasattr(image_data, 'b64_json') and image_data.b64_json:
                    image_bytes = base64.b64decode(image_data.b64_json)
                    images.append(Image.open(io.BytesIO(image_bytes)))
                elif hasattr(image_data, 'url') and image_data.url:
                    raise NotImplementedError("URL response handling is not implemented")
                else:
                    raise ValueError("No image data found in the response")
            return images

    finally:
        variation_params["image"].close()
        os.remove(temp_input_path)

def analyze_image(input_image, prompt, api_key=None, api_base=None, detail="auto"):
    """Analyze an image using OpenAI's vision API."""

    client_params = {
        "api_key": api_key or os.getenv("OPENAI_API_KEY")
    }
    if api_base:
        client_params["base_url"] = api_base

    client = OpenAI(**client_params)

    # Convert input image to base64
    buffered = io.BytesIO()
    input_image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    # Prepare messages for GPT Vision
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{img_str}",
                        "detail": detail
                    }
                }
            ]
        }
    ]

    # Call GPT Vision API
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages
    )

    content = response.choices[0].message.content
    return input_image, content

def analyze_text(prompt, api_key=None, api_base=None):
    """Analyze text using OpenAI's chat API."""
    # Initialize OpenAI client with optional base URL
    client_params = {
        "api_key": api_key or os.getenv("OPENAI_API_KEY")
    }
    if api_base:
        client_params["base_url"] = api_base

    client = OpenAI(**client_params)

    # If no input image, just use text completion
    response = client.chat.completions.create(
        model="gpt-4-vision-preview",
        messages=[{"role": "user", "content": prompt}]
    )

    return None, response.choices[0].message.content

def generate_sound_effect(prompt, api_key=None, duration=None, prompt_influence=None):
    """Generate a sound effect using ElevenLabs' text-to-sound-effects API."""
    
    elevenlabs_api_key = api_key or load_elevenlabs_api_key()
    
    if not elevenlabs_api_key:
        raise ValueError("No ElevenLabs API key found. Set ELEVENLABS_API_KEY environment variable or use --elevenlabs-api-key")
    
    client = ElevenLabs(
        api_key=elevenlabs_api_key
    )
    
    # Prepare parameters for the API call
    params = {
        "text": prompt
    }
    
    if duration is not None:
        params["duration_seconds"] = duration
    
    if prompt_influence is not None:
        params["prompt_influence"] = prompt_influence
    
    # Generate the sound effect
    response = client.text_to_sound_effects.convert(**params)
    
    # The response should contain audio data
    # Return the audio bytes
    return response

def bfl_generate_image(prompt, api_key=None, model="flux-pro-1.1", aspect_ratio="1:1", 
                      seed=None, safety_tolerance=6, output_format="jpeg"):
    """Generate an image using Black Forest Labs API."""
    
    bfl_api_key = api_key or load_bfl_api_key()
    
    if not bfl_api_key:
        raise ValueError("No BFL API key found. Set BFL_API_KEY environment variable or use --bfl-api-key")
    
    # Map model names to endpoints
    model_endpoints = {
        "flux-kontext-pro": "flux-kontext-pro",
        "flux-kontext-max": "flux-kontext-max", 
        "flux-pro-1.1-ultra": "flux-pro-1.1-ultra",
        "flux-pro-1.1": "flux-pro-1.1",
        "flux-pro": "flux-pro",
        "flux-dev": "flux-dev"
    }
    
    endpoint = model_endpoints.get(model, model)
    url = f"https://api.us1.bfl.ai/v1/{endpoint}"
    
    headers = {
        "accept": "application/json",
        "x-key": bfl_api_key,
        "Content-Type": "application/json"
    }
    
    data = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "output_format": output_format,
        "safety_tolerance": safety_tolerance
    }
    
    if seed is not None:
        data["seed"] = seed
    
    # Make the request
    response = requests.post(url, headers=headers, json=data)
    if response.status_code != 200:
        print(f"Error response: {response.text}")
    response.raise_for_status()
    
    result = response.json()
    request_id = result.get("id")
    
    if not request_id:
        raise ValueError("No request ID returned from BFL API")
    
    # Poll for result
    result_url = f"https://api.us1.bfl.ai/v1/get_result?id={request_id}"
    
    print(f"Request submitted. Waiting for generation to complete...")
    while True:
        time.sleep(1.5)
        result_response = requests.get(result_url, headers={"accept": "application/json", "x-key": bfl_api_key})
        result_response.raise_for_status()
        
        result_data = result_response.json()
        status = result_data.get("status")
        
        if status == "Ready":
            image_url = result_data.get("result", {}).get("sample")
            if not image_url:
                raise ValueError("No image URL in result")
            
            # Download the image
            img_response = requests.get(image_url)
            img_response.raise_for_status()
            
            return Image.open(io.BytesIO(img_response.content))
            
        elif status not in ["Processing", "Queued", "Pending"]:
            raise ValueError(f"Generation failed with status: {status}. Full response: {result_data}")

def bfl_edit_image(input_image, prompt, api_key=None, model="flux-kontext-pro", seed=None, safety_tolerance=2, output_format="jpeg"):
    """Edit an image using Black Forest Labs API."""
    
    bfl_api_key = api_key or load_bfl_api_key()
    
    if not bfl_api_key:
        raise ValueError("No BFL API key found. Set BFL_API_KEY environment variable or use --bfl-api-key")
    
    url = f"https://api.us1.bfl.ai/v1/{model}"
    
    # Convert image to base64
    buffered = io.BytesIO()
    # Ensure image is in RGB mode (no alpha channel)
    if input_image.mode in ('RGBA', 'LA'):
        # Create a white background
        background = Image.new('RGB', input_image.size, (255, 255, 255))
        background.paste(input_image, mask=input_image.split()[-1] if input_image.mode == 'RGBA' else None)
        input_image = background
    elif input_image.mode != 'RGB':
        input_image = input_image.convert('RGB')
    
    input_image.save(buffered, format="JPEG", quality=95)
    img_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    headers = {
        "accept": "application/json",
        "x-key": bfl_api_key,
        "Content-Type": "application/json"
    }
    
    data = {
        "prompt": prompt,
        "input_image": img_base64,
        "output_format": output_format,
        "safety_tolerance": safety_tolerance
    }
    
    if seed is not None:
        data["seed"] = seed
    
    # Debug: show image size
    print(f"Input image size: {input_image.size}")
    
    # Resize image if it's too large (BFL might have size limits)
    max_dimension = 1536
    if input_image.width > max_dimension or input_image.height > max_dimension:
        input_image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        print(f"Resized image to: {input_image.size}")
        # Re-encode the resized image
        buffered = io.BytesIO()
        input_image.save(buffered, format="JPEG", quality=95)
        img_base64 = base64.b64encode(buffered.getvalue()).decode()
        data["input_image"] = img_base64
    
    # Make the request
    response = requests.post(url, headers=headers, json=data)
    if response.status_code != 200:
        print(f"Error response: {response.text}")
    response.raise_for_status()
    
    result = response.json()
    request_id = result.get("id")
    
    if not request_id:
        raise ValueError("No request ID returned from BFL API")
    
    # Poll for result
    result_url = f"https://api.us1.bfl.ai/v1/get_result?id={request_id}"
    
    print(f"Request submitted. Waiting for generation to complete...")
    while True:
        time.sleep(1.5)
        result_response = requests.get(result_url, headers={"accept": "application/json", "x-key": bfl_api_key})
        result_response.raise_for_status()
        
        result_data = result_response.json()
        status = result_data.get("status")
        
        if status == "Ready":
            image_url = result_data.get("result", {}).get("sample")
            if not image_url:
                raise ValueError("No image URL in result")
            
            # Download the image
            img_response = requests.get(image_url)
            img_response.raise_for_status()
            
            return Image.open(io.BytesIO(img_response.content))
            
        elif status not in ["Processing", "Queued", "Pending"]:
            raise ValueError(f"Generation failed with status: {status}. Full response: {result_data}")

def resolve_output_path(output_path, output_dir):
    """Resolve output path relative to output directory if provided."""
    if output_dir and not os.path.isabs(output_path):
        return os.path.join(output_dir, output_path)
    return output_path

def resolve_input_path(input_path, base_dir):
    """Resolve input path relative to the caller's working directory when provided.

    - Leaves URLs and absolute paths unchanged.
    - For relative paths, prefers `base_dir` (the original CWD passed via --output-dir)
      when it exists there; otherwise returns the original relative path.
    """
    if input_path is None:
        return None
    # URLs should pass through untouched
    if input_path.startswith(("http://", "https://")):
        return input_path
    # Absolute paths should pass through untouched
    if os.path.isabs(input_path):
        return input_path
    # Prefer resolving relative paths against the original working directory
    if base_dir:
        candidate = os.path.join(base_dir, input_path)
        if os.path.exists(candidate):
            return candidate
    return input_path

def add_api_arguments(parser):
    """Add common API-related arguments to a parser."""
    parser.add_argument("--provider", type=str, default="openai", choices=["openai", "bfl"],
                       help="Image generation provider (default: openai)")
    parser.add_argument("--api-key", type=str, help="OpenAI API key (defaults to OPENAI_API_KEY env variable)")
    parser.add_argument("--api-base", type=str, help="OpenAI API base URL (optional)")
    parser.add_argument("--bfl-api-key", type=str, help="Black Forest Labs API key (defaults to BFL_API_KEY env variable)")
    parser.add_argument("--output-dir", type=str, help="Directory for output files (used internally)")

def generate_command(args):
    """Handle the generate subcommand."""
    try:
        if args.provider == "bfl":
            # Use Black Forest Labs API
            # Map size to aspect ratio
            aspect_ratio_map = {
                "1024x1024": "1:1",
                "1536x1024": "3:2",
                "1024x1536": "2:3",
                "1792x1024": "16:9",
                "1024x1792": "9:16"
            }
            aspect_ratio = aspect_ratio_map.get(args.size, "1:1")
            
            # Automatically select model based on quality if not explicitly specified
            model = getattr(args, 'bfl_model', None)
            if not model:
                quality_to_model = {
                    "high": "flux-kontext-max",
                    "medium": "flux-kontext-pro",
                    "low": "flux-dev",
                    "auto": "flux-kontext-pro"  # Default to medium quality
                }
                model = quality_to_model.get(args.quality, "flux-kontext-pro")
            
            result_image = bfl_generate_image(
                prompt=args.prompt,
                api_key=args.bfl_api_key,
                model=model,
                aspect_ratio=aspect_ratio,
                seed=getattr(args, 'seed', None),
                safety_tolerance=getattr(args, 'safety_tolerance', 6),
                output_format=args.output_format
            )
        else:
            # Use OpenAI API
            result_image = generate_image(
                prompt=args.prompt,
                api_key=args.api_key,
                api_base=args.api_base,
                background=args.background,
                quality=args.quality,
                size=args.size,
                output_format=args.output_format,
                output_compression=args.output_compression,
                moderation=args.moderation
            )

        # Save the result
        output_path = resolve_output_path(args.output, args.output_dir)
        result_image.save(output_path, format=args.output_format.upper())
        print(f"Image saved to {output_path}")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def edit_command(args):
    """Handle the edit subcommand."""
    try:
        # Resolve input (and optional mask) relative to the caller's CWD if provided
        resolved_input = resolve_input_path(args.input, getattr(args, 'output_dir', None))
        input_image = process_image(resolved_input)
        
        if args.provider == "bfl":
            # Use Black Forest Labs API
            # Automatically select model based on quality for editing
            quality_to_model = {
                "high": "flux-kontext-max",
                "medium": "flux-kontext-pro",
                "low": "flux-dev",
                "auto": "flux-kontext-pro"   # Default to medium quality
            }
            model = quality_to_model.get(args.quality, "flux-kontext-pro")
            
            result_image = bfl_edit_image(
                input_image=input_image,
                prompt=args.prompt,
                api_key=args.bfl_api_key,
                model=model,
                seed=getattr(args, 'seed', None),
                safety_tolerance=getattr(args, 'safety_tolerance', 2),
                output_format=args.output_format
            )
        else:
            # Use OpenAI API
            resolved_mask = resolve_input_path(args.mask, getattr(args, 'output_dir', None)) if args.mask else None
            mask_image = process_image(resolved_mask) if resolved_mask else None
            result_image = edit_image(
                input_image=input_image,
                prompt=args.prompt,
                mask_image=mask_image,
                api_key=args.api_key,
                api_base=args.api_base,
                quality=args.quality,
                size=args.size
            )

        output_path = resolve_output_path(args.output, args.output_dir)
        result_image.save(output_path, format=args.output_format.upper())
        print(f"Image saved to {output_path}")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def variations_command(args):
    """Handle the variations subcommand."""
    try:
        resolved_input = resolve_input_path(args.input, getattr(args, 'output_dir', None))
        input_image = process_image(resolved_input)
        
        if args.provider == "bfl":
            print("Error: Variations not supported with BFL provider")
            exit(1)
        else:
            # Use OpenAI API
            result_images = create_variations(
                input_image=input_image,
                api_key=args.api_key,
                api_base=args.api_base,
                n=args.n,
                size=args.size
            )
            
            # Handle single or multiple outputs
            if args.n == 1:
                output_path = resolve_output_path(args.output, args.output_dir)
                result_images.save(output_path, format=args.output_format.upper())
                print(f"Image saved to {output_path}")
            else:
                # Save multiple variations
                base_output = resolve_output_path(args.output, args.output_dir)
                base_name = base_output.rsplit('.', 1)[0]
                extension = base_output.rsplit('.', 1)[1] if '.' in base_output else 'png'
                
                for i, img in enumerate(result_images):
                    output_path = f"{base_name}_{i+1}.{extension}"
                    img.save(output_path, format=args.output_format.upper())
                    print(f"Image saved to {output_path}")
                    
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def analyze_command(args):
    """Handle the analyze subcommand."""
    try:
        if args.input:
            # Analyze image
            resolved_input = resolve_input_path(args.input, getattr(args, 'output_dir', None))
            input_image = process_image(resolved_input)
            _, description = analyze_image(
                input_image=input_image,
                prompt=args.prompt or "Describe this image in detail.",
                api_key=args.api_key,
                api_base=args.api_base,
                detail=args.detail
            )

            print(description)

        else:
            _, response = analyze_text(
                prompt=args.prompt or "Please provide a prompt.",
                api_key=args.api_key,
                api_base=args.api_base
            )

            print(response)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def makenoise_command(args):
    """Handle the makenoise subcommand."""
    try:
        # Generate sound effect
        audio_data = generate_sound_effect(
            prompt=args.prompt,
            api_key=args.elevenlabs_api_key,
            duration=args.duration,
            prompt_influence=args.prompt_influence
        )
        
        # Save the audio file
        output_path = resolve_output_path(args.output, args.output_dir)
        with open(output_path, 'wb') as f:
            # Write the audio data directly
            for chunk in audio_data:
                f.write(chunk)
        
        print(f"Sound effect saved to {output_path}")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def main():
    parser = argparse.ArgumentParser(description="Generate, edit, or analyze images using OpenAI.")
    add_api_arguments(parser)
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Generate command
    generate_parser = subparsers.add_parser("generate", help="Generate a new image from a text prompt")
    generate_parser.add_argument("prompt", type=str, help="Text prompt for image generation")
    generate_parser.add_argument("output", type=str, help="Output image filename")
    generate_parser.add_argument("--background", type=str, default="auto",
                               choices=["auto", "transparent", "opaque"],
                               help="Background type for generation (default: auto)")
    generate_parser.add_argument("--quality", type=str, default="medium",
                               choices=["auto", "high", "medium", "low"],
                               help="Image quality (default: medium)")
    generate_parser.add_argument("--size", type=str, default="1024x1024",
                               help="Image size (default: 1024x1024). Options: 'auto', '1024x1024', '1536x1024', '1024x1536', '1792x1024'")
    generate_parser.add_argument("--output-format", type=str, default="png",
                               choices=["png", "jpeg", "webp"],
                               help="Output format (default: png)")
    generate_parser.add_argument("--output-compression", type=int, default=100,
                               help="Output compression level (0-100, default: 100)")
    generate_parser.add_argument("--moderation", type=str, default="low",
                               choices=["auto", "low"],
                               help="Moderation level (default: low)")
    # BFL-specific arguments
    generate_parser.add_argument("--bfl-model", type=str,
                               choices=["flux-kontext-pro", "flux-kontext-max", "flux-pro-1.1-ultra", 
                                       "flux-pro-1.1", "flux-pro", "flux-dev"],
                               help="BFL model to use (auto-selected based on quality if not specified)")
    generate_parser.add_argument("--seed", type=int, help="Seed for reproducibility (BFL only)")
    generate_parser.add_argument("--safety-tolerance", type=int, default=6,
                               choices=[0, 1, 2, 3, 4, 5, 6],
                               help="Safety tolerance 0=strict, 6=permissive (BFL only, default: 6)")
    add_api_arguments(generate_parser)
    generate_parser.set_defaults(func=generate_command)
    
    # Edit command
    edit_parser = subparsers.add_parser("edit", help="Edit an existing image")
    edit_parser.add_argument("input", type=str, help="Input image path for editing")
    edit_parser.add_argument("prompt", type=str, help="Text prompt for image editing")
    edit_parser.add_argument("output", type=str, help="Output image filename")
    edit_parser.add_argument("--mask", type=str, help="Mask image path for editing (optional)")
    edit_parser.add_argument("--quality", type=str, default="medium",
                           choices=["auto", "high", "medium", "low"],
                           help="Image quality (default: medium)")
    edit_parser.add_argument("--size", type=str, default="auto",
                           help="Image size (default: auto). Options: 'auto', '1024x1024', '1536x1024', '1024x1536'")
    edit_parser.add_argument("--output-format", type=str, default="png",
                           choices=["png", "jpeg", "webp"],
                           help="Output format (default: png)")
    # BFL-specific arguments for editing
    edit_parser.add_argument("--seed", type=int, help="Seed for reproducibility (BFL only)")
    edit_parser.add_argument("--safety-tolerance", type=int, default=2,
                           choices=[0, 1, 2],
                           help="Safety tolerance 0=strict, 2=permissive (BFL edit mode only allows 0-2, default: 2)")
    add_api_arguments(edit_parser)
    edit_parser.set_defaults(func=edit_command)
    
    # Variations command
    variations_parser = subparsers.add_parser("variations", help="Create variations of an existing image")
    variations_parser.add_argument("input", type=str, help="Input image path for variations")
    variations_parser.add_argument("output", type=str, help="Output image filename")
    variations_parser.add_argument("--n", type=int, default=1,
                                  help="Number of variations to generate (default: 1)")
    variations_parser.add_argument("--size", type=str, default="1024x1024",
                                  help="Image size (default: 1024x1024). Can be '1024x1024', '1536x1024', '1024x1536'")
    variations_parser.add_argument("--output-format", type=str, default="png",
                                  choices=["png", "jpeg", "webp"],
                                  help="Output format (default: png)")
    add_api_arguments(variations_parser)
    variations_parser.set_defaults(func=variations_command)
    
    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze an image or text")
    analyze_parser.add_argument("input", type=str, help="Input image path for analysis")
    analyze_parser.add_argument("prompt", type=str, help="Text prompt for analysis")
    analyze_parser.add_argument("--detail", type=str, default="auto",
                              choices=["auto", "low", "high"],
                              help="Detail level for analysis (default: auto)")
    add_api_arguments(analyze_parser)
    analyze_parser.set_defaults(func=analyze_command)
    
    # Makenoise command
    makenoise_parser = subparsers.add_parser("makenoise", help="Generate sound effects from text prompts")
    makenoise_parser.add_argument("prompt", type=str, help="Text prompt for sound effect generation")
    makenoise_parser.add_argument("output", type=str, help="Output audio filename (e.g., sound.mp3)")
    makenoise_parser.add_argument("--duration", type=float, help="Duration of the sound effect in seconds (optional)")
    makenoise_parser.add_argument("--prompt-influence", type=float, help="How much the prompt influences generation (0.0-1.0)")
    makenoise_parser.add_argument("--elevenlabs-api-key", type=str, help="ElevenLabs API key (defaults to ELEVENLABS_API_KEY env variable)")
    makenoise_parser.add_argument("--output-dir", type=str, help="Directory for output files (used internally)")
    makenoise_parser.set_defaults(func=makenoise_command)
    
    # Parse arguments
    args = parser.parse_args()
    
    # If no command is provided, show help
    if not args.command:
        parser.print_help()
        return
    
    # Call the appropriate function
    args.func(args)

if __name__ == "__main__":
    main()