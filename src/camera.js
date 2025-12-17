// AIDEV-NOTE: Camera controller for WorldGenerator
// Handles pan, zoom, and smooth following for the game view

const Camera = {
    // Position (center of view)
    x: 0,
    y: 0,
    
    // Target position (for smooth following)
    targetX: 0,
    targetY: 0,
    
    // Zoom level (1 = 100%, 2 = 200%, etc.)
    zoom: 2,
    minZoom: 0.5,
    maxZoom: 8,
    
    // Viewport size
    width: 0,
    height: 0,
    
    // Smoothing factor (higher = snappier)
    smoothing: 8,
    
    /**
     * Initialize camera
     * @param {number} viewWidth
     * @param {number} viewHeight
     */
    init(viewWidth, viewHeight) {
        this.width = viewWidth;
        this.height = viewHeight;
        console.log(`Camera initialized: ${viewWidth}x${viewHeight}`);
    },
    
    /**
     * Update viewport size (on window resize)
     * @param {number} viewWidth
     * @param {number} viewHeight
     */
    resize(viewWidth, viewHeight) {
        this.width = viewWidth;
        this.height = viewHeight;
    },
    
    /**
     * Set target position for smooth following
     * @param {number} x
     * @param {number} y
     */
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    },
    
    /**
     * Snap camera directly to target (no smoothing)
     */
    snapToTarget() {
        this.x = this.targetX;
        this.y = this.targetY;
    },
    
    /**
     * Update camera position
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Smooth interpolation to target
        const factor = 1 - Math.exp(-this.smoothing * dt);
        this.x += (this.targetX - this.x) * factor;
        this.y += (this.targetY - this.y) * factor;
        
        // Handle zoom input
        const wheelDelta = Input.getWheelDelta();
        if (wheelDelta !== 0) {
            const zoomFactor = wheelDelta > 0 ? 0.9 : 1.1;
            this.setZoom(this.zoom * zoomFactor);
        }
    },
    
    /**
     * Set zoom level
     * @param {number} zoom
     */
    setZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    },
    
    /**
     * Convert screen coordinates to world coordinates
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToWorld(screenX, screenY) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        return {
            x: this.x + (screenX - centerX) / this.zoom,
            y: this.y + (screenY - centerY) / this.zoom
        };
    },
    
    /**
     * Convert world coordinates to screen coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{x: number, y: number}}
     */
    worldToScreen(worldX, worldY) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        return {
            x: centerX + (worldX - this.x) * this.zoom,
            y: centerY + (worldY - this.y) * this.zoom
        };
    },
    
    /**
     * Get visible world bounds
     * @returns {{left: number, right: number, top: number, bottom: number}}
     */
    getVisibleBounds() {
        const halfWidth = (this.width / 2) / this.zoom;
        const halfHeight = (this.height / 2) / this.zoom;
        return {
            left: this.x - halfWidth,
            right: this.x + halfWidth,
            top: this.y - halfHeight,
            bottom: this.y + halfHeight
        };
    },
    
    /**
     * Get visible tile bounds (for culling)
     * @param {number} tileSize
     * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
     */
    getVisibleTileBounds(tileSize) {
        const bounds = this.getVisibleBounds();
        return {
            minX: Math.floor(bounds.left / tileSize) - 1,
            maxX: Math.ceil(bounds.right / tileSize) + 1,
            minY: Math.floor(bounds.top / tileSize) - 1,
            maxY: Math.ceil(bounds.bottom / tileSize) + 1
        };
    },
    
    /**
     * Check if a world rectangle is visible
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {boolean}
     */
    isVisible(x, y, width, height) {
        const bounds = this.getVisibleBounds();
        return x + width > bounds.left &&
               x < bounds.right &&
               y + height > bounds.top &&
               y < bounds.bottom;
    }
};

