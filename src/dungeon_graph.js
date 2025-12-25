// AIDEV-NOTE: Graph-Based Dungeon Generation System
// Creates a connected graph of room templates with corridors between them

const DungeonGraph = {
    // Graph data
    nodes: [],      // Placed room instances: { id, templateId, x, y, template, connections }
    edges: [],      // Connections: { from: nodeId, to: nodeId, fromOpening, toOpening }
    
    // Generation parameters
    MAX_ROOMS: 20,
    MIN_ROOMS: 5,
    CORRIDOR_WIDTH: 3,
    MAX_CORRIDOR_LENGTH: 30,
    LOOP_PROBABILITY: 0.3,  // Chance to create loops in the graph
    
    // Noise parameters for path variation
    PATH_NOISE_SCALE: 10,
    PATH_NOISE_AMPLITUDE: 2,
    
    /**
     * Generate a dungeon graph from room templates
     * @param {number} seed - Random seed
     * @param {Array} templates - Available room templates
     * @returns {Object} Generated world data
     */
    generate(seed, templates) {
        console.log(`Generating dungeon graph with seed ${seed}`);
        
        // Initialize
        Noise.init(seed);
        this.nodes = [];
        this.edges = [];
        
        if (!templates || templates.length === 0) {
            console.warn('No room templates available, falling back to noise generation');
            return null;
        }
        
        // Seeded random
        const random = this.seededRandom(seed);
        
        // Place starting room at center
        const startTemplate = templates[Math.floor(random() * templates.length)];
        const startNode = this.placeRoom(startTemplate, 50, 50, random);
        
        // Build graph by iteratively adding rooms
        let attempts = 0;
        const maxAttempts = this.MAX_ROOMS * 10;
        
        while (this.nodes.length < this.MAX_ROOMS && attempts < maxAttempts) {
            attempts++;
            
            // Find an unconnected opening
            const opening = this.findUnconnectedOpening(random);
            if (!opening) break;
            
            // Try to place a connecting room
            const placed = this.tryPlaceConnectingRoom(opening, templates, random);
            
            // Try to create loops with nearby rooms
            if (placed && random() < this.LOOP_PROBABILITY) {
                this.tryCreateLoop(placed, random);
            }
        }
        
        console.log(`Generated ${this.nodes.length} rooms with ${this.edges.length} connections`);
        
        // Convert graph to world tiles
        return this.buildWorld();
    },
    
    /**
     * Create a seeded random number generator
     * @param {number} seed
     * @returns {Function}
     */
    seededRandom(seed) {
        let state = seed;
        return () => {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        };
    },
    
    /**
     * Place a room at a position
     * @param {Object} template - Room template
     * @param {number} x - World X position (tiles)
     * @param {number} y - World Y position (tiles)
     * @param {Function} random - Seeded random function
     * @returns {Object} The placed node
     */
    placeRoom(template, x, y, random) {
        const node = {
            id: this.nodes.length,
            templateId: template.id,
            x,
            y,
            template,
            connections: [] // Opening indices that are connected
        };
        
        this.nodes.push(node);
        return node;
    },
    
    /**
     * Find an unconnected opening from any placed room
     * @param {Function} random
     * @returns {Object|null} { node, openingIndex, opening }
     */
    findUnconnectedOpening(random) {
        // Collect all unconnected openings
        const available = [];
        
        for (const node of this.nodes) {
            for (let i = 0; i < node.template.openings.length; i++) {
                if (!node.connections.includes(i)) {
                    available.push({
                        node,
                        openingIndex: i,
                        opening: node.template.openings[i]
                    });
                }
            }
        }
        
        if (available.length === 0) return null;
        
        // Pick a random one
        return available[Math.floor(random() * available.length)];
    },
    
    /**
     * Try to place a room connecting to an opening
     * @param {Object} openingData - { node, openingIndex, opening }
     * @param {Array} templates
     * @param {Function} random
     * @returns {Object|null} The placed node or null
     */
    tryPlaceConnectingRoom(openingData, templates, random) {
        const { node, openingIndex, opening } = openingData;
        
        // Find the opposite edge we need
        const neededEdge = RoomTemplates.getOppositeEdge(opening.edge);
        
        // Filter templates that have an opening on the needed edge
        const compatible = templates.filter(t => 
            t.openings.some(o => o.edge === neededEdge)
        );
        
        if (compatible.length === 0) return null;
        
        // Pick a random compatible template
        const newTemplate = compatible[Math.floor(random() * compatible.length)];
        
        // Find matching opening in new template
        const matchingOpenings = newTemplate.openings
            .map((o, i) => ({ opening: o, index: i }))
            .filter(({ opening: o }) => o.edge === neededEdge);
        
        const matchedOpening = matchingOpenings[Math.floor(random() * matchingOpenings.length)];
        
        // Calculate position for new room
        const pos = this.calculateRoomPosition(
            node, opening,
            newTemplate, matchedOpening.opening
        );
        
        // Check if position is valid (no overlap)
        if (!this.isPositionValid(pos.x, pos.y, newTemplate)) {
            return null;
        }
        
        // Place the room
        const newNode = this.placeRoom(newTemplate, pos.x, pos.y, random);
        
        // Create edge connection
        this.createConnection(node, openingIndex, newNode, matchedOpening.index);
        
        return newNode;
    },
    
    /**
     * Calculate position for a new room based on connection
     * @param {Object} fromNode
     * @param {Object} fromOpening
     * @param {Object} toTemplate
     * @param {Object} toOpening
     * @returns {Object} { x, y }
     */
    calculateRoomPosition(fromNode, fromOpening, toTemplate, toOpening) {
        // World position of the opening in the from room
        const fromWorldX = fromNode.x + fromOpening.x;
        const fromWorldY = fromNode.y + fromOpening.y;
        
        // Calculate offset based on edge directions
        let x, y;
        
        switch (fromOpening.edge) {
            case 'top':
                // New room goes above, its bottom opening connects
                x = fromWorldX - toOpening.x;
                y = fromWorldY - toTemplate.height;
                break;
            case 'bottom':
                // New room goes below, its top opening connects
                x = fromWorldX - toOpening.x;
                y = fromWorldY + 1;
                break;
            case 'left':
                // New room goes to the left, its right opening connects
                x = fromWorldX - toTemplate.width;
                y = fromWorldY - toOpening.y;
                break;
            case 'right':
                // New room goes to the right, its left opening connects
                x = fromWorldX + 1;
                y = fromWorldY - toOpening.y;
                break;
        }
        
        return { x, y };
    },
    
    /**
     * Check if a room can be placed at a position without overlap
     * @param {number} x
     * @param {number} y
     * @param {Object} template
     * @returns {boolean}
     */
    isPositionValid(x, y, template) {
        // Check against all existing rooms
        for (const node of this.nodes) {
            // Simple AABB overlap check
            const overlap = !(
                x + template.width <= node.x ||
                x >= node.x + node.template.width ||
                y + template.height <= node.y ||
                y >= node.y + node.template.height
            );
            
            if (overlap) return false;
        }
        
        return true;
    },
    
    /**
     * Create a connection between two rooms
     * @param {Object} nodeA
     * @param {number} openingA
     * @param {Object} nodeB
     * @param {number} openingB
     */
    createConnection(nodeA, openingA, nodeB, openingB) {
        // Mark openings as connected
        nodeA.connections.push(openingA);
        nodeB.connections.push(openingB);
        
        // Create edge
        this.edges.push({
            from: nodeA.id,
            to: nodeB.id,
            fromOpening: openingA,
            toOpening: openingB
        });
    },
    
    /**
     * Try to create a loop by connecting nearby rooms
     * @param {Object} node
     * @param {Function} random
     */
    tryCreateLoop(node, random) {
        // Find unconnected openings in this node
        for (let i = 0; i < node.template.openings.length; i++) {
            if (node.connections.includes(i)) continue;
            
            const opening = node.template.openings[i];
            const worldX = node.x + opening.x;
            const worldY = node.y + opening.y;
            
            // Look for nearby rooms with compatible openings
            for (const other of this.nodes) {
                if (other.id === node.id) continue;
                
                for (let j = 0; j < other.template.openings.length; j++) {
                    if (other.connections.includes(j)) continue;
                    
                    const otherOpening = other.template.openings[j];
                    
                    // Check if openings are compatible (opposite edges)
                    if (otherOpening.edge !== RoomTemplates.getOppositeEdge(opening.edge)) continue;
                    
                    const otherWorldX = other.x + otherOpening.x;
                    const otherWorldY = other.y + otherOpening.y;
                    
                    // Check if close enough to connect
                    const dist = Math.abs(worldX - otherWorldX) + Math.abs(worldY - otherWorldY);
                    if (dist <= this.MAX_CORRIDOR_LENGTH) {
                        this.createConnection(node, i, other, j);
                        return;
                    }
                }
            }
        }
    },
    
    /**
     * Build the world tile arrays from the graph
     * @returns {Object} World data compatible with existing system
     */
    buildWorld() {
        // Calculate world bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const node of this.nodes) {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.template.width);
            maxY = Math.max(maxY, node.y + node.template.height);
        }
        
        // Add margin
        const margin = 10;
        minX -= margin;
        minY -= margin;
        maxX += margin;
        maxY += margin;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Create tile arrays
        const tiles = new Int16Array(width * height).fill(-1);
        const bgTiles = new Int16Array(width * height).fill(-1);
        
        // Place room tiles
        for (const node of this.nodes) {
            this.placeRoomTiles(tiles, bgTiles, width, node, -minX, -minY);
        }
        
        // Generate corridors between connected rooms
        for (const edge of this.edges) {
            this.generateCorridor(tiles, bgTiles, width, edge, -minX, -minY);
        }
        
        // Find spawn point (first room's center)
        const spawnNode = this.nodes[0];
        const spawnX = (spawnNode.x - minX + spawnNode.template.width / 2) * 16;
        const spawnY = (spawnNode.y - minY + spawnNode.template.height / 2) * 16;
        
        return {
            width,
            height,
            tiles,
            bgTiles,
            biomeMap: new Array(width * height).fill('graph'),
            rooms: this.nodes.map(n => ({
                id: n.id,
                x: n.x - minX,
                y: n.y - minY,
                width: n.template.width,
                height: n.template.height,
                templateId: n.templateId
            })),
            corridors: this.edges,
            spawnPoint: { x: spawnX, y: spawnY }
        };
    },
    
    /**
     * Place room tiles into the world
     * @param {Int16Array} tiles
     * @param {Int16Array} bgTiles
     * @param {number} worldWidth
     * @param {Object} node
     * @param {number} offsetX
     * @param {number} offsetY
     */
    placeRoomTiles(tiles, bgTiles, worldWidth, node, offsetX, offsetY) {
        const template = node.template;
        const baseX = node.x + offsetX;
        const baseY = node.y + offsetY;
        
        for (let y = 0; y < template.height; y++) {
            for (let x = 0; x < template.width; x++) {
                const worldX = baseX + x;
                const worldY = baseY + y;
                const worldIdx = worldY * worldWidth + worldX;
                const templateIdx = y * template.width + x;
                
                const tile = template.tiles[templateIdx];
                if (tile >= 0) {
                    tiles[worldIdx] = tile;
                }
                
                // Set background for air tiles in rooms
                if (tile === -1) {
                    bgTiles[worldIdx] = TileAtlas.Tiles.Black ?? 17;
                }
            }
        }
    },
    
    /**
     * Generate a corridor between two connected rooms
     * AIDEV-NOTE: Uses noise for path variation and style blending
     * @param {Int16Array} tiles
     * @param {Int16Array} bgTiles
     * @param {number} worldWidth
     * @param {Object} edge
     * @param {number} offsetX
     * @param {number} offsetY
     */
    generateCorridor(tiles, bgTiles, worldWidth, edge, offsetX, offsetY) {
        const fromNode = this.nodes[edge.from];
        const toNode = this.nodes[edge.to];
        
        const fromOpening = fromNode.template.openings[edge.fromOpening];
        const toOpening = toNode.template.openings[edge.toOpening];
        
        // Calculate world positions of openings
        const x1 = fromNode.x + fromOpening.x + offsetX;
        const y1 = fromNode.y + fromOpening.y + offsetY;
        const x2 = toNode.x + toOpening.x + offsetX;
        const y2 = toNode.y + toOpening.y + offsetY;
        
        // Get style tiles from both rooms for blending
        const styleA = fromNode.template.style;
        const styleB = toNode.template.style;
        
        // Generate corridor path with noise variation
        this.carveCorridor(tiles, bgTiles, worldWidth, x1, y1, x2, y2, styleA, styleB);
    },
    
    /**
     * Carve a corridor path between two points
     * @param {Int16Array} tiles
     * @param {Int16Array} bgTiles
     * @param {number} worldWidth
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @param {Object} styleA
     * @param {Object} styleB
     */
    carveCorridor(tiles, bgTiles, worldWidth, x1, y1, x2, y2, styleA, styleB) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.max(Math.abs(dx), Math.abs(dy), 1);
        const halfWidth = Math.floor(this.CORRIDOR_WIDTH / 2);
        
        for (let i = 0; i <= dist; i++) {
            // Base position along corridor
            const t = i / dist;
            let cx = Math.round(x1 + dx * t);
            let cy = Math.round(y1 + dy * t);
            
            // Add noise variation to path
            const noiseX = Noise.get(cx, cy, this.PATH_NOISE_SCALE);
            const noiseY = Noise.get(cx + 1000, cy + 1000, this.PATH_NOISE_SCALE);
            
            // Apply noise perpendicular to corridor direction
            if (Math.abs(dx) > Math.abs(dy)) {
                // Mostly horizontal corridor - vary Y
                cy += Math.round((noiseY - 0.5) * this.PATH_NOISE_AMPLITUDE * 2);
            } else {
                // Mostly vertical corridor - vary X
                cx += Math.round((noiseX - 0.5) * this.PATH_NOISE_AMPLITUDE * 2);
            }
            
            // Carve corridor width
            for (let oy = -halfWidth; oy <= halfWidth; oy++) {
                for (let ox = -halfWidth; ox <= halfWidth; ox++) {
                    const wx = cx + ox;
                    const wy = cy + oy;
                    const idx = wy * worldWidth + wx;
                    
                    if (idx >= 0 && idx < tiles.length) {
                        // Carve air for corridor
                        tiles[idx] = -1;
                        
                        // Set background with style blending
                        bgTiles[idx] = this.blendStyle(styleA, styleB, t);
                    }
                }
            }
            
            // Add corridor walls (floors/ceilings)
            this.addCorridorWalls(tiles, worldWidth, cx, cy, halfWidth, styleA, styleB, t);
        }
    },
    
    /**
     * Add walls around a corridor segment
     */
    addCorridorWalls(tiles, worldWidth, cx, cy, halfWidth, styleA, styleB, t) {
        const wallOffset = halfWidth + 1;
        
        // Place wall tiles around the corridor
        for (let ox = -wallOffset; ox <= wallOffset; ox++) {
            // Top wall
            const topIdx = (cy - wallOffset) * worldWidth + cx + ox;
            if (topIdx >= 0 && topIdx < tiles.length && tiles[topIdx] === -1) {
                // Don't overwrite existing tiles, only place in air
            } else if (topIdx >= 0 && topIdx < tiles.length && tiles[topIdx] === -1) {
                tiles[topIdx] = this.blendTile(styleA.primary, styleB.primary, t);
            }
            
            // Bottom wall
            const botIdx = (cy + wallOffset) * worldWidth + cx + ox;
            if (botIdx >= 0 && botIdx < tiles.length && tiles[botIdx] === -1) {
                // Skip air tiles in corridor
            }
        }
    },
    
    /**
     * Blend between two styles based on position along corridor
     * @param {Object} styleA
     * @param {Object} styleB
     * @param {number} t - 0 to 1 blend factor
     * @returns {number} Blended tile index
     */
    blendStyle(styleA, styleB, t) {
        // Use noise to add variation to the blend
        const blendNoise = Noise.get(t * 100, 0, 5);
        const adjustedT = Math.max(0, Math.min(1, t + (blendNoise - 0.5) * 0.3));
        
        // Choose tile based on blend factor
        if (adjustedT < 0.5) {
            return styleA.background >= 0 ? styleA.background : (TileAtlas.Tiles.Black ?? 17);
        } else {
            return styleB.background >= 0 ? styleB.background : (TileAtlas.Tiles.Black ?? 17);
        }
    },
    
    /**
     * Blend between two tile types
     */
    blendTile(tileA, tileB, t) {
        return t < 0.5 ? tileA : tileB;
    },
    
    /**
     * Get graph statistics for debugging
     */
    getStats() {
        return {
            nodes: this.nodes.length,
            edges: this.edges.length,
            totalOpenings: this.nodes.reduce((sum, n) => sum + n.template.openings.length, 0),
            connectedOpenings: this.nodes.reduce((sum, n) => sum + n.connections.length, 0)
        };
    }
};

