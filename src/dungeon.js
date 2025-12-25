// AIDEV-NOTE: Dungeon Generator for WorldGenerator
// Supports two generation modes:
// 1. Noise mode: Uses Perlin noise + biome rules (original)
// 2. Graph mode: Uses uploaded room templates connected by corridors

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
    
    // AIDEV-NOTE: Generation mode - 'noise' (original) or 'hub' (hub and spokes)
    generationMode: 'hub',
    
    /**
     * Generate world using configured mode
     */
    generate(seed) {
        // Try hub-and-spokes generation if in hub mode and templates exist
        if (this.generationMode === 'hub') {
            const templates = RoomTemplates.getAllTemplates();
            if (templates.length > 0) {
                const result = this.generateHubAndSpokes(seed, templates);
                if (result) {
                    console.log('Generated using Hub & Spokes mode');
                    return result;
                }
            }
            console.warn('No room templates available, falling back to noise mode');
        }
        
        return this.generateNoise(seed);
    },
    
    /**
     * Hub and Spokes generation: place rooms and connect them with tunnels
     * @param {number} seed
     * @param {Array} templates
     * @returns {Object} World data
     */
    generateHubAndSpokes(seed, templates) {
        console.log(`Generating Hub & Spokes with seed ${seed}, ${templates.length} templates available`);
        
        Noise.init(seed);
        const random = this.seededRandom(seed);
        
        // Configuration
        const NUM_ROOMS = Math.min(5 + Math.floor(random() * 4), templates.length); // 5-8 rooms
        const SPACING = 40; // Minimum spacing between room centers
        const WORLD_MARGIN = 20;
        // AIDEV-NOTE: Tunnel width from BiomeData corridor config
        const TUNNEL_WIDTH = BiomeData.getCorridorConfig().width;
        
        // Place rooms
        const placedRooms = [];
        const usedTemplates = new Set();
        
        // Place first room near center
        const firstTemplate = templates[Math.floor(random() * templates.length)];
        usedTemplates.add(firstTemplate.id);
        placedRooms.push({
            template: firstTemplate,
            x: 60,
            y: 60
        });
        
        // Place remaining rooms with spacing
        let attempts = 0;
        while (placedRooms.length < NUM_ROOMS && attempts < 100) {
            attempts++;
            
            // Pick a template (prefer unused ones)
            let template;
            const unusedTemplates = templates.filter(t => !usedTemplates.has(t.id));
            if (unusedTemplates.length > 0 && random() > 0.3) {
                template = unusedTemplates[Math.floor(random() * unusedTemplates.length)];
            } else {
                template = templates[Math.floor(random() * templates.length)];
            }
            
            // Try to place it with spacing from existing rooms
            const angle = random() * Math.PI * 2;
            const distance = SPACING + random() * SPACING;
            const baseRoom = placedRooms[Math.floor(random() * placedRooms.length)];
            
            const x = Math.round(baseRoom.x + Math.cos(angle) * distance);
            const y = Math.round(baseRoom.y + Math.sin(angle) * distance);
            
            // Check spacing from all rooms
            let valid = true;
            for (const room of placedRooms) {
                const dx = x - room.x;
                const dy = y - room.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < SPACING * 0.7) {
                    valid = false;
                    break;
                }
            }
            
            if (valid && x > WORLD_MARGIN && y > WORLD_MARGIN) {
                placedRooms.push({ template, x, y });
                usedTemplates.add(template.id);
            }
        }
        
        console.log(`Placed ${placedRooms.length} rooms`);
        
        // Calculate world bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const room of placedRooms) {
            minX = Math.min(minX, room.x);
            minY = Math.min(minY, room.y);
            maxX = Math.max(maxX, room.x + room.template.width);
            maxY = Math.max(maxY, room.y + room.template.height);
        }
        
        // Add margin
        minX -= WORLD_MARGIN;
        minY -= WORLD_MARGIN;
        maxX += WORLD_MARGIN;
        maxY += WORLD_MARGIN;
        
        const width = maxX - minX;
        const height = maxY - minY;
        const offsetX = -minX;
        const offsetY = -minY;
        
        // Create tile arrays and fill with wall tiles using corridor rules
        // AIDEV-NOTE: Uses corridor rules for variation instead of solid Brick everywhere
        const tiles = new Int16Array(width * height);
        const bgTiles = new Int16Array(width * height).fill(-1);
        
        // AIDEV-NOTE: Cave carving masks - track room tiles for distance field and protection
        // roomAirMask: tiles that came from Air_Blocker (interior of structures, distance 0)
        // solidBlockerMask: tiles that came from Solid_Blocker (blocks cave carving propagation)
        // roomTileMask: ALL tiles from room templates (protected from cave carving)
        const roomAirMask = new Uint8Array(width * height);
        const solidBlockerMask = new Uint8Array(width * height);
        const roomTileMask = new Uint8Array(width * height);
        
        // Fill with wall tiles using corridor rules for variation
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const context = this.buildCorridorContext(x, y, 0.5); // Use 0.5 as neutral corridor_t
                const wallTile = BiomeData.selectCorridorTile('wall', context);
                tiles[idx] = wallTile !== -1 ? wallTile : (TileAtlas.Tiles.Brick ?? 0);
            }
        }
        
        // Place room tiles (also populates cave carving masks)
        for (const room of placedRooms) {
            this.placeRoomTiles(tiles, bgTiles, width, room, offsetX, offsetY, roomAirMask, solidBlockerMask, roomTileMask);
        }
        
        // Connect rooms with tunnels (connect each room to its nearest neighbor)
        const connected = new Set([0]); // Start with first room connected
        const unconnected = new Set(placedRooms.map((_, i) => i).slice(1));
        
        while (unconnected.size > 0) {
            // Find closest unconnected room to any connected room
            let bestDist = Infinity;
            let bestFrom = -1;
            let bestTo = -1;
            
            for (const fromIdx of connected) {
                for (const toIdx of unconnected) {
                    const from = placedRooms[fromIdx];
                    const to = placedRooms[toIdx];
                    const dx = (to.x + to.template.width/2) - (from.x + from.template.width/2);
                    const dy = (to.y + to.template.height/2) - (from.y + from.template.height/2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestFrom = fromIdx;
                        bestTo = toIdx;
                    }
                }
            }
            
            if (bestTo >= 0) {
                // Carve tunnel between these rooms
                const from = placedRooms[bestFrom];
                const to = placedRooms[bestTo];
                this.carveTunnel(tiles, bgTiles, width, height,
                    from, to, offsetX, offsetY, TUNNEL_WIDTH);
                
                connected.add(bestTo);
                unconnected.delete(bestTo);
            } else {
                break;
            }
        }
        
        // AIDEV-NOTE: Cave carving pass - creates organic cave ceilings around structures
        // Uses distance-from-room-air combined with high-frequency noise
        this.applyCaveCarving(tiles, bgTiles, width, height, roomAirMask, solidBlockerMask, roomTileMask);
        
        // Find spawn point (center of first room)
        const spawnRoom = placedRooms[0];
        const spawnX = (spawnRoom.x + offsetX + spawnRoom.template.width / 2) * this.TILE_SIZE;
        const spawnY = (spawnRoom.y + offsetY + spawnRoom.template.height / 2) * this.TILE_SIZE;
        
        return {
            width,
            height,
            tiles,
            bgTiles,
            biomeMap: new Array(width * height).fill('hub'),
            rooms: placedRooms.map((r, i) => ({
                id: i,
                x: r.x + offsetX,
                y: r.y + offsetY,
                width: r.template.width,
                height: r.template.height,
                templateId: r.template.id
            })),
            corridors: [],
            spawnPoint: { x: spawnX, y: spawnY }
        };
    },
    
    /**
     * Place room tiles into the world
     * AIDEV-NOTE: Converts blocker tiles using corridor rules for style consistency
     * - Air Blocker → air (-1) + background from corridor bg rules + marks roomAirMask
     * - Solid Blocker → wall tile from corridor wall rules + marks solidBlockerMask
     * - All other tiles → marks roomTileMask (protected from cave carving)
     * @param {Int16Array} tiles - Foreground tile array
     * @param {Int16Array} bgTiles - Background tile array
     * @param {number} worldWidth - Width of world in tiles
     * @param {Object} room - Room placement data {template, x, y}
     * @param {number} offsetX - World offset X
     * @param {number} offsetY - World offset Y
     * @param {Uint8Array} [roomAirMask] - Optional mask for cave carving (1 = room air)
     * @param {Uint8Array} [solidBlockerMask] - Optional mask for cave carving (1 = solid blocker)
     * @param {Uint8Array} [roomTileMask] - Optional mask for ALL room tiles (protected from carving)
     */
    placeRoomTiles(tiles, bgTiles, worldWidth, room, offsetX, offsetY, roomAirMask, solidBlockerMask, roomTileMask) {
        const template = room.template;
        const baseX = room.x + offsetX;
        const baseY = room.y + offsetY;
        
        // AIDEV-NOTE: Blocker tile indices for conversion
        const AIR_BLOCKER = TileAtlas.Tiles.Air_Blocker;
        const SOLID_BLOCKER = TileAtlas.Tiles.Solid_Blocker;
        
        for (let y = 0; y < template.height; y++) {
            for (let x = 0; x < template.width; x++) {
                const worldX = baseX + x;
                const worldY = baseY + y;
                const worldIdx = worldY * worldWidth + worldX;
                const templateIdx = y * template.width + x;
                
                if (worldIdx >= 0 && worldIdx < tiles.length) {
                    let tile = template.tiles[templateIdx];
                    
                    // Convert blocker tiles using corridor rules for style consistency
                    if (tile === AIR_BLOCKER) {
                        // Air Blocker → air with rule-selected background
                        tile = -1;
                        const context = this.buildCorridorContext(worldX, worldY, 0.5);
                        const bgTile = BiomeData.selectCorridorTile('bg', context);
                        bgTiles[worldIdx] = bgTile !== -1 ? bgTile : (TileAtlas.Tiles.Black ?? 17);
                        // AIDEV-NOTE: Mark as room air for cave carving distance field
                        if (roomAirMask) roomAirMask[worldIdx] = 1;
                    } else if (tile === SOLID_BLOCKER) {
                        // Solid Blocker → wall tile from corridor rules
                        const context = this.buildCorridorContext(worldX, worldY, 0.5);
                        tile = BiomeData.selectCorridorTile('wall', context);
                        if (tile === -1) tile = TileAtlas.Tiles.Brick ?? 0;
                        // AIDEV-NOTE: Mark as solid blocker to prevent cave carving propagation
                        if (solidBlockerMask) solidBlockerMask[worldIdx] = 1;
                    } else {
                        // AIDEV-NOTE: All other room tiles are protected from cave carving
                        // This includes platforms, ladders, decorations, actual brick walls, etc.
                        if (roomTileMask) roomTileMask[worldIdx] = 1;
                    }
                    
                    tiles[worldIdx] = tile;
                    
                    // Set background for passable tiles (non-blocker air)
                    if (tile === -1 && template.tiles[templateIdx] !== AIR_BLOCKER) {
                        const data = TileAtlas.TileData[tile];
                        if (!data || data.category === 'BG' || data.category === 'FAR_BG') {
                            bgTiles[worldIdx] = TileAtlas.Tiles.Far_BG_Brick ?? TileAtlas.Tiles.Black ?? 17;
                        }
                    }
                }
            }
        }
    },
    
    // AIDEV-NOTE: Cave carving noise scale (fixed, not user-adjustable)
    // Smaller = more detail in cave boundary
    CAVE_CARVE_NOISE_SCALE: 0.15,
    
    /**
     * Apply cave carving to create organic cave ceilings around structures
     * AIDEV-NOTE: Two-pass algorithm:
     * 1. BFS from room air tiles to compute distance field (blocked by solid blockers)
     * 2. Carve solid tiles where distance + noise < threshold (skip ALL room tiles)
     * 
     * Config from BiomeData.corridorConfig:
     * - caveDistance: max distance from room air to carve (0 = disabled)
     * - caveRoughness: how much noise affects boundary (0-10)
     * 
     * @param {Int16Array} tiles - Foreground tile array
     * @param {Int16Array} bgTiles - Background tile array  
     * @param {number} width - World width in tiles
     * @param {number} height - World height in tiles
     * @param {Uint8Array} roomAirMask - 1 where Air_Blocker tiles were placed
     * @param {Uint8Array} solidBlockerMask - 1 where Solid_Blocker tiles were placed
     * @param {Uint8Array} roomTileMask - 1 where ANY room tile was placed (protected)
     */
    applyCaveCarving(tiles, bgTiles, width, height, roomAirMask, solidBlockerMask, roomTileMask) {
        // Get cave carving config from BiomeData
        const config = BiomeData.getCorridorConfig();
        const MAX_DIST = config.caveDistance ?? 12;
        const NOISE_SCALE = this.CAVE_CARVE_NOISE_SCALE;
        const NOISE_AMP = config.caveRoughness ?? 4;
        
        // Skip if cave carving is disabled (distance = 0)
        if (MAX_DIST <= 0) {
            console.log('Cave carving: disabled (distance = 0)');
            return;
        }
        
        // AIDEV-NOTE: Pass 1 - Compute distance field using BFS from room air
        // Distance is infinity (MAX_DIST+1) for tiles blocked by solid blockers
        const distanceField = new Float32Array(width * height).fill(MAX_DIST + 1);
        const queue = [];
        
        // Seed BFS with all room air tiles (distance 0)
        for (let i = 0; i < roomAirMask.length; i++) {
            if (roomAirMask[i] === 1) {
                distanceField[i] = 0;
                queue.push(i);
            }
        }
        
        // BFS to propagate distance
        const neighbors = [-1, 1, -width, width]; // left, right, up, down
        let queueIdx = 0;
        
        while (queueIdx < queue.length) {
            const idx = queue[queueIdx++];
            const currentDist = distanceField[idx];
            
            // Don't propagate beyond max distance
            if (currentDist >= MAX_DIST) continue;
            
            const x = idx % width;
            const y = Math.floor(idx / width);
            
            for (let d = 0; d < 4; d++) {
                const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0);
                const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
                
                // Bounds check
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                
                const nidx = ny * width + nx;
                
                // AIDEV-NOTE: Solid blockers completely block distance propagation
                // This prevents cave carving from eating into structural floors/walls
                if (solidBlockerMask[nidx] === 1) continue;
                
                // Update distance if we found a shorter path
                const newDist = currentDist + 1;
                if (newDist < distanceField[nidx]) {
                    distanceField[nidx] = newDist;
                    queue.push(nidx);
                }
            }
        }
        
        // AIDEV-NOTE: Pass 2 - Carve tiles based on distance + noise
        // Formula: carve if (distance + noise * amplitude) < threshold
        // This creates organic, noisy cave boundaries
        // IMPORTANT: Never carve room tiles - only carve world fill tiles
        let carvedCount = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // Skip if already air
                if (tiles[idx] === -1) continue;
                // Skip ALL room tiles (solid blockers AND regular room tiles like platforms, ladders, etc.)
                if (solidBlockerMask[idx] === 1) continue;
                if (roomTileMask[idx] === 1) continue;
                
                const dist = distanceField[idx];
                
                // Skip tiles too far from room air
                if (dist > MAX_DIST) continue;
                
                // High-frequency noise for organic edges
                const noise = Noise.perlin2D(x * NOISE_SCALE, y * NOISE_SCALE);
                
                // Carve if distance + noise offset is below threshold
                // noise ranges from -1 to 1, so effective threshold varies by ±NOISE_AMP
                const effectiveDistance = dist + noise * NOISE_AMP;
                
                if (effectiveDistance < MAX_DIST) {
                    // Carve this tile to air
                    tiles[idx] = -1;
                    
                    // Set background using corridor rules
                    const context = this.buildCorridorContext(x, y, 0.5);
                    const bgTile = BiomeData.selectCorridorTile('bg', context);
                    bgTiles[idx] = bgTile !== -1 ? bgTile : (TileAtlas.Tiles.Black ?? 17);
                    
                    carvedCount++;
                }
            }
        }
        
        console.log(`Cave carving: carved ${carvedCount} tiles`);
    },
    
    /**
     * Carve a tunnel between two rooms using noise-skewed paths
     * AIDEV-NOTE: Uses Perlin noise to create organic, wandering corridors
     */
    carveTunnel(tiles, bgTiles, worldWidth, worldHeight, fromRoom, toRoom, offsetX, offsetY, tunnelWidth) {
        // Calculate room centers
        const fromCenterX = fromRoom.x + offsetX + fromRoom.template.width / 2;
        const fromCenterY = fromRoom.y + offsetY + fromRoom.template.height / 2;
        const toCenterX = toRoom.x + offsetX + toRoom.template.width / 2;
        const toCenterY = toRoom.y + offsetY + toRoom.template.height / 2;
        
        // Determine direction to target
        const dx = toCenterX - fromCenterX;
        const dy = toCenterY - fromCenterY;
        
        // Find edge points based on direction
        let x1, y1, x2, y2;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            // Mostly horizontal
            x1 = dx > 0 ? fromRoom.x + offsetX + fromRoom.template.width : fromRoom.x + offsetX;
            y1 = fromCenterY;
            x2 = dx > 0 ? toRoom.x + offsetX : toRoom.x + offsetX + toRoom.template.width;
            y2 = toCenterY;
        } else {
            // Mostly vertical
            x1 = fromCenterX;
            y1 = dy > 0 ? fromRoom.y + offsetY + fromRoom.template.height : fromRoom.y + offsetY;
            x2 = toCenterX;
            y2 = dy > 0 ? toRoom.y + offsetY : toRoom.y + offsetY + toRoom.template.height;
        }
        
        const halfWidth = Math.floor(tunnelWidth / 2);
        
        // Carve noise-skewed path from (x1,y1) to (x2,y2)
        this.carveNoisyPath(tiles, bgTiles, worldWidth, worldHeight, 
            Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), 
            halfWidth);
    },
    
    /**
     * Carve a path using noise to create organic wandering
     * AIDEV-NOTE: Walks from start to end, using noise to offset perpendicular to direction
     * Uses BiomeData.corridorConfig for shape parameters and corridorTileRules for tile selection
     */
    carveNoisyPath(tiles, bgTiles, worldWidth, worldHeight, x1, y1, x2, y2, halfWidth) {
        // AIDEV-NOTE: Read corridor shape parameters from BiomeData
        const config = BiomeData.getCorridorConfig();
        const NOISE_SCALE = 0.08;                       // How quickly noise changes
        const NOISE_AMPLITUDE = config.noiseAmplitude;  // Max offset in tiles (waviness)
        const WIDTH_VARIATION = config.widthVariation;  // How much width varies (0 = constant)
        const STEP_SIZE = 1;                            // How often we sample
        
        const totalDx = x2 - x1;
        const totalDy = y2 - y1;
        const distance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
        
        if (distance < 1) return;
        
        // Unit vector along the path
        const dirX = totalDx / distance;
        const dirY = totalDy / distance;
        
        // Perpendicular vector for noise offset
        const perpX = -dirY;
        const perpY = dirX;
        
        // Carve air path with varying width
        const steps = Math.ceil(distance / STEP_SIZE);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;  // corridor_t: 0-1 position along corridor
            const baseX = x1 + totalDx * t;
            const baseY = y1 + totalDy * t;
            
            // Waviness: offset perpendicular to path direction
            const noiseVal = Noise.perlin2D(baseX * NOISE_SCALE, baseY * NOISE_SCALE);
            const taper = Math.sin(t * Math.PI);  // Taper at ends
            const offset = noiseVal * NOISE_AMPLITUDE * taper;
            const finalX = Math.round(baseX + perpX * offset);
            const finalY = Math.round(baseY + perpY * offset);
            
            // Width variation: use different noise frequency to vary radius
            const widthNoise = Noise.perlin2D(baseX * 0.15, baseY * 0.15);  // Different freq
            const radiusVariation = Math.round(widthNoise * WIDTH_VARIATION);
            const currentRadius = Math.max(1, halfWidth + 1 + radiusVariation);
            
            // Carve passable air circle with varying radius
            this.carveAirCircle(tiles, bgTiles, worldWidth, worldHeight, finalX, finalY, currentRadius, t);
        }
    },
    
    /**
     * Carve a ring of wall tiles (for corridor borders)
     * AIDEV-NOTE: Uses BiomeData corridor tile rules to select wall tiles
     * @param {number} corridorT - Position along corridor (0-1) for context
     */
    carveWallRing(tiles, bgTiles, worldWidth, worldHeight, cx, cy, innerRadius, outerRadius, corridorT) {
        for (let dy = -outerRadius; dy <= outerRadius; dy++) {
            for (let dx = -outerRadius; dx <= outerRadius; dx++) {
                const distSq = dx * dx + dy * dy;
                // Only fill the ring (between inner and outer radius)
                if (distSq > innerRadius * innerRadius && distSq <= outerRadius * outerRadius) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
                        const idx = y * worldWidth + x;
                        if (idx >= 0 && idx < tiles.length) {
                            // Don't overwrite existing non-air tiles (room tiles)
                            if (tiles[idx] === -1 || tiles[idx] === undefined) {
                                // Build corridor context for tile selection
                                const context = this.buildCorridorContext(x, y, corridorT);
                                // Select wall tile using BiomeData corridor rules
                                const wallTile = BiomeData.selectCorridorTile('wall', context);
                                if (wallTile !== -1) {
                                    tiles[idx] = wallTile;
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    
    /**
     * Carve a circular area of air tiles with rule-selected backgrounds
     * AIDEV-NOTE: Uses BiomeData corridor tile rules to select background tiles
     * @param {number} corridorT - Position along corridor (0-1) for context
     */
    carveAirCircle(tiles, bgTiles, worldWidth, worldHeight, cx, cy, radius, corridorT) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distSq = dx * dx + dy * dy;
                if (distSq <= radius * radius) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
                        const idx = y * worldWidth + x;
                        if (idx >= 0 && idx < tiles.length) {
                            tiles[idx] = -1; // Air (passable)
                            // Build corridor context for background tile selection
                            const context = this.buildCorridorContext(x, y, corridorT);
                            // Select background tile using BiomeData corridor rules
                            const bgTile = BiomeData.selectCorridorTile('bg', context);
                            bgTiles[idx] = bgTile !== -1 ? bgTile : (TileAtlas.Tiles.Black ?? 17);
                        }
                    }
                }
            }
        }
    },
    
    /**
     * Select a tile using BiomeData rules (shared by both generation modes)
     * AIDEV-NOTE: Reuses the same Scratch-style rule system as noise mode
     */
    selectTileFromRules(x, y, worldWidth, worldHeight, tiles, layer) {
        // Build context for this position
        const context = this.buildContext(x, y, worldWidth, worldHeight);
        
        // Find which biome applies
        const biome = BiomeData.findBiomeForContext(context);
        if (!biome) {
            // No biome matched - return default
            return layer === 'fg' ? (TileAtlas.Tiles.Brick ?? 0) : (TileAtlas.Tiles.Far_BG_Brick ?? 17);
        }
        
        // Get tile rules for this biome
        const allRules = BiomeData.getBiomeTileRules(biome.id);
        const rules = allRules.filter(r => r.layer === layer);
        
        // First matching rule wins
        for (const rule of rules) {
            if (BiomeData.evaluateConditions(rule.conditions, context)) {
                const tileKey = rule.tile.replace(/ /g, '_');
                return TileAtlas.Tiles[tileKey] ?? -1;
            }
        }
        
        // No rule matched - return default
        return layer === 'fg' ? (TileAtlas.Tiles.Brick ?? 0) : (TileAtlas.Tiles.Far_BG_Brick ?? 17);
    },
    
    /**
     * Carve a circular area of air tiles (legacy, simple version)
     */
    carveCircle(tiles, bgTiles, worldWidth, worldHeight, cx, cy, radius, bgTile) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
                        const idx = y * worldWidth + x;
                        if (idx >= 0 && idx < tiles.length) {
                            tiles[idx] = -1; // Air
                            bgTiles[idx] = bgTile;
                        }
                    }
                }
            }
        }
    },
    
    /**
     * Carve a horizontal line of air tiles
     */
    carveLineH(tiles, bgTiles, worldWidth, worldHeight, x1, x2, y, halfWidth, bgTile) {
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        
        for (let x = startX; x <= endX; x++) {
            for (let dy = -halfWidth; dy <= halfWidth; dy++) {
                const ty = y + dy;
                if (ty >= 0 && ty < worldHeight && x >= 0 && x < worldWidth) {
                    const idx = ty * worldWidth + Math.round(x);
                    if (idx >= 0 && idx < tiles.length) {
                        tiles[idx] = -1; // Air
                        bgTiles[idx] = bgTile;
                    }
                }
            }
        }
    },
    
    /**
     * Carve a vertical line of air tiles
     */
    carveLineV(tiles, bgTiles, worldWidth, worldHeight, x, y1, y2, halfWidth, bgTile) {
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        
        for (let y = startY; y <= endY; y++) {
            for (let dx = -halfWidth; dx <= halfWidth; dx++) {
                const tx = x + dx;
                if (tx >= 0 && tx < worldWidth && y >= 0 && y < worldHeight) {
                    const idx = y * worldWidth + Math.round(tx);
                    if (idx >= 0 && idx < tiles.length) {
                        tiles[idx] = -1; // Air
                        bgTiles[idx] = bgTile;
                    }
                }
            }
        }
    },
    
    /**
     * Seeded random number generator
     */
    seededRandom(seed) {
        let state = seed;
        return () => {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        };
    },
    
    /**
     * Generate world using noise-based rules (original method)
     */
    generateNoise(seed) {
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
    
    /**
     * Build context for corridor tile selection
     * AIDEV-NOTE: Corridor-specific context includes corridor_t (0-1 position along path)
     * @param {number} x - X tile coordinate
     * @param {number} y - Y tile coordinate
     * @param {number} corridorT - Position along corridor (0 at start, 1 at end)
     */
    buildCorridorContext(x, y, corridorT) {
        return {
            // Corridor-specific: position along the path (0 = room entrance, 1 = room exit)
            corridor_t: corridorT,
            
            // Tile coordinates for pattern matching (e.g., x_tile % 5 == 2)
            x_tile: x,
            y_tile: y,
            
            // Noise values for variety
            detail_noise: Noise.get(x, y, this.DETAIL_SCALE),
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
