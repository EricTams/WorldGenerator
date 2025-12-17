// AIDEV-NOTE: World data structure for WorldGenerator
// Holds tile data, rooms, and provides query methods

const World = {
    // Dimensions
    width: 0,
    height: 0,
    
    // Tile arrays
    tiles: null,      // Foreground tiles (Int16Array, -1 = air)
    bgTiles: null,    // Background tiles (Int16Array, -1 = none)
    biomeMap: null,   // Biome at each position (for visualization)
    
    // Room data
    rooms: [],
    corridors: [],
    
    // Spawn point
    spawnPoint: null,
    
    // Tile size in pixels
    TILE_SIZE: 16,
    
    /**
     * Create world from dungeon generation data
     * @param {Object} dungeonData
     */
    create(dungeonData) {
        this.width = dungeonData.width;
        this.height = dungeonData.height;
        this.tiles = dungeonData.tiles;
        this.bgTiles = dungeonData.bgTiles;
        this.biomeMap = dungeonData.biomeMap || null;
        this.rooms = dungeonData.rooms;
        this.corridors = dungeonData.corridors;
        this.spawnPoint = dungeonData.spawnPoint;
        
        console.log(`World created: ${this.width}x${this.height}`);
    },
    
    /**
     * Get biome at tile coordinates
     * @param {number} tileX
     * @param {number} tileY
     * @returns {Object|null}
     */
    getBiomeAt(tileX, tileY) {
        if (!this.biomeMap) return null;
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
            return null;
        }
        return this.biomeMap[tileY * this.width + tileX];
    },
    
    /**
     * Get tile at tile coordinates
     * @param {number} tileX
     * @param {number} tileY
     * @returns {number} Tile index or -1 if out of bounds
     */
    getTile(tileX, tileY) {
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
            return -1;
        }
        return this.tiles[tileY * this.width + tileX];
    },
    
    /**
     * Get background tile at tile coordinates
     * @param {number} tileX
     * @param {number} tileY
     * @returns {number}
     */
    getBgTile(tileX, tileY) {
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
            return -1;
        }
        return this.bgTiles[tileY * this.width + tileX];
    },
    
    /**
     * Set tile at tile coordinates
     * @param {number} tileX
     * @param {number} tileY
     * @param {number} tileIndex
     */
    setTile(tileX, tileY, tileIndex) {
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
            return;
        }
        this.tiles[tileY * this.width + tileX] = tileIndex;
    },
    
    /**
     * Get tile at world (pixel) coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @returns {number}
     */
    getTileAtWorld(worldX, worldY) {
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);
        return this.getTile(tileX, tileY);
    },
    
    /**
     * Get room at world coordinates
     * @param {number} worldX
     * @param {number} worldY
     * @returns {Object|null}
     */
    getRoomAt(worldX, worldY) {
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);
        
        for (const room of this.rooms) {
            if (tileX >= room.x && tileX < room.x + room.width &&
                tileY >= room.y && tileY < room.y + room.height) {
                return room;
            }
        }
        return null;
    },
    
    /**
     * Get room by ID
     * @param {number} id
     * @returns {Object|null}
     */
    getRoom(id) {
        return this.rooms.find(r => r.id === id) || null;
    },
    
    /**
     * Check if a tile position is solid
     * @param {number} tileX
     * @param {number} tileY
     * @returns {boolean}
     */
    isSolid(tileX, tileY) {
        const tile = this.getTile(tileX, tileY);
        if (tile < 0) return false;
        
        // Check if it's a solid tile type
        const data = TileAtlas.TileData[tile];
        if (!data) return false;
        
        // Consider terrain and dungeon tiles as solid
        return data.category === 'TERRAIN' || data.category === 'DUNGEON';
    },
    
    /**
     * Get world bounds in pixels
     * @returns {Object}
     */
    getBounds() {
        return {
            left: 0,
            top: 0,
            right: this.width * this.TILE_SIZE,
            bottom: this.height * this.TILE_SIZE
        };
    },
    
    /**
     * Get all tiles in a rectangular area
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @returns {Array}
     */
    getTilesInRect(minX, minY, maxX, maxY) {
        const result = [];
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const tile = this.getTile(x, y);
                if (tile >= 0) {
                    result.push({ x, y, tile });
                }
            }
        }
        return result;
    }
};

