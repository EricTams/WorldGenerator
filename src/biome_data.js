// AIDEV-NOTE: Biome-based generation system for WorldGenerator
// Each biome has:
//   - spawnConditions: where in the world it appears
//   - tileRules: what tiles to place within the biome

const BiomeData = {
    // Biomes (each has spawn conditions + tile rules)
    // Evaluated in order - first biome whose conditions match is used
    biomes: {},
    
    // Order of biome evaluation (array of biome IDs)
    biomeOrder: [],
    
    // =====================
    // DEFAULT CONFIGURATION
    // =====================
    
    // AIDEV-NOTE: Increment this when defaults change significantly
    // This triggers "new version available" warning in the editor
    DEFAULTS_VERSION: 14,
    
    defaults: {
        // Biome evaluation order (first match wins)
        biomeOrder: ['ancient', 'caves'],
        
        // Each biome has spawn conditions + tile rules
        // AIDEV-NOTE: Cave noise determines navigability:
        //   < 0.55: Solid wall (foreground tiles) - most of the world
        //   >= 0.55: Open cave (tunnels to explore)
        // AIDEV-NOTE: Background layer should ALWAYS use the Black tile.
        //   Tiles named "BG_*" (BG_Brick, BG_Sand, etc.) are decorative objects
        //   meant to be drawn in the background layer as scenery, NOT as the
        //   actual background fill. Black provides proper contrast for lighting.
        biomes: {
            ancient: {
                id: 'ancient',
                name: 'Ancient',
                icon: '🏛️',
                color: '#d4a574',
                spawnConditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'biome_noise', op: '>=', threshold: 0.8 }
                    ]
                },
                tileRules: [
                    {
                        id: 'ancient_sand',
                        name: 'Sand Walls',
                        tile: 'Sand',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '<', threshold: 0.55 },
                                { type: 'compare', value: 'detail_noise', op: '<', threshold: 0.6 }
                            ]
                        }
                    },
                    {
                        id: 'ancient_mechanical',
                        name: 'Mechanical Walls',
                        tile: 'Mechanical_Tile',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '<', threshold: 0.55 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.6 }
                            ]
                        }
                    },
                    // Ancient pillars in open areas
                    // Uses cave_noise with vertical scale for tall patterns
                    {
                        id: 'ancient_pillars',
                        name: 'Ancient Pillars',
                        tile: 'Pillar',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 },
                                { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'yScale', arg: 3 }], op: '>=', threshold: 0.6 }
                            ]
                        }
                    },
                    // Stone carvings for ancient decoration
                    {
                        id: 'ancient_carving',
                        name: 'Ancient Carving',
                        tile: 'Stone_Carving_3',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.6 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 8 }], op: '==', threshold: 4 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 9 }], op: '==', threshold: 3 },
                                { type: 'compare', value: 'random', op: '>=', threshold: 0.5 }
                            ]
                        }
                    },
                    {
                        id: 'ancient_bg',
                        name: 'Cave Background',
                        tile: 'Black',
                        layer: 'bg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 }
                            ]
                        }
                    }
                ]
            },
            caves: {
                id: 'caves',
                name: 'Caves',
                icon: '🕳️',
                color: '#5a4a3a',
                spawnConditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'biome_noise', op: '<', threshold: 0.8 }
                    ]
                },
                tileRules: [
                    // AIDEV-NOTE: Dirt_Grass for surface tiles (solid with air above)
                    // Must come BEFORE regular Dirt rule since first match wins
                    {
                        id: 'cave_dirt_grass',
                        name: 'Dirt Grass (Surface)',
                        tile: 'Dirt_Grass',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '<', threshold: 0.55 },
                                { type: 'compare', value: 'above_is_air', op: '==', threshold: 1 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Dirt_Bricks for variety in deeper/denser areas
                    {
                        id: 'cave_dirt_bricks',
                        name: 'Dirt Bricks',
                        tile: 'Dirt_Bricks',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '<', threshold: 0.55 },
                                { type: 'compare', value: 'above_is_air', op: '==', threshold: 0 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.65 }
                            ]
                        }
                    },
                    {
                        id: 'cave_dirt',
                        name: 'Dirt Walls',
                        tile: 'Dirt',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '<', threshold: 0.55 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Platforms on every 4th row
                    // Uses cave_noise with horizontal scale + power for sharp bands
                    {
                        id: 'cave_platforms',
                        name: 'Platforms',
                        tile: 'Platform',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'xScale', arg: 3 }, { op: '^', arg: 2 }], op: '>=', threshold: 0.5 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 1 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Ladders using vertical scale + power for sharp vertical bands
                    // x_tile % 3 prevents horizontal adjacency
                    {
                        id: 'cave_ladders',
                        name: 'Ladders',
                        tile: 'Ladder',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '!=', threshold: 1 },
                                { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'yScale', arg: 3 }, { op: '^', arg: 2 }], op: '>=', threshold: 0.6 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 3 }], op: '==', threshold: 0 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Pillars - vertical decorative columns in caves
                    // Uses cave_noise with vertical scale for tall patterns
                    {
                        id: 'cave_pillars',
                        name: 'Pillars',
                        tile: 'Pillar',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '!=', threshold: 1 },
                                { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'yScale', arg: 4 }], op: '>=', threshold: 0.7 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.5 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Ceiling thorns - hanging from cave ceilings
                    // Air tile with solid above = ceiling position
                    {
                        id: 'cave_ceiling_thorns',
                        name: 'Ceiling Thorns',
                        tile: 'Thorns',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'above_is_air', op: '==', threshold: 0 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.7 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 3 }], op: '==', threshold: 1 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Floor thorns - on cave floors
                    // Air tile with solid below = floor position
                    {
                        id: 'cave_floor_thorns',
                        name: 'Floor Thorns',
                        tile: 'Thorns',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.75 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Stone carvings - decorative wall details
                    {
                        id: 'cave_carving1',
                        name: 'Stone Carving 1',
                        tile: 'Stone_Carving_1',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 7 }], op: '==', threshold: 0 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 8 }], op: '==', threshold: 2 },
                                { type: 'compare', value: 'random', op: '>=', threshold: 0.6 }
                            ]
                        }
                    },
                    {
                        id: 'cave_carving2',
                        name: 'Stone Carving 2',
                        tile: 'Stone_Carving_2',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 7 }], op: '==', threshold: 0 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 8 }], op: '==', threshold: 5 },
                                { type: 'compare', value: 'random', op: '>=', threshold: 0.6 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: Smile blocks - rare fun decoration
                    {
                        id: 'cave_smile',
                        name: 'Smile Blocks',
                        tile: 'Smile_Block',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 12 }], op: '==', threshold: 6 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 15 }], op: '==', threshold: 7 },
                                { type: 'compare', value: 'random', op: '>=', threshold: 0.8 }
                            ]
                        }
                    },
                    {
                        id: 'cave_stairs_tl',
                        name: 'Stairs TL',
                        tile: 'Stair_Top_Left',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 8 }], op: '==', threshold: 3 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 0 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.7 }
                            ]
                        }
                    },
                    {
                        id: 'cave_stairs_tr',
                        name: 'Stairs TR',
                        tile: 'Stair_Top_Right',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 8 }], op: '==', threshold: 3 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 1 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.7 }
                            ]
                        }
                    },
                    // AIDEV-NOTE: BG decorations - thorns theme for caves
                    // These are drawn as fg layer but look like background scenery
                    {
                        id: 'cave_bg_thorns',
                        name: 'BG Thorns',
                        tile: 'BG_Thorns',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.6 },
                                { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 0 },
                                { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.55 },
                                { type: 'compare', value: 'detail_noise', op: '<', threshold: 0.7 }
                            ]
                        }
                    },
                    // Far background thorns for extra depth
                    {
                        id: 'cave_far_bg_thorns',
                        name: 'Far BG Thorns',
                        tile: 'Far_BG_Thorns',
                        layer: 'fg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.65 },
                                { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 7 }], op: '==', threshold: 3 },
                                { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'yScale', arg: 3 }], op: '>=', threshold: 0.45 },
                                { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'yScale', arg: 3 }], op: '<', threshold: 0.6 }
                            ]
                        }
                    },
                    {
                        id: 'cave_bg',
                        name: 'Cave Background',
                        tile: 'Black',
                        layer: 'bg',
                        conditions: {
                            type: 'AND',
                            conditions: [
                                { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 }
                            ]
                        }
                    }
                ]
            }
        }
    },
    
    // =====================
    // INITIALIZATION
    // =====================
    
    init() {
        this.biomes = JSON.parse(JSON.stringify(this.defaults.biomes));
        this.biomeOrder = JSON.parse(JSON.stringify(this.defaults.biomeOrder));
        console.log(`BiomeData initialized: ${Object.keys(this.biomes).length} biomes`);
    },
    
    // =====================
    // BIOMES API
    // =====================
    
    getBiomes() {
        // Return biomes in evaluation order
        return this.biomeOrder.map(id => this.biomes[id]).filter(Boolean);
    },
    
    getBiome(id) {
        return this.biomes[id] || null;
    },
    
    addBiome(biome) {
        this.biomes[biome.id] = biome;
        if (!this.biomeOrder.includes(biome.id)) {
            this.biomeOrder.push(biome.id);
        }
    },
    
    updateBiome(id, updates) {
        if (this.biomes[id]) {
            this.biomes[id] = { ...this.biomes[id], ...updates };
        }
    },
    
    removeBiome(id) {
        delete this.biomes[id];
        const index = this.biomeOrder.indexOf(id);
        if (index >= 0) {
            this.biomeOrder.splice(index, 1);
        }
    },
    
    // Reorder biomes (for drag-and-drop)
    reorderBiomes(newOrder) {
        this.biomeOrder = newOrder;
    },
    
    // =====================
    // BIOME TILE RULES API
    // =====================
    
    getBiomeTileRules(biomeId) {
        return this.biomes[biomeId]?.tileRules || [];
    },
    
    getBiomeTileRule(biomeId, ruleId) {
        const biome = this.biomes[biomeId];
        if (!biome) return null;
        return biome.tileRules.find(r => r.id === ruleId) || null;
    },
    
    addBiomeTileRule(biomeId, rule) {
        if (this.biomes[biomeId]) {
            this.biomes[biomeId].tileRules.push(rule);
        }
    },
    
    updateBiomeTileRule(biomeId, ruleId, updates) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        const index = biome.tileRules.findIndex(r => r.id === ruleId);
        if (index >= 0) {
            biome.tileRules[index] = { ...biome.tileRules[index], ...updates };
        }
    },
    
    removeBiomeTileRule(biomeId, ruleId) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        const index = biome.tileRules.findIndex(r => r.id === ruleId);
        if (index >= 0) {
            biome.tileRules.splice(index, 1);
        }
    },
    
    /**
     * Move a tile rule up or down in the order
     * @param {string} biomeId 
     * @param {string} ruleId 
     * @param {number} direction - -1 for up, +1 for down
     * @returns {boolean} true if moved successfully
     */
    moveBiomeTileRule(biomeId, ruleId, direction) {
        const biome = this.biomes[biomeId];
        if (!biome) return false;
        
        const index = biome.tileRules.findIndex(r => r.id === ruleId);
        if (index < 0) return false;
        
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= biome.tileRules.length) return false;
        
        // Swap the rules
        const temp = biome.tileRules[index];
        biome.tileRules[index] = biome.tileRules[newIndex];
        biome.tileRules[newIndex] = temp;
        
        return true;
    },
    
    // =====================
    // PERSISTENCE
    // =====================
    
    reset() {
        this.init();
    },
    
    exportJSON() {
        return JSON.stringify({
            biomeOrder: this.biomeOrder,
            biomes: this.biomes
        }, null, 2);
    },
    
    importJSON(json) {
        try {
            const data = JSON.parse(json);
            if (data.biomes) this.biomes = data.biomes;
            if (data.biomeOrder) {
                this.biomeOrder = data.biomeOrder;
            } else {
                // Fallback for old format
                this.biomeOrder = Object.keys(this.biomes);
            }
            console.log(`Imported: ${Object.keys(this.biomes).length} biomes`);
        } catch (e) {
            console.error('Failed to import:', e);
        }
    },
    
    // =====================
    // EVALUATION
    // =====================
    
    /**
     * Find which biome applies at a position
     * Evaluates biomes in order - first match wins
     */
    findBiomeForContext(context) {
        for (const biomeId of this.biomeOrder) {
            const biome = this.biomes[biomeId];
            if (biome && this.evaluateConditions(biome.spawnConditions, context)) {
                return biome;
            }
        }
        return null;
    },
    
    /**
     * Evaluate conditions
     */
    evaluateConditions(conditions, context) {
        if (!conditions || !conditions.conditions || conditions.conditions.length === 0) {
            return true;
        }
        
        const results = conditions.conditions.map(cond => this.evaluateCondition(cond, context));
        
        if (conditions.type === 'OR') {
            return results.some(r => r);
        } else {
            return results.every(r => r);
        }
    },
    
    // AIDEV-NOTE: Unified modifier chain system
    // Modifiers are applied in order. Scale modifiers (xScale, yScale) affect noise sampling.
    // Example: modifiers: [{ op: 'xScale', arg: 3 }, { op: '^', arg: 2 }]
    // = sample noise at x*3, then square the result
    
    evaluateCondition(cond, context) {
        const x = context.x_tile;
        const y = context.y_tile;
        
        // Collect scale factors from modifiers (applied to noise sampling)
        let xScale = 1, yScale = 1;
        const modifiers = cond.modifiers || [];
        
        // Legacy support: convert old format to new
        if (cond.scale) {
            xScale = cond.scale.x || 1;
            yScale = cond.scale.y || 1;
        }
        if (cond.modifier) {
            modifiers.push(cond.modifier);
        }
        
        // Extract scale modifiers first
        for (const mod of modifiers) {
            if (mod.op === 'xScale') xScale *= (mod.arg ?? 1);
            if (mod.op === 'yScale') yScale *= (mod.arg ?? 1);
        }
        
        // Sample value (with scaling for noise types)
        let value;
        if (this.isNoiseValue(cond.value) && (xScale !== 1 || yScale !== 1)) {
            value = this.getScaledNoiseValue(x * xScale, y * yScale, cond.value);
        } else {
            value = context[cond.value] ?? 0;
        }
        
        // Apply non-scale modifiers in order
        for (const mod of modifiers) {
            if (mod.op !== 'xScale' && mod.op !== 'yScale') {
                value = this.applyModifier(value, mod);
            }
        }
        
        switch (cond.op) {
            case '>': return value > cond.threshold;
            case '<': return value < cond.threshold;
            case '>=': return value >= cond.threshold;
            case '<=': return value <= cond.threshold;
            case '==': return value === cond.threshold;
            case '!=': return value !== cond.threshold;
            case 'between': return value >= cond.min && value <= cond.max;
            default: return true;
        }
    },
    
    /**
     * Check if a value type is noise-based (can be scaled)
     */
    isNoiseValue(valueType) {
        const noiseTypes = ['biome_noise', 'cave_noise', 'detail_noise'];
        return noiseTypes.includes(valueType);
    },
    
    /**
     * Get noise value with scaled coordinates
     */
    getScaledNoiseValue(sx, sy, noiseType) {
        switch (noiseType) {
            case 'biome_noise':
                return Noise.get(sx, sy, 30);
            case 'cave_noise':
                return Noise.getFBM(sx, sy, 20, 3);
            case 'detail_noise':
                return Noise.get(sx, sy, 8);
            default:
                return 0;
        }
    },
    
    /**
     * Apply a modifier operation to a value
     * @param {number} value - The input value
     * @param {Object} modifier - { op: string, arg?: number }
     * @returns {number} Modified value
     */
    applyModifier(value, modifier) {
        const arg = modifier.arg ?? 1;
        switch (modifier.op) {
            case '%': return value % arg;           // Modulo (for regular patterns)
            case '*': return value * arg;           // Multiply (scale up)
            case '/': return value / arg;           // Divide (scale down)
            case '+': return value + arg;           // Add (offset)
            case '-': return value - arg;           // Subtract
            case '^': return Math.pow(value, arg);  // Power (^2 = sharper, ^0.5 = softer)
            case 'floor': return Math.floor(value); // Round down
            case 'round': return Math.round(value * arg) / arg; // Round to precision
            case 'abs': return Math.abs(value);     // Absolute value
            default: return value;
        }
    }
};
