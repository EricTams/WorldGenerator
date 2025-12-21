// AIDEV-NOTE: WebGL Tile Renderer for WorldGenerator
// Renders the tile-based world using a texture atlas

const Renderer = {
    // WebGL context and canvas
    canvas: null,
    gl: null,
    width: 0,
    height: 0,
    
    // Shader program
    program: null,
    
    // Buffers
    quadBuffer: null,
    
    // Textures
    atlasTexture: null,
    atlasLoaded: false,
    
    // Uniforms
    uniforms: {},
    
    // Tile size in pixels
    TILE_SIZE: 16,
    
    // 2D canvas for overlays
    overlayCanvas: null,
    overlayCtx: null,
    
    /**
     * Initialize the renderer
     * @param {string} canvasId
     */
    async init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas '${canvasId}' not found!`);
        }
        
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false
        });
        
        if (!this.gl) {
            throw new Error('WebGL not supported!');
        }
        
        // Set initial size
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Initialize shaders
        this.initShaders();
        
        // Initialize buffers
        this.initBuffers();
        
        // Load atlas texture
        await this.loadAtlas();
        
        // Create overlay canvas for biome visualization
        this.initOverlay();
        
        console.log('Renderer initialized');
    },
    
    /**
     * Initialize 2D overlay canvas for visualizations
     */
    initOverlay() {
        // Use the overlay canvas from HTML
        this.overlayCanvas = document.getElementById('overlay-canvas');
        if (this.overlayCanvas) {
            this.overlayCanvas.width = this.width;
            this.overlayCanvas.height = this.height;
            this.overlayCtx = this.overlayCanvas.getContext('2d');
        }
    },
    
    /**
     * Resize canvas to window size
     */
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        if (this.gl) {
            this.gl.viewport(0, 0, this.width, this.height);
        }
        
        // Resize overlay canvas
        if (this.overlayCanvas) {
            this.overlayCanvas.width = this.width;
            this.overlayCanvas.height = this.height;
        }
        
        // Update camera if exists
        if (typeof Camera !== 'undefined') {
            Camera.resize(this.width, this.height);
        }
    },
    
    /**
     * Initialize shader programs
     */
    initShaders() {
        const gl = this.gl;
        
        // Vertex shader - transforms tile positions
        const vsSource = `
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;
            
            uniform vec2 uResolution;
            uniform vec2 uCameraPos;
            uniform float uZoom;
            uniform vec2 uTilePos;
            uniform float uTileSize;
            
            varying vec2 vTexCoord;
            
            void main() {
                // World position of tile corner
                vec2 worldPos = uTilePos * uTileSize + aPosition * uTileSize;
                
                // Apply camera transform
                vec2 screenPos = (worldPos - uCameraPos) * uZoom;
                
                // Convert to clip space (-1 to 1)
                vec2 clipPos = screenPos / (uResolution * 0.5);
                
                gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
                vTexCoord = aTexCoord;
            }
        `;
        
        // Fragment shader - samples from atlas
        const fsSource = `
            precision mediump float;
            
            varying vec2 vTexCoord;
            
            uniform sampler2D uAtlas;
            uniform vec2 uUVOffset;
            uniform vec2 uUVSize;
            
            void main() {
                vec2 uv = uUVOffset + vTexCoord * uUVSize;
                vec4 color = texture2D(uAtlas, uv);
                
                // Discard fully transparent pixels
                if (color.a < 0.1) {
                    discard;
                }
                
                gl_FragColor = color;
            }
        `;
        
        // Compile shaders
        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        
        // Create program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(this.program));
        }
        
        // Get uniform locations
        this.uniforms = {
            uResolution: gl.getUniformLocation(this.program, 'uResolution'),
            uCameraPos: gl.getUniformLocation(this.program, 'uCameraPos'),
            uZoom: gl.getUniformLocation(this.program, 'uZoom'),
            uTilePos: gl.getUniformLocation(this.program, 'uTilePos'),
            uTileSize: gl.getUniformLocation(this.program, 'uTileSize'),
            uAtlas: gl.getUniformLocation(this.program, 'uAtlas'),
            uUVOffset: gl.getUniformLocation(this.program, 'uUVOffset'),
            uUVSize: gl.getUniformLocation(this.program, 'uUVSize')
        };
        
        // Get attribute locations
        this.attribs = {
            aPosition: gl.getAttribLocation(this.program, 'aPosition'),
            aTexCoord: gl.getAttribLocation(this.program, 'aTexCoord')
        };
    },
    
    /**
     * Compile a shader
     * @param {number} type
     * @param {string} source
     * @returns {WebGLShader}
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile error: ' + info);
        }
        
        return shader;
    },
    
    /**
     * Initialize vertex buffers
     */
    initBuffers() {
        const gl = this.gl;
        
        // Quad vertices (position + texcoord interleaved)
        // Two triangles forming a quad
        const quadData = new Float32Array([
            // Position    TexCoord
            0, 0,          0, 0,
            1, 0,          1, 0,
            0, 1,          0, 1,
            1, 0,          1, 0,
            1, 1,          1, 1,
            0, 1,          0, 1
        ]);
        
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    },
    
    /**
     * Load the tile atlas texture
     * Uses embedded base64 data URL for file:// protocol compatibility
     */
    async loadAtlas() {
        const gl = this.gl;
        
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                // Create texture
                this.atlasTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
                
                // Upload image
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                
                // Set parameters for pixel art (no filtering)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                
                this.atlasLoaded = true;
                console.log('Atlas texture loaded');
                resolve();
            };
            image.onerror = () => {
                reject(new Error('Failed to load atlas texture!'));
            };
            // Use embedded base64 data URL for file:// protocol compatibility
            // AIDEV-NOTE: This avoids CORS issues when opening index.html directly
            image.src = TileAtlas.ATLAS_DATA_URL;
        });
    },
    
    /**
     * Clear the screen
     */
    clear() {
        const gl = this.gl;
        // Dark background color
        gl.clearColor(0.051, 0.067, 0.09, 1.0); // #0d1117
        gl.clear(gl.COLOR_BUFFER_BIT);
    },
    
    /**
     * Render the world
     * @param {Object} world
     * @param {Object} camera
     */
    renderWorld(world, camera) {
        if (!this.atlasLoaded || !world || !world.tiles) return;
        
        const gl = this.gl;
        
        // Use shader program
        gl.useProgram(this.program);
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Set up vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        
        const stride = 4 * 4; // 4 floats per vertex, 4 bytes per float
        gl.enableVertexAttribArray(this.attribs.aPosition);
        gl.vertexAttribPointer(this.attribs.aPosition, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.attribs.aTexCoord);
        gl.vertexAttribPointer(this.attribs.aTexCoord, 2, gl.FLOAT, false, stride, 8);
        
        // Set common uniforms
        gl.uniform2f(this.uniforms.uResolution, this.width, this.height);
        gl.uniform2f(this.uniforms.uCameraPos, camera.x, camera.y);
        gl.uniform1f(this.uniforms.uZoom, camera.zoom);
        gl.uniform1f(this.uniforms.uTileSize, this.TILE_SIZE);
        
        // Bind atlas texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        gl.uniform1i(this.uniforms.uAtlas, 0);
        
        // Get visible tile bounds for culling
        const bounds = camera.getVisibleTileBounds(this.TILE_SIZE);
        
        // Clamp to world bounds
        const minX = Math.max(bounds.minX, 0);
        const maxX = Math.min(bounds.maxX, world.width);
        const minY = Math.max(bounds.minY, 0);
        const maxY = Math.min(bounds.maxY, world.height);
        
        // Render background tiles first (far BG, then BG)
        this.renderTileLayer(world, minX, maxX, minY, maxY, 'bg');
        
        // Render foreground tiles
        this.renderTileLayer(world, minX, maxX, minY, maxY, 'fg');
    },
    
    /**
     * Render overlays (biome or noise visualization)
     * @param {Object} world
     * @param {Object} camera
     * @param {boolean} showBiomes
     * @param {string|null} noiseType - which noise to visualize
     */
    renderOverlay(world, camera, showBiomes, noiseType) {
        if (!this.overlayCtx) return;
        
        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Skip if no world data or nothing to show
        if (!world || !world.width || !world.height) return;
        if (!showBiomes && !noiseType) return;
        
        const bounds = camera.getVisibleTileBounds(this.TILE_SIZE);
        const minX = Math.max(Math.floor(bounds.minX), 0);
        const maxX = Math.min(Math.ceil(bounds.maxX), world.width);
        const minY = Math.max(Math.floor(bounds.minY), 0);
        const maxY = Math.min(Math.ceil(bounds.maxY), world.height);
        
        const tileScreenSize = this.TILE_SIZE * camera.zoom;
        ctx.globalAlpha = 0.7;
        
        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const screenX = (x * this.TILE_SIZE - camera.x) * camera.zoom + this.width / 2;
                const screenY = (y * this.TILE_SIZE - camera.y) * camera.zoom + this.height / 2;
                
                let color = null;
                
                if (noiseType) {
                    // Noise visualization (may return null for dynamic with no hover)
                    const value = this.getNoiseValue(x, y, noiseType, world);
                    if (value !== null) {
                        color = this.valueToColor(value);
                    }
                } else if (showBiomes && world.biomeMap) {
                    // Biome visualization
                    const biomeId = world.biomeMap[y * world.width + x];
                    const biome = biomeId ? BiomeData.getBiome(biomeId) : null;
                    color = biome?.color || null;
                }
                
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(screenX, screenY, tileScreenSize + 1, tileScreenSize + 1);
                }
            }
        }
        
        ctx.globalAlpha = 1.0;
    },
    
    /**
     * Get noise value at position with unified modifier chain
     * AIDEV-NOTE: Modifiers applied in order. xScale/yScale affect sampling, others modify result.
     * @param {string} noiseType - The noise type or 'dynamic'
     */
    getNoiseValue(x, y, noiseType, world) {
        let modifiers = [];
        
        // Handle dynamic overlay - get value type and modifiers from Game.dynamicOverlay
        if (noiseType === 'dynamic') {
            const dyn = Game.dynamicOverlay;
            if (!dyn.value) return null;
            noiseType = dyn.value;
            modifiers = dyn.modifiers || [];
        }
        
        // Collect scale factors from modifiers
        let xScale = 1, yScale = 1;
        for (const mod of modifiers) {
            if (mod.op === 'xScale') xScale *= (mod.arg ?? 1);
            if (mod.op === 'yScale') yScale *= (mod.arg ?? 1);
        }
        
        // Sample value (with scaling for noise types)
        let value;
        if (this.isNoiseValue(noiseType) && (xScale !== 1 || yScale !== 1)) {
            value = this.getScaledNoiseValue(x * xScale, y * yScale, noiseType);
        } else {
            const context = Dungeon.buildContext(x, y, world.width, world.height);
            value = context[noiseType] ?? 0;
        }
        
        // Apply non-scale modifiers in order
        for (const mod of modifiers) {
            if (mod.op !== 'xScale' && mod.op !== 'yScale') {
                value = this.applyModifier(value, mod);
            }
        }
        
        return value;
    },
    
    /**
     * Check if a value type is noise-based (can be scaled)
     */
    isNoiseValue(valueType) {
        const noiseTypes = ['biome_noise', 'cave_noise', 'detail_noise'];
        return noiseTypes.includes(valueType);
    },
    
    /**
     * Get noise value with scaled coordinates
     */
    getScaledNoiseValue(sx, sy, noiseType) {
        switch (noiseType) {
            case 'biome_noise':
                return Noise.get(sx, sy, 30);
            case 'cave_noise':
                return Noise.getFBM(sx, sy, 20, 3);
            case 'detail_noise':
                return Noise.get(sx, sy, 8);
            default:
                return 0;
        }
    },
    
    /**
     * Apply modifier to value
     */
    applyModifier(value, modifier) {
        const arg = modifier.arg ?? 1;
        switch (modifier.op) {
            case '%': return value % arg;
            case '*': return value * arg;
            case '/': return value / arg;
            case '+': return value + arg;
            case '-': return value - arg;
            case '^': return Math.pow(value, arg);
            case 'floor': return Math.floor(value);
            case 'round': return Math.round(value * arg) / arg;
            case 'abs': return Math.abs(value);
            default: return value;
        }
    },
    
    /**
     * Convert value to color with smooth cyclic gradient
     * Uses HSL hue which naturally wraps around
     * Every 3 units completes one full color cycle
     */
    valueToColor(value) {
        // Map value to hue: 120 degrees per unit, starting at green (120°)
        // This means every 3 units = 360° = full cycle
        // Value 0 = green, 0.5 = cyan, 1 = blue, 1.5 = purple, 2 = magenta, 2.5 = red, 3 = green again
        const hue = (120 + value * 120) % 360;
        
        // Keep saturation and lightness consistent for clear visualization
        const sat = 70;
        const light = 50;
        
        return `hsl(${hue}, ${sat}%, ${light}%)`;
    },
    
    /**
     * Render a layer of tiles
     * @param {Object} world
     * @param {number} minX
     * @param {number} maxX
     * @param {number} minY
     * @param {number} maxY
     * @param {string} layer - 'fg' or 'bg'
     */
    renderTileLayer(world, minX, maxX, minY, maxY, layer) {
        const gl = this.gl;
        const tiles = layer === 'bg' ? world.bgTiles : world.tiles;
        
        if (!tiles) return;
        
        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tileIndex = tiles[y * world.width + x];
                
                // Skip empty tiles
                if (tileIndex < 0) continue;
                
                // Get UV coordinates from atlas
                const uv = TileAtlas.getUV(tileIndex);
                
                // Set tile-specific uniforms
                gl.uniform2f(this.uniforms.uTilePos, x, y);
                gl.uniform2f(this.uniforms.uUVOffset, uv.u, uv.v);
                gl.uniform2f(this.uniforms.uUVSize, uv.uSize, uv.vSize);
                
                // Draw tile
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
        }
    },
    
    /**
     * Render the player
     * @param {Object} player
     * @param {Object} camera
     */
    renderPlayer(player, camera) {
        const gl = this.gl;
        
        // Use 2D canvas overlay for player (simpler than adding to WebGL)
        // For now, draw a simple indicator using WebGL
        
        // Get screen position
        const screenPos = camera.worldToScreen(player.x, player.y);
        
        // Draw player as a colored rectangle using a simple approach
        // We'll use a solid color by drawing with a white pixel from atlas
        // For simplicity, just render a CSS element overlay
        
        // Actually, let's use a separate 2D canvas overlay for UI elements
        // But for MVP, we'll skip the player visual and just use the tile under cursor
    }
};

