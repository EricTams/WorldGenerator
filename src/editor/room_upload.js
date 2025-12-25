// AIDEV-NOTE: Room Upload System for Graph-Based Dungeon Generation
// Handles image upload, tile matching, and room template creation

const RoomUpload = {
    // Modal elements
    modal: null,
    dropZone: null,
    previewCanvas: null,
    previewCtx: null,
    
    // Atlas pixel data for matching
    atlasPixelData: null,
    atlasImage: null,
    
    // Current upload state
    currentImage: null,
    parsedTiles: null,
    parsedWidth: 0,
    parsedHeight: 0,
    
    // Constants
    TILE_SIZE: 16,
    
    /**
     * Initialize the room upload system
     */
    async init() {
        await this.loadAtlasPixelData();
        this.createModal();
        console.log('RoomUpload initialized');
    },
    
    /**
     * Load atlas image and extract pixel data for all tiles
     * AIDEV-NOTE: Uses the embedded base64 atlas for file:// compatibility
     */
    async loadAtlasPixelData() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.atlasImage = img;
                
                // Create canvas to extract pixel data
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // Extract pixel data for each tile
                this.atlasPixelData = [];
                const tilesPerSide = TileAtlas.TILES_PER_SIDE;
                
                for (let i = 0; i < TileAtlas.TileData.length; i++) {
                    const col = i % tilesPerSide;
                    const row = Math.floor(i / tilesPerSide);
                    const x = col * this.TILE_SIZE;
                    const y = row * this.TILE_SIZE;
                    
                    const imageData = ctx.getImageData(x, y, this.TILE_SIZE, this.TILE_SIZE);
                    this.atlasPixelData.push(imageData.data);
                }
                
                console.log(`Loaded pixel data for ${this.atlasPixelData.length} atlas tiles`);
                resolve();
            };
            img.onerror = () => reject(new Error('Failed to load atlas for pixel matching'));
            img.src = TileAtlas.ATLAS_DATA_URL;
        });
    },
    
    /**
     * Create the upload modal HTML
     */
    createModal() {
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.id = 'room-upload-modal';
        this.modal.className = 'modal hidden';
        
        this.modal.innerHTML = `
            <div class="modal-content room-upload-content">
                <div class="modal-header">
                    <h3>Upload Room Template</h3>
                    <button id="btn-room-upload-close" class="btn btn-icon">✕</button>
                </div>
                <div class="modal-body">
                    <div id="room-drop-zone" class="room-drop-zone">
                        <div class="drop-zone-content">
                            <span class="drop-icon">📁</span>
                            <p>Drag & drop a room image here</p>
                            <p class="drop-hint">or click to select a file</p>
                            <p class="drop-info">Image should use 16x16 tiles from the game atlas</p>
                        </div>
                        <input type="file" id="room-file-input" accept="image/*" style="display: none;">
                    </div>
                    <div id="room-preview-section" class="room-preview-section hidden">
                        <div class="preview-header">
                            <h4>Preview</h4>
                            <span id="room-preview-info"></span>
                        </div>
                        <canvas id="room-preview-canvas" class="room-preview-canvas"></canvas>
                        <div class="preview-stats">
                            <span id="room-match-stats"></span>
                        </div>
                        <div class="room-name-field">
                            <label>Room Name:</label>
                            <input type="text" id="room-name-input" class="modal-input" placeholder="My Room">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="btn-room-upload-cancel" class="btn btn-secondary">Cancel</button>
                    <button id="btn-room-upload-save" class="btn btn-primary" disabled>Save Room</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        // Get element references
        this.dropZone = document.getElementById('room-drop-zone');
        this.previewCanvas = document.getElementById('room-preview-canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        // Set up event listeners
        this.setupEventListeners();
    },
    
    /**
     * Set up all event listeners for the modal
     */
    setupEventListeners() {
        const fileInput = document.getElementById('room-file-input');
        const closeBtn = document.getElementById('btn-room-upload-close');
        const cancelBtn = document.getElementById('btn-room-upload-cancel');
        const saveBtn = document.getElementById('btn-room-upload-save');
        
        // Drop zone events
        this.dropZone.addEventListener('click', () => fileInput.click());
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageFile(file);
            }
        });
        
        // Modal buttons
        closeBtn.addEventListener('click', () => this.hide());
        cancelBtn.addEventListener('click', () => this.hide());
        saveBtn.addEventListener('click', () => this.saveRoom());
    },
    
    /**
     * Show the upload modal
     */
    show() {
        this.reset();
        this.modal.classList.remove('hidden');
    },
    
    /**
     * Hide the upload modal
     */
    hide() {
        this.modal.classList.add('hidden');
        this.reset();
    },
    
    /**
     * Reset the modal state
     */
    reset() {
        this.currentImage = null;
        this.parsedTiles = null;
        this.parsedWidth = 0;
        this.parsedHeight = 0;
        
        document.getElementById('room-preview-section').classList.add('hidden');
        document.getElementById('btn-room-upload-save').disabled = true;
        document.getElementById('room-name-input').value = '';
        document.getElementById('room-file-input').value = '';
    },
    
    /**
     * Handle an uploaded image file
     * @param {File} file
     */
    handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.parseImage(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },
    
    /**
     * Parse an image into tiles with auto-crop
     * AIDEV-NOTE: Auto-crops to bounding box of non-transparent content
     * @param {HTMLImageElement} img
     */
    parseImage(img) {
        // Calculate tile dimensions
        const fullWidth = Math.floor(img.width / this.TILE_SIZE);
        const fullHeight = Math.floor(img.height / this.TILE_SIZE);
        
        if (fullWidth === 0 || fullHeight === 0) {
            alert('Image is too small. Must be at least 16x16 pixels.');
            return;
        }
        
        // Create canvas to read pixel data
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // First pass: parse all tiles and find bounding box
        const fullTiles = new Int16Array(fullWidth * fullHeight);
        let minTX = fullWidth, minTY = fullHeight;
        let maxTX = -1, maxTY = -1;
        
        for (let ty = 0; ty < fullHeight; ty++) {
            for (let tx = 0; tx < fullWidth; tx++) {
                const x = tx * this.TILE_SIZE;
                const y = ty * this.TILE_SIZE;
                const imageData = ctx.getImageData(x, y, this.TILE_SIZE, this.TILE_SIZE);
                
                const tileIndex = this.matchTile(imageData.data);
                fullTiles[ty * fullWidth + tx] = tileIndex;
                
                // Track bounding box of non-air tiles
                if (tileIndex >= 0) {
                    minTX = Math.min(minTX, tx);
                    minTY = Math.min(minTY, ty);
                    maxTX = Math.max(maxTX, tx);
                    maxTY = Math.max(maxTY, ty);
                }
            }
        }
        
        // Check if we found any non-air tiles
        if (maxTX < 0) {
            alert('No matching tiles found in image. Make sure the image uses tiles from the game atlas.');
            return;
        }
        
        // AIDEV-NOTE: Auto-crop to exact bounding box (no padding)
        // This ensures structure edges are the actual structure, not air padding
        
        // Extract cropped region
        this.parsedWidth = maxTX - minTX + 1;
        this.parsedHeight = maxTY - minTY + 1;
        this.parsedTiles = new Int16Array(this.parsedWidth * this.parsedHeight);
        
        let matchCount = 0;
        let airCount = 0;
        
        for (let ty = 0; ty < this.parsedHeight; ty++) {
            for (let tx = 0; tx < this.parsedWidth; tx++) {
                const srcIdx = (ty + minTY) * fullWidth + (tx + minTX);
                const dstIdx = ty * this.parsedWidth + tx;
                const tileIndex = fullTiles[srcIdx];
                this.parsedTiles[dstIdx] = tileIndex;
                
                if (tileIndex >= 0) {
                    matchCount++;
                } else {
                    airCount++;
                }
            }
        }
        
        console.log(`Auto-cropped from ${fullWidth}x${fullHeight} to ${this.parsedWidth}x${this.parsedHeight}`);
        
        // Show preview
        this.showPreview(matchCount, airCount);
    },
    
    /**
     * Match a tile's pixel data against the atlas
     * AIDEV-NOTE: Exact pixel matching - all RGBA values must match
     * @param {Uint8ClampedArray} pixelData - 16x16x4 RGBA values
     * @returns {number} Tile index or -1 if no match (treated as air)
     */
    matchTile(pixelData) {
        // First check if the tile is mostly transparent (air)
        let transparentPixels = 0;
        for (let i = 3; i < pixelData.length; i += 4) {
            if (pixelData[i] < 128) transparentPixels++;
        }
        if (transparentPixels > (this.TILE_SIZE * this.TILE_SIZE) / 2) {
            return -1; // Mostly transparent = air
        }
        
        // Try to match against each atlas tile
        for (let tileIdx = 0; tileIdx < this.atlasPixelData.length; tileIdx++) {
            if (this.pixelsMatch(pixelData, this.atlasPixelData[tileIdx])) {
                return tileIdx;
            }
        }
        
        // No match found - treat as air
        return -1;
    },
    
    /**
     * Check if two pixel arrays match exactly
     * @param {Uint8ClampedArray} a
     * @param {Uint8ClampedArray} b
     * @returns {boolean}
     */
    pixelsMatch(a, b) {
        if (a.length !== b.length) return false;
        
        for (let i = 0; i < a.length; i++) {
            // Allow small tolerance for compression artifacts
            if (Math.abs(a[i] - b[i]) > 2) {
                return false;
            }
        }
        return true;
    },
    
    /**
     * Show the preview of parsed tiles
     * @param {number} matchCount
     * @param {number} airCount
     */
    showPreview(matchCount, airCount) {
        const previewSection = document.getElementById('room-preview-section');
        const previewInfo = document.getElementById('room-preview-info');
        const matchStats = document.getElementById('room-match-stats');
        const saveBtn = document.getElementById('btn-room-upload-save');
        
        // Update info
        previewInfo.textContent = `${this.parsedWidth}×${this.parsedHeight} tiles`;
        matchStats.textContent = `Matched: ${matchCount} tiles, Air: ${airCount} tiles`;
        
        // Render preview
        const scale = 2;
        this.previewCanvas.width = this.parsedWidth * this.TILE_SIZE * scale;
        this.previewCanvas.height = this.parsedHeight * this.TILE_SIZE * scale;
        this.previewCtx.imageSmoothingEnabled = false;
        
        this.renderPreview(scale);
        
        // Show section and enable save
        previewSection.classList.remove('hidden');
        saveBtn.disabled = false;
        
        // Set default name
        const nameInput = document.getElementById('room-name-input');
        if (!nameInput.value) {
            nameInput.value = `Room ${RoomTemplates.getAllTemplates().length + 1}`;
        }
    },
    
    /**
     * Render the parsed tiles to the preview canvas
     * @param {number} scale
     */
    renderPreview(scale) {
        const ctx = this.previewCtx;
        const tileSize = this.TILE_SIZE * scale;
        
        // Clear with dark background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        // Draw each tile
        for (let ty = 0; ty < this.parsedHeight; ty++) {
            for (let tx = 0; tx < this.parsedWidth; tx++) {
                const tileIndex = this.parsedTiles[ty * this.parsedWidth + tx];
                const x = tx * tileSize;
                const y = ty * tileSize;
                
                if (tileIndex >= 0) {
                    // Draw tile from atlas
                    const col = tileIndex % TileAtlas.TILES_PER_SIDE;
                    const row = Math.floor(tileIndex / TileAtlas.TILES_PER_SIDE);
                    const sx = col * this.TILE_SIZE;
                    const sy = row * this.TILE_SIZE;
                    
                    ctx.drawImage(
                        this.atlasImage,
                        sx, sy, this.TILE_SIZE, this.TILE_SIZE,
                        x, y, tileSize, tileSize
                    );
                } else {
                    // Draw air indicator
                    ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
                    ctx.fillRect(x, y, tileSize, tileSize);
                }
                
                // Draw grid
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.strokeRect(x, y, tileSize, tileSize);
            }
        }
    },
    
    /**
     * Save the parsed room as a template
     */
    saveRoom() {
        const name = document.getElementById('room-name-input').value.trim() || 'Unnamed Room';
        
        // Create thumbnail from preview
        const thumbnail = this.previewCanvas.toDataURL('image/png');
        
        // Create the template
        const template = RoomTemplates.createTemplate(
            name,
            this.parsedWidth,
            this.parsedHeight,
            this.parsedTiles,
            thumbnail
        );
        
        // Save to localStorage
        RoomTemplates.saveToLocal();
        
        // Update UI if BiomeEditor exists
        if (typeof BiomeEditor !== 'undefined' && BiomeEditor.renderRoomTemplateList) {
            BiomeEditor.renderRoomTemplateList();
        }
        
        // Hide modal
        this.hide();
        
        console.log(`Saved room template: ${name} (${template.openings.length} openings)`);
    }
};

