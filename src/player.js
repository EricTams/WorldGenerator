// AIDEV-NOTE: Ghost Player for WorldGenerator
// Moves freely through the world without collision for inspecting generation

const Player = {
    // Position (in pixels)
    x: 0,
    y: 0,
    
    // Movement speed (pixels per second)
    speed: 300,
    
    // Visual size
    size: 12,
    
    /**
     * Initialize player at position
     * @param {number} x
     * @param {number} y
     */
    init(x, y) {
        this.x = x;
        this.y = y;
        console.log(`Player initialized at (${x}, ${y})`);
    },
    
    /**
     * Set player position
     * @param {number} x
     * @param {number} y
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    },
    
    /**
     * Update player movement
     * @param {number} dt - Delta time in seconds
     * @param {Object} input - Input handler
     */
    update(dt, input) {
        // Get movement input
        const moveX = input.getHorizontal();
        const moveY = input.getVertical();
        
        // Apply movement (no collision - ghost mode)
        if (moveX !== 0 || moveY !== 0) {
            // Normalize diagonal movement
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            const normalX = moveX / length;
            const normalY = moveY / length;
            
            // Apply speed with shift boost
            let currentSpeed = this.speed;
            if (input.isKeyDown('shift')) {
                currentSpeed *= 2;
            }
            
            this.x += normalX * currentSpeed * dt;
            this.y += normalY * currentSpeed * dt;
        }
    },
    
    /**
     * Get tile coordinates player is on
     * @param {number} tileSize
     * @returns {{x: number, y: number}}
     */
    getTilePos(tileSize = 16) {
        return {
            x: Math.floor(this.x / tileSize),
            y: Math.floor(this.y / tileSize)
        };
    }
};

