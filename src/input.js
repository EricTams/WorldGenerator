// AIDEV-NOTE: Input handler for WorldGenerator
// Handles keyboard and mouse input for player movement and camera control

const Input = {
    // Key states
    keys: {},
    keysPressed: {},
    keysReleased: {},
    
    // Mouse state
    mouse: {
        x: 0,
        y: 0,
        worldX: 0,
        worldY: 0,
        buttons: [false, false, false],
        wheel: 0
    },
    
    // Canvas reference
    canvas: null,
    
    /**
     * Initialize input system
     * @param {HTMLCanvasElement} canvas
     */
    init(canvas) {
        this.canvas = canvas;
        
        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse events
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('Input initialized');
    },
    
    /**
     * Update input state (call at end of frame)
     */
    update() {
        // Clear one-frame states
        this.keysPressed = {};
        this.keysReleased = {};
        this.mouse.wheel = 0;
    },
    
    /**
     * Handle key down
     * @param {KeyboardEvent} e
     */
    onKeyDown(e) {
        // Don't capture input if typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const key = e.key.toLowerCase();
        if (!this.keys[key]) {
            this.keysPressed[key] = true;
        }
        this.keys[key] = true;
        
        // Prevent default for game keys
        // WASD = pan, IJKL = jump by cell, -/= = zoom
        if (['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', '-', '=', '+'].includes(key)) {
            e.preventDefault();
        }
    },
    
    /**
     * Handle key up
     * @param {KeyboardEvent} e
     */
    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys[key]) {
            this.keysReleased[key] = true;
        }
        this.keys[key] = false;
    },
    
    /**
     * Handle mouse move
     * @param {MouseEvent} e
     */
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
    },
    
    /**
     * Handle mouse down
     * @param {MouseEvent} e
     */
    onMouseDown(e) {
        this.mouse.buttons[e.button] = true;
    },
    
    /**
     * Handle mouse up
     * @param {MouseEvent} e
     */
    onMouseUp(e) {
        this.mouse.buttons[e.button] = false;
    },
    
    /**
     * Handle mouse wheel
     * @param {WheelEvent} e
     */
    onWheel(e) {
        this.mouse.wheel = e.deltaY;
        e.preventDefault();
    },
    
    /**
     * Check if a key is currently held
     * @param {string} key
     * @returns {boolean}
     */
    isKeyDown(key) {
        return this.keys[key.toLowerCase()] === true;
    },
    
    /**
     * Check if a key was just pressed this frame
     * @param {string} key
     * @returns {boolean}
     */
    isKeyPressed(key) {
        return this.keysPressed[key.toLowerCase()] === true;
    },
    
    /**
     * Check if a key was just released this frame
     * @param {string} key
     * @returns {boolean}
     */
    isKeyReleased(key) {
        return this.keysReleased[key.toLowerCase()] === true;
    },
    
    /**
     * Check if a mouse button is held
     * @param {number} button - 0=left, 1=middle, 2=right
     * @returns {boolean}
     */
    isMouseDown(button = 0) {
        return this.mouse.buttons[button] === true;
    },
    
    /**
     * Get mouse wheel delta
     * @returns {number}
     */
    getWheelDelta() {
        return this.mouse.wheel;
    },
    
    /**
     * Get horizontal movement input (-1, 0, or 1)
     * @returns {number}
     */
    getHorizontal() {
        let h = 0;
        if (this.isKeyDown('a') || this.isKeyDown('arrowleft')) h -= 1;
        if (this.isKeyDown('d') || this.isKeyDown('arrowright')) h += 1;
        return h;
    },
    
    /**
     * Get vertical movement input (-1, 0, or 1)
     * @returns {number}
     */
    getVertical() {
        let v = 0;
        if (this.isKeyDown('w') || this.isKeyDown('arrowup')) v -= 1;
        if (this.isKeyDown('s') || this.isKeyDown('arrowdown')) v += 1;
        return v;
    },
    
    /**
     * Update world coordinates based on camera
     * @param {Object} camera
     */
    updateWorldCoords(camera) {
        if (camera) {
            const worldPos = camera.screenToWorld(this.mouse.x, this.mouse.y);
            this.mouse.worldX = worldPos.x;
            this.mouse.worldY = worldPos.y;
        }
    }
};

