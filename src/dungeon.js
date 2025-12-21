// AIDEV-NOTE: Dungeon Generator for WorldGenerator
// Two-level generation:
// 1. World Rules assign biomes to positions
// 2. Biome Rules assign tiles within each biome

const Dungeon = {
    TILE_SIZE: 16,
    WORLD_WIDTH: 144,   // 8x8 grid of 16-tile cells = 128, plus margin
    WORLD_HEIGHT: 144,
    
    // Noise scales
    BIOME_SCALE: 30,
    CAVE_SCALE: 20,
    DETAIL_SCALE: 8,
    
    // AIDEV-NOTE: Arch parameters for doorway generation
    ARCH_SPACING: 12,      // Horizontal distance between arch centers
    ARCH_WIDTH: 3,         // Half-width of each arch
    ARCH_HEIGHT: 5,        // Height of arch at center
    
    /**
     * Generate world using two-level rules
     */
    generate(seed) {
        console.log(`Generating world with seed ${seed}`);
        
        Noise.init(seed);
        
        const width = this.WORLD_WIDTH;
        const height = this.WORLD_HEIGHT;
        
        const tiles = new Int16Array(width * height).fill(-1);
        const bgTiles = new Int16Array(width * height).fill(-1);
        const biomeMap = new Array(width * height).fill(null);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // Build context for this position
                const context = this.buildContext(x, y, width, height);
                
                // Step 1: World Rules - find which biome
                const biome = BiomeData.findBiomeForContext(context);
                biomeMap[idx] = biome?.id || null;
                
                if (!biome) {
                    // No biome matched - leave as air with black background
                    tiles[idx] = -1;
                    bgTiles[idx] = -1;
                    continue;
                }
                
                // Step 2: Biome Rules - find which tiles (use flattened rules to handle groups)
                const allRules = BiomeData.getBiomeTileRules(biome.id);
                const fgRules = allRules.filter(r => r.layer === 'fg');
                const bgRules = allRules.filter(r => r.layer === 'bg');
                
                // Foreground tile (first match wins)
                for (const rule of fgRules) {
                    if (BiomeData.evaluateConditions(rule.conditions, context)) {
                        const tileKey = rule.tile.replace(/ /g, '_');
                        tiles[idx] = TileAtlas.Tiles[tileKey] ?? -1;
                        break;
                    }
                }
                
                // Background tile (first match wins)
                for (const rule of bgRules) {
                    if (BiomeData.evaluateConditions(rule.conditions, context)) {
                        const tileKey = rule.tile.replace(/ /g, '_');
                        bgTiles[idx] = TileAtlas.Tiles[tileKey] ?? -1;
                        break;
                    }
                }
            }
        }
        
        const spawnPoint = this.findSpawnPoint(tiles, width, height);
        
        console.log(`World created: ${width}x${height}`);
        
        return {
            width,
            height,
            tiles,
            bgTiles,
            biomeMap,
            rooms: [],
            corridors: [],
            spawnPoint
        };
    },
    
    // AIDEV-NOTE: Cave threshold for solid vs air
    CAVE_THRESHOLD: 0.55,
    
    buildContext(x, y, width, height) {
        // AIDEV-NOTE: Context values available for biome/tile rules
        // Basic noise: biome_noise, cave_noise, detail_noise
        // Neighbor awareness: above_is_air, below_is_air, left_is_air, right_is_air
        // Architectural: arch_value (1 inside arch opening, 0 outside)
        // Position: depth (0=top, 1=bottom), x_pos (0=left, 1=right)
        // Tile coords: y_tile, x_tile (raw coordinates)
        // random: high-frequency noise for variety
        // NOTE: Use scale modifiers on cave_noise for stretched patterns (replaces platform_* and vertical_*)
        
        const caveThreshold = this.CAVE_THRESHOLD;
        
        return {
            // Basic noise
            biome_noise: Noise.get(x, y, this.BIOME_SCALE),
            cave_noise: Noise.getFBM(x, y, this.CAVE_SCALE, 3),
            detail_noise: Noise.get(x, y, this.DETAIL_SCALE),
            
            // AIDEV-NOTE: Neighbor awareness - check if adjacent tiles would be air
            // Based on cave_noise at neighbor positions (no two-pass needed)
            // Returns 1 if neighbor is air, 0 if solid
            // Use for surface detection: e.g., Dirt_Grass when solid AND above_is_air == 1
            above_is_air: (y > 0 && Noise.getFBM(x, y - 1, this.CAVE_SCALE, 3) >= caveThreshold) ? 1 : 0,
            below_is_air: (y < height - 1 && Noise.getFBM(x, y + 1, this.CAVE_SCALE, 3) >= caveThreshold) ? 1 : 0,
            left_is_air: (x > 0 && Noise.getFBM(x - 1, y, this.CAVE_SCALE, 3) >= caveThreshold) ? 1 : 0,
            right_is_air: (x < width - 1 && Noise.getFBM(x + 1, y, this.CAVE_SCALE, 3) >= caveThreshold) ? 1 : 0,
            
            // AIDEV-NOTE: Arch value - 1 if inside an arch opening, 0 otherwise
            // Use to carve doorway shapes: solid terrain AND arch_value == 1 -> air
            arch_value: Noise.getArch(x, y, this.ARCH_SPACING, this.ARCH_WIDTH, this.ARCH_HEIGHT),
            
            // Position-based (normalized 0-1)
            depth: y / height,
            x_pos: x / width,
            
            // Raw tile coordinates (use with modifiers like % 4)
            y_tile: y,
            x_tile: x,
            
            // High-frequency random for variety
            random: Noise.get(x * 100, y * 100, 1)
        };
    },
    
    findSpawnPoint(tiles, width, height) {
        for (let y = 10; y < 40; y++) {
            for (let x = width / 2 - 10; x < width / 2 + 10; x++) {
                const idx = y * width + Math.floor(x);
                if (tiles[idx] === -1) {
                    return {
                        x: Math.floor(x) * this.TILE_SIZE + 8,
                        y: y * this.TILE_SIZE + 8
                    };
                }
            }
        }
        return { x: width * 8, y: 200 };
    }
};
