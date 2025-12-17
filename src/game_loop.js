// AIDEV-NOTE: Game Loop Manager for WorldGenerator
// Handles requestAnimationFrame loop with delta time calculation

const GameLoop = {
    // State
    running: false,
    lastFrameTime: 0,
    deltaTime: 0,
    frameCount: 0,
    fps: 0,
    fpsUpdateTime: 0,
    
    // Callbacks
    updateCallback: null,
    renderCallback: null,
    
    // Frame ID for cancellation
    animationFrameId: null,
    
    /**
     * Initialize the game loop with callbacks
     * @param {Function} updateFn - Called each frame with deltaTime
     * @param {Function} renderFn - Called each frame after update
     */
    init(updateFn, renderFn) {
        this.updateCallback = updateFn;
        this.renderCallback = renderFn;
        console.log('GameLoop initialized');
    },
    
    /**
     * Start the game loop
     */
    start() {
        if (this.running) return;
        
        this.running = true;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateTime = this.lastFrameTime;
        
        this.loop();
        console.log('GameLoop started');
    },
    
    /**
     * Stop the game loop
     */
    stop() {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log('GameLoop stopped');
    },
    
    /**
     * Main loop function
     */
    loop() {
        if (!this.running) return;
        
        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        
        // Cap delta time to prevent huge jumps
        if (this.deltaTime > 0.1) {
            this.deltaTime = 0.1;
        }
        
        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
        }
        
        // Call update
        if (this.updateCallback) {
            this.updateCallback(this.deltaTime);
        }
        
        // Call render
        if (this.renderCallback) {
            this.renderCallback(this.deltaTime);
        }
        
        // Schedule next frame
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },
    
    /**
     * Get current FPS
     * @returns {number}
     */
    getFPS() {
        return this.fps;
    },
    
    /**
     * Get current delta time
     * @returns {number}
     */
    getDeltaTime() {
        return this.deltaTime;
    }
};

