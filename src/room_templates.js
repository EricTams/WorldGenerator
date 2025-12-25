// AIDEV-NOTE: Room Template System for Graph-Based Dungeon Generation
// Stores uploaded room templates with tile data and detected openings

const RoomTemplates = {
    // All registered room templates
    templates: {},
    
    // Template order for UI display
    templateOrder: [],
    
    // AIDEV-NOTE: Track whether templates are loaded from localStorage
    templatesLoaded: false,
    
    /**
     * Room Template data structure:
     * {
     *   id: string,
     *   name: string,
     *   width: number,          // Width in tiles
     *   height: number,         // Height in tiles
     *   tiles: Int16Array,      // Flat array of tile indices (row-major), -1 = air
     *   openings: [             // Connection points on edges
     *     { edge: 'top'|'bottom'|'left'|'right', x: number, y: number }
     *   ],
     *   style: {                // Dominant tiles for style blending
     *     primary: number,      // Most common solid tile index
     *     secondary: number,    // Second most common
     *     background: number    // Most common bg tile
     *   },
     *   thumbnail: string       // Base64 data URL for preview (optional)
     * }
     */
    
    /**
     * Initialize the template system
     */
    init() {
        this.templates = {};
        this.templateOrder = [];
        this.templatesLoaded = false;
        
        // Try to load from localStorage
        this.loadFromStorage();
        
        console.log('RoomTemplates initialized');
    },
    
    /**
     * Load templates from localStorage
     * AIDEV-NOTE: Handles both legacy (raw indices) and new (legend-based) formats
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('worldgen_room_templates');
            let templateList = null;
            let source = 'localStorage';
            
            if (stored) {
                const data = JSON.parse(stored);
                // Handle both array format (legacy saveToStorage) and object format (exportJSON)
                templateList = Array.isArray(data) ? data : Object.values(data.templates || {});
            } else if (typeof DefaultRooms !== 'undefined' && Array.isArray(DefaultRooms) && DefaultRooms.length > 0) {
                // AIDEV-NOTE: Fall back to bundled DefaultRooms when localStorage is empty
                // This enables the game to work when opened via file:// protocol
                templateList = DefaultRooms;
                source = 'DefaultRooms (bundled)';
            }
            
            if (templateList && templateList.length > 0) {
                // Clear existing data before loading
                this.templates = {};
                this.templateOrder = [];
                
                for (const t of templateList) {
                    const template = this.deserializeTemplate(t);
                    if (template) {
                        this.templates[template.id] = template;
                        this.templateOrder.push(template.id);
                    }
                }
                this.templatesLoaded = true;
                console.log(`Loaded ${templateList.length} room templates from ${source}`);
            }
        } catch (e) {
            console.warn('Failed to load room templates from localStorage:', e);
        }
    },
    
    /**
     * Deserialize a template from storage, handling legend-based format
     * AIDEV-NOTE: Looks up tile names in current atlas to get correct indices
     * Also handles legacy format (raw indices) for backwards compatibility
     * @param {Object} data - Serialized template data
     * @returns {Object|null} Deserialized template or null on error
     */
    deserializeTemplate(data) {
        try {
            // Check if this is the new legend-based format
            if (data.legend && Array.isArray(data.legend)) {
                // New format: convert legend indices back to atlas indices
                const legendToAtlas = data.legend.map(tileName => {
                    if (tileName === 'Air') return -1;
                    
                    // Look up tile name in current atlas
                    const jsName = tileName.replace(/ /g, '_').replace(/[()]/g, '');
                    const atlasIdx = TileAtlas.Tiles[jsName];
                    
                    if (atlasIdx !== undefined) {
                        return atlasIdx;
                    }
                    
                    // Try to find by display name
                    const idx = TileAtlas.TileData.findIndex(td => td.name === tileName);
                    if (idx >= 0) return idx;
                    
                    console.warn(`Unknown tile in room template: "${tileName}"`);
                    return -1; // Default to air for unknown tiles
                });
                
                // Convert legend indices to atlas indices
                const tiles = new Int16Array(data.tiles.length);
                for (let i = 0; i < data.tiles.length; i++) {
                    const legendIdx = data.tiles[i];
                    tiles[i] = legendToAtlas[legendIdx] ?? -1;
                }
                
                return {
                    id: data.id,
                    name: data.name,
                    width: data.width,
                    height: data.height,
                    tiles: tiles,
                    openings: data.openings,
                    style: data.style
                };
            } else {
                // Legacy format: raw tile indices (may be wrong after atlas changes)
                console.warn(`Room template "${data.name}" uses legacy format - tile indices may be incorrect`);
                return {
                    id: data.id,
                    name: data.name,
                    width: data.width,
                    height: data.height,
                    tiles: new Int16Array(data.tiles),
                    openings: data.openings,
                    style: data.style
                };
            }
        } catch (e) {
            console.error(`Failed to deserialize room template "${data.name}":`, e);
            return null;
        }
    },
    
    /**
     * Save templates to localStorage
     * AIDEV-NOTE: Uses name-based legend so templates survive atlas index changes
     */
    saveToStorage() {
        try {
            const templates = this.getAllTemplates();
            const saveData = templates.map(t => this.serializeTemplate(t));
            localStorage.setItem('worldgen_room_templates', JSON.stringify(saveData));
            console.log(`Saved ${templates.length} room templates to localStorage`);
        } catch (e) {
            console.warn('Failed to save room templates to localStorage:', e);
        }
    },
    
    /**
     * Serialize a template for storage with name-based legend
     * AIDEV-NOTE: Creates a legend mapping legend indices to tile names
     * Tile data stored as legend indices (compact) rather than atlas indices
     * @param {Object} template
     * @returns {Object} Serialized template
     */
    serializeTemplate(template) {
        // Build legend: collect unique tile indices used in this template
        const usedIndices = new Set();
        for (let i = 0; i < template.tiles.length; i++) {
            usedIndices.add(template.tiles[i]);
        }
        
        // Create legend: legendIdx -> tileName
        // -1 (air) maps to "Air" special name
        const legend = [];
        const indexToLegend = new Map();
        
        for (const tileIdx of usedIndices) {
            const legendIdx = legend.length;
            indexToLegend.set(tileIdx, legendIdx);
            
            if (tileIdx === -1) {
                legend.push('Air');
            } else {
                const data = TileAtlas.TileData[tileIdx];
                legend.push(data ? data.name : `Unknown_${tileIdx}`);
            }
        }
        
        // Convert tile data to legend indices
        const legendTiles = new Array(template.tiles.length);
        for (let i = 0; i < template.tiles.length; i++) {
            legendTiles[i] = indexToLegend.get(template.tiles[i]);
        }
        
        return {
            id: template.id,
            name: template.name,
            width: template.width,
            height: template.height,
            legend: legend,           // Array of tile names
            tiles: legendTiles,       // Array of legend indices
            openings: template.openings,
            style: template.style
        };
    },
    
    /**
     * Create a new room template from parsed tile data
     * @param {string} name - Template name
     * @param {number} width - Width in tiles
     * @param {number} height - Height in tiles
     * @param {Int16Array} tiles - Flat tile array (row-major)
     * @param {string} thumbnail - Optional base64 preview image
     * @returns {Object} The created template
     */
    createTemplate(name, width, height, tiles, thumbnail = null) {
        const id = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const template = {
            id,
            name,
            width,
            height,
            tiles: tiles instanceof Int16Array ? tiles : new Int16Array(tiles),
            openings: this.detectOpenings(width, height, tiles),
            style: this.analyzeStyle(tiles),
            thumbnail
        };
        
        this.templates[id] = template;
        this.templateOrder.push(id);
        this.templatesLoaded = true;
        
        console.log(`Created room template '${name}': ${width}x${height}, ${template.openings.length} openings`);
        return template;
    },
    
    /**
     * Detect openings (connected passable regions touching edges) for graph connections
     * AIDEV-NOTE: Uses flood-fill to find connected passable regions that touch edges.
     * Each region becomes ONE opening tagged with which edges it touches.
     * This handles corner openings that span multiple edges.
     * 
     * BLOCKER TILES:
     * - Air Blocker: Forces passable (allows connections even if visually solid)
     * - Solid Blocker: Forces solid (blocks connections even if visually empty)
     * 
     * @param {number} width
     * @param {number} height
     * @param {Int16Array} tiles
     * @returns {Array} Array of opening objects
     */
    detectOpenings(width, height, tiles) {
        const openings = [];
        const visited = new Uint8Array(width * height);
        
        // AIDEV-NOTE: Blocker tile indices for connection control
        const AIR_BLOCKER = TileAtlas.Tiles.Air_Blocker;      // Forces passable
        const SOLID_BLOCKER = TileAtlas.Tiles.Solid_Blocker;  // Forces solid
        
        // Helper to check if a tile is passable (air, background, or Air Blocker)
        const isPassable = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            const tileIdx = tiles[y * width + x];
            if (tileIdx === -1) return true; // Air
            
            // AIDEV-NOTE: Blocker tiles override normal passability rules
            if (tileIdx === AIR_BLOCKER) return true;   // Air Blocker forces passable
            if (tileIdx === SOLID_BLOCKER) return false; // Solid Blocker forces solid
            
            const data = TileAtlas.TileData[tileIdx];
            if (data) {
                return data.category === 'BG' || data.category === 'FAR_BG';
            }
            return false;
        };
        
        // Helper to check which edge a tile is on
        const getEdges = (x, y) => {
            const edges = [];
            if (y === 0) edges.push('top');
            if (y === height - 1) edges.push('bottom');
            if (x === 0) edges.push('left');
            if (x === width - 1) edges.push('right');
            return edges;
        };
        
        // Flood fill from a starting point, returning all connected passable tiles
        const floodFill = (startX, startY) => {
            const region = [];
            const edgeTiles = { top: [], bottom: [], left: [], right: [] };
            const stack = [[startX, startY]];
            
            while (stack.length > 0) {
                const [x, y] = stack.pop();
                const idx = y * width + x;
                
                if (visited[idx]) continue;
                if (!isPassable(x, y)) continue;
                
                visited[idx] = 1;
                region.push({ x, y });
                
                // Track which edges this tile touches
                const edges = getEdges(x, y);
                for (const edge of edges) {
                    edgeTiles[edge].push({ x, y });
                }
                
                // Expand to neighbors (4-directional)
                stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
            }
            
            return { region, edgeTiles };
        };
        
        // Find all passable regions that touch edges
        // Start flood fill from each edge tile
        for (let x = 0; x < width; x++) {
            // Top edge
            if (!visited[x] && isPassable(x, 0)) {
                const { region, edgeTiles } = floodFill(x, 0);
                if (region.length > 0) {
                    openings.push(this.createOpeningFromRegion(region, edgeTiles, width, height));
                }
            }
            // Bottom edge
            const bottomIdx = (height - 1) * width + x;
            if (!visited[bottomIdx] && isPassable(x, height - 1)) {
                const { region, edgeTiles } = floodFill(x, height - 1);
                if (region.length > 0) {
                    openings.push(this.createOpeningFromRegion(region, edgeTiles, width, height));
                }
            }
        }
        
        for (let y = 0; y < height; y++) {
            // Left edge
            const leftIdx = y * width;
            if (!visited[leftIdx] && isPassable(0, y)) {
                const { region, edgeTiles } = floodFill(0, y);
                if (region.length > 0) {
                    openings.push(this.createOpeningFromRegion(region, edgeTiles, width, height));
                }
            }
            // Right edge
            const rightIdx = y * width + (width - 1);
            if (!visited[rightIdx] && isPassable(width - 1, y)) {
                const { region, edgeTiles } = floodFill(width - 1, y);
                if (region.length > 0) {
                    openings.push(this.createOpeningFromRegion(region, edgeTiles, width, height));
                }
            }
        }
        
        return openings;
    },
    
    /**
     * Create an opening object from a flood-filled region
     * @param {Array} region - All tiles in the region
     * @param {Object} edgeTiles - Tiles on each edge { top: [], bottom: [], left: [], right: [] }
     * @param {number} width
     * @param {number} height
     * @returns {Object} Opening object
     */
    createOpeningFromRegion(region, edgeTiles, width, height) {
        // Determine which edges this opening touches
        const edges = [];
        const edgePoints = {};
        
        for (const edge of ['top', 'bottom', 'left', 'right']) {
            if (edgeTiles[edge].length > 0) {
                edges.push(edge);
                // Calculate center point for this edge
                const tiles = edgeTiles[edge];
                const centerIdx = Math.floor(tiles.length / 2);
                edgePoints[edge] = tiles[centerIdx];
            }
        }
        
        // Calculate overall center of the region (for positioning)
        const centerX = Math.round(region.reduce((sum, t) => sum + t.x, 0) / region.length);
        const centerY = Math.round(region.reduce((sum, t) => sum + t.y, 0) / region.length);
        
        return {
            edges,           // Which edges this opening touches ['top', 'left', etc.]
            edgePoints,      // Center point on each edge { top: {x,y}, left: {x,y}, ... }
            x: centerX,      // Overall center X
            y: centerY,      // Overall center Y
            size: region.length,  // Total passable tiles in this opening
            tiles: region    // All tiles in the opening (for debugging/visualization)
        };
    },
    
    /**
     * Analyze tile usage to determine room style
     * @param {Int16Array} tiles
     * @returns {Object} Style information
     */
    analyzeStyle(tiles) {
        const counts = {};
        
        // Count tile occurrences (excluding air)
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            if (tile >= 0) {
                counts[tile] = (counts[tile] || 0) + 1;
            }
        }
        
        // Sort by frequency
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([tile]) => parseInt(tile));
        
        return {
            primary: sorted[0] ?? -1,
            secondary: sorted[1] ?? sorted[0] ?? -1,
            background: this.findBackgroundTile(sorted)
        };
    },
    
    /**
     * Find a background tile from the sorted tile list
     * @param {Array} sortedTiles
     * @returns {number} Background tile index
     */
    findBackgroundTile(sortedTiles) {
        // Look for tiles in the BG category
        for (const tile of sortedTiles) {
            const data = TileAtlas.TileData[tile];
            if (data && (data.category === 'BG' || data.category === 'FAR_BG')) {
                return tile;
            }
        }
        // Default to Black tile for backgrounds
        return TileAtlas.Tiles.Black ?? -1;
    },
    
    /**
     * Get a template by ID
     * @param {string} id
     * @returns {Object|null}
     */
    getTemplate(id) {
        return this.templates[id] || null;
    },
    
    /**
     * Get all templates in order
     * @returns {Array}
     */
    getAllTemplates() {
        return this.templateOrder.map(id => this.templates[id]).filter(Boolean);
    },
    
    /**
     * Get templates that have an opening on a specific edge
     * @param {string} edge - 'top', 'bottom', 'left', 'right'
     * @returns {Array}
     */
    getTemplatesWithOpening(edge) {
        return this.getAllTemplates().filter(t => 
            t.openings.some(o => o.edge === edge)
        );
    },
    
    /**
     * Get the opposite edge
     * @param {string} edge
     * @returns {string}
     */
    getOppositeEdge(edge) {
        const opposites = {
            'top': 'bottom',
            'bottom': 'top',
            'left': 'right',
            'right': 'left'
        };
        return opposites[edge];
    },
    
    /**
     * Update a template
     * @param {string} id
     * @param {Object} updates
     */
    updateTemplate(id, updates) {
        if (this.templates[id]) {
            this.templates[id] = { ...this.templates[id], ...updates };
            
            // Recalculate derived properties if tiles changed
            if (updates.tiles) {
                const t = this.templates[id];
                t.openings = this.detectOpenings(t.width, t.height, t.tiles);
                t.style = this.analyzeStyle(t.tiles);
            }
        }
    },
    
    /**
     * Delete a template
     * @param {string} id
     */
    deleteTemplate(id) {
        delete this.templates[id];
        const idx = this.templateOrder.indexOf(id);
        if (idx >= 0) {
            this.templateOrder.splice(idx, 1);
        }
    },
    
    /**
     * Get tile at position in a template
     * @param {Object} template
     * @param {number} x
     * @param {number} y
     * @returns {number} Tile index or -1
     */
    getTile(template, x, y) {
        if (x < 0 || x >= template.width || y < 0 || y >= template.height) {
            return -1;
        }
        return template.tiles[y * template.width + x];
    },
    
    /**
     * Set tile at position in a template
     * @param {Object} template
     * @param {number} x
     * @param {number} y
     * @param {number} tileIndex
     */
    setTile(template, x, y, tileIndex) {
        if (x >= 0 && x < template.width && y >= 0 && y < template.height) {
            template.tiles[y * template.width + x] = tileIndex;
        }
    },
    
    // =====================
    // PERSISTENCE
    // =====================
    
    /**
     * Export templates to JSON
     * AIDEV-NOTE: Uses legend-based format for atlas-independent storage
     * @returns {string}
     */
    exportJSON() {
        const exportData = {
            version: 2,  // Version 2 = legend-based format
            templateOrder: this.templateOrder,
            templates: {}
        };
        
        for (const [id, template] of Object.entries(this.templates)) {
            exportData.templates[id] = this.serializeTemplate(template);
        }
        
        return JSON.stringify(exportData, null, 2);
    },
    
    /**
     * Import templates from JSON
     * AIDEV-NOTE: Handles both legacy and legend-based formats
     * @param {string} json
     */
    importJSON(json) {
        try {
            const data = JSON.parse(json);
            
            this.templates = {};
            this.templateOrder = data.templateOrder || [];
            
            for (const [id, templateData] of Object.entries(data.templates || {})) {
                const template = this.deserializeTemplate(templateData);
                if (template) {
                    this.templates[id] = template;
                }
            }
            
            this.templatesLoaded = Object.keys(this.templates).length > 0;
            console.log(`Imported ${Object.keys(this.templates).length} room templates`);
        } catch (e) {
            console.error('Failed to import room templates:', e);
        }
    },
    
    /**
     * Save templates to localStorage
     */
    saveToLocal() {
        try {
            localStorage.setItem('worldgen_room_templates', this.exportJSON());
            console.log('Room templates saved to localStorage');
        } catch (e) {
            console.error('Failed to save room templates:', e);
        }
    },
    
    /**
     * Load templates from localStorage
     * @returns {boolean} True if templates were loaded
     */
    loadFromLocal() {
        try {
            const json = localStorage.getItem('worldgen_room_templates');
            if (json) {
                this.importJSON(json);
                return this.templatesLoaded;
            }
        } catch (e) {
            console.error('Failed to load room templates:', e);
        }
        return false;
    },
    
    /**
     * Migrate templates to legend-based format
     * AIDEV-NOTE: Call this to convert old raw-index templates to new format
     * Re-saves all templates using the new legend-based serialization
     * @returns {number} Number of templates migrated
     */
    migrateToLegendFormat() {
        const count = Object.keys(this.templates).length;
        if (count > 0) {
            // Re-save will use the new legend-based format
            this.saveToStorage();
            console.log(`Migrated ${count} room templates to legend-based format`);
        }
        return count;
    },
    
    /**
     * Clear all room templates from storage and memory
     * AIDEV-NOTE: Use if you need to start fresh after atlas changes
     */
    clearAll() {
        this.templates = {};
        this.templateOrder = [];
        this.templatesLoaded = false;
        localStorage.removeItem('worldgen_room_templates');
        console.log('Cleared all room templates');
    }
};

