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
    
    // AIDEV-NOTE: Corridor configuration for Hub and Spokes mode
    // Shape parameters control how corridors are carved between rooms
    corridorConfig: {
        width: 3,           // Corridor width in tiles (1-7)
        noiseAmplitude: 4,  // How much corridors wander (0 = straight, 10 = very wavy)
        widthVariation: 2,  // How much width varies along corridor (0 = constant width)
        // AIDEV-NOTE: Cave carving creates organic caves around room air
        caveDistance: 12,   // Max distance from room air to carve (0 = disabled)
        caveRoughness: 4    // How much noise affects carving boundary (0 = smooth, 10 = rough)
    },
    
    // AIDEV-NOTE: Corridor tile rules - evaluated for each tile in corridors
    // Context includes: corridor_t (0-1 position along path), x_tile, y_tile, random, detail_noise
    // Rules for 'wall' layer select wall tiles, 'bg' layer selects background
    corridorTileRules: [],
    
    // AIDEV-NOTE: Track whether rules are loaded
    // When false, the world should be empty and rule loader shown
    rulesLoaded: false,
    
    // Current rule set name for display
    currentRuleSet: null,
    
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
        // AIDEV-NOTE: *** DO NOT CHANGE THIS NOTE OR THE BLACK TILE USAGE ***
        // Background layer should ALWAYS use the Black tile.
        //   The Black tile is a solid black 16x16 tile specifically created for
        //   cave/dungeon backgrounds. It provides proper contrast for lighting.
        //   Tiles named "BG_*" (BG_Brick, BG_Sand, etc.) are decorative objects
        //   meant to be drawn in the foreground layer as background scenery, NOT
        //   as the actual background fill. ALWAYS USE 'Black' FOR bg LAYER.
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
        },
        
        // AIDEV-NOTE: Default corridor configuration for Hub and Spokes mode
        corridorConfig: {
            width: 3,
            noiseAmplitude: 4,
            widthVariation: 2,
            caveDistance: 12,
            caveRoughness: 4
        },
        
        // AIDEV-NOTE: Default corridor tile rules (~4 tiles each for walls and backgrounds)
        // AIDEV-NOTE: Corridor rules use detail_noise for organic variation
        // Context values: corridor_t (0-1), x_tile, y_tile, random, detail_noise
        corridorTileRules: [
            // Wall tiles (corridor border) - evaluated first match wins
            // Using noise thresholds to create bands of different tiles
            {
                id: 'corridor_wall_carving',
                name: 'Stone Carving',
                tile: 'Stone_Carving_1',
                layer: 'wall',
                conditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.75 }
                    ]
                }
            },
            {
                id: 'corridor_wall_dirt',
                name: 'Dirt Walls',
                tile: 'Dirt',
                layer: 'wall',
                conditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.5 }
                    ]
                }
            },
            {
                id: 'corridor_wall_brick',
                name: 'Brick Walls',
                tile: 'Brick',
                layer: 'wall',
                conditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.25 }
                    ]
                }
            },
            {
                id: 'corridor_wall_stone',
                name: 'Stone',
                tile: 'Stone',
                layer: 'wall',
                conditions: {
                    type: 'AND',
                    conditions: []  // Default fallback (detail_noise < 0.25)
                }
            },
            // Background tiles (inside corridor passable space)
            {
                id: 'corridor_bg_brick',
                name: 'BG Brick',
                tile: 'BG_Brick',
                layer: 'bg',
                conditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.6 }
                    ]
                }
            },
            {
                id: 'corridor_bg_far_brick',
                name: 'Far BG Brick',
                tile: 'Far_BG_Brick',
                layer: 'bg',
                conditions: {
                    type: 'AND',
                    conditions: [
                        { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.3 }
                    ]
                }
            },
            {
                id: 'corridor_bg_black',
                name: 'Black Background',
                tile: 'Black',
                layer: 'bg',
                conditions: {
                    type: 'AND',
                    conditions: []  // Default fallback
                }
            }
        ]
    },
    
    // =====================
    // INITIALIZATION
    // =====================
    
    /**
     * Initialize with empty state - no rules loaded
     * Rules are loaded explicitly via loadDefaultDungeon(), loadLocal(), etc.
     */
    init() {
        this.biomes = {};
        this.biomeOrder = [];
        this.corridorConfig = { width: 3, noiseAmplitude: 4, widthVariation: 2, caveDistance: 12, caveRoughness: 4 };
        this.corridorTileRules = [];
        this.rulesLoaded = false;
        this.currentRuleSet = null;
        console.log('BiomeData initialized (no rules loaded)');
    },
    
    /**
     * Load the default dungeon rules
     */
    loadDefaultDungeon() {
        this.biomes = JSON.parse(JSON.stringify(this.defaults.biomes));
        this.biomeOrder = JSON.parse(JSON.stringify(this.defaults.biomeOrder));
        this.corridorConfig = JSON.parse(JSON.stringify(this.defaults.corridorConfig));
        this.corridorTileRules = JSON.parse(JSON.stringify(this.defaults.corridorTileRules));
        this.rulesLoaded = true;
        this.currentRuleSet = 'Default Dungeon';
        console.log(`Loaded Default Dungeon: ${Object.keys(this.biomes).length} biomes, ${this.corridorTileRules.length} corridor rules`);
    },
    
    /**
     * Load the Generation Zoo (demo/example rules)
     * AIDEV-NOTE: 8x8 grid - each cell is a mini Terraria-style world showcasing a feature
     * Each cell's rules are organized into collapsible groups
     */
    loadGenerationZoo() {
        const CELL = 16;
        
        // Helper: conditions to check if we're in a specific cell
        const inCell = (col, row) => [
            { type: 'compare', value: 'x_tile', modifiers: [{ op: '/', arg: CELL }, { op: 'floor' }], op: '==', threshold: col },
            { type: 'compare', value: 'y_tile', modifiers: [{ op: '/', arg: CELL }, { op: 'floor' }], op: '==', threshold: row }
        ];
        
        // Helper: check if tile is solid (cave_noise < 0.55)
        const isSolid = { type: 'compare', value: 'cave_noise', op: '<', threshold: 0.55 };
        const isAir = { type: 'compare', value: 'cave_noise', op: '>=', threshold: 0.55 };
        
        // Helper: surface detection
        const aboveIsAir = { type: 'compare', value: 'above_is_air', op: '==', threshold: 1 };
        
        this.biomes = {
            zoo_grid: {
                id: 'zoo_grid',
                name: 'Generation Zoo',
                icon: '🦁',
                color: '#f5a623',
                spawnConditions: { type: 'AND', conditions: [] },
                tileRules: [
                    // ===================
                    // BORDERS GROUP
                    // ===================
                    {
                        type: 'group', id: 'grp_borders', name: '📐 Cell Borders', collapsed: true,
                        rules: [
                            { id: 'border_v', name: 'Vertical', tile: 'Unbreakable_Frame', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: CELL }], op: '==', threshold: 0 }
                                ] } },
                            { id: 'border_h', name: 'Horizontal', tile: 'Unbreakable_Frame', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: CELL }], op: '==', threshold: 0 }
                                ] } }
                        ]
                    },
                    
                    // ===================
                    // ROW 0
                    // ===================
                    {
                        type: 'group', id: 'grp_0_0', name: '🪜 (0,0) Ladders', collapsed: true,
                        rules: [
                            { id: 'c00_ladder', name: 'Ladder', tile: 'Ladder', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    ...inCell(0, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c00_grass', name: 'Grass', tile: 'Dirt_Grass', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 0), isSolid, aboveIsAir] } },
                            { id: 'c00_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_1_0', name: '━ (1,0) Platforms', collapsed: true,
                        rules: [
                            { id: 'c10_plat', name: 'Platform', tile: 'Platform', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    ...inCell(1, 0), isAir,
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c10_grass', name: 'Grass', tile: 'Dirt_Grass', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 0), isSolid, aboveIsAir] } },
                            { id: 'c10_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_2_0', name: '🏛️ (2,0) Pillars', collapsed: true,
                        rules: [
                            { id: 'c20_pillar', name: 'Pillar', tile: 'Pillar', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    ...inCell(2, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 },
                                    { type: 'compare', value: 'cave_noise', modifiers: [{ op: 'yScale', arg: 3 }], op: '>=', threshold: 0.5 }
                                ] } },
                            { id: 'c20_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_3_0', name: '💧 (3,0) Stalactites', collapsed: true,
                        rules: [
                            { id: 'c30_slime', name: 'Drip', tile: 'Slime', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    ...inCell(3, 0), isAir,
                                    { type: 'compare', value: 'above_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 3 }], op: '==', threshold: 1 }
                                ] } },
                            { id: 'c30_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_4_0', name: '⚠️ (4,0) Thorns', collapsed: true,
                        rules: [
                            { id: 'c40_ceil', name: 'Ceiling', tile: 'Thorns', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    ...inCell(4, 0), isAir,
                                    { type: 'compare', value: 'above_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c40_floor', name: 'Floor', tile: 'Thorns', layer: 'fg',
                                conditions: { type: 'AND', conditions: [
                                    ...inCell(4, 0), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 0 }
                                ] } },
                            { id: 'c40_meteor', name: 'Meteor', tile: 'Meteor_Rock', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_5_0', name: '📶 (5,0) Stairs', collapsed: true,
                        rules: [
                            { id: 'c50_stl', name: 'Top-Left', tile: 'Stair_Top_Left', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 1 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 1 }
                                ] } },
                            { id: 'c50_str', name: 'Top-Right', tile: 'Stair_Top_Right', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 1 }
                                ] } },
                            { id: 'c50_sbl', name: 'Bottom-Left', tile: 'Stair_Bottom_Left', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 1 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c50_sbr', name: 'Bottom-Right', tile: 'Stair_Bottom_Right', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c50_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_6_0', name: '🗿 (6,0) Carvings', collapsed: true,
                        rules: [
                            { id: 'c60_carv', name: 'Carving', tile: 'Stone_Carving_1', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 0), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 7 }], op: '==', threshold: 3 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c60_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 0), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_7_0', name: '😊 (7,0) Smile Blocks', collapsed: true,
                        rules: [
                            { id: 'c70_smile', name: 'Smile', tile: 'Smile_Block', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 0), isAir,
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.92 }
                                ] } },
                            { id: 'c70_dirt', name: 'Dirt Bricks', tile: 'Dirt_Bricks', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 0), isSolid] } }
                        ]
                    },
                    
                    // ===================
                    // ROW 1
                    // ===================
                    {
                        type: 'group', id: 'grp_0_1', name: '🪟 (0,1) Glass', collapsed: true,
                        rules: [
                            { id: 'c01_glass', name: 'Glass', tile: 'Glass', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 1), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c01_mech', name: 'Mechanical', tile: 'Mechanical_Tile', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_1_1', name: '⚡ (1,1) Power', collapsed: true,
                        rules: [
                            { id: 'c11_power', name: 'Power Block', tile: 'Big_Power_Block', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 1), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 8 }], op: 'between', min: 3, max: 4 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 8 }], op: 'between', min: 3, max: 4 }
                                ] } },
                            { id: 'c11_elec', name: 'Electric', tile: 'Electric_Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_2_1', name: '🔘 (2,1) Buttons', collapsed: true,
                        rules: [
                            { id: 'c21_on', name: 'On', tile: 'Button_On', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 1), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c21_off', name: 'Off', tile: 'Button_Off', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 1), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 5 }
                                ] } },
                            { id: 'c21_mech', name: 'Mechanical', tile: 'Mechanical_Tile', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_3_1', name: '🔀 (3,1) Wall Switches', collapsed: true,
                        rules: [
                            { id: 'c31_on', name: 'On', tile: 'Brick_Switch_On', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 1), isAir,
                                    { type: 'compare', value: 'left_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c31_off', name: 'Off', tile: 'Brick_Switch_Off', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 1), isAir,
                                    { type: 'compare', value: 'right_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c31_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_4_1', name: '🍈 (4,1) Melons', collapsed: true,
                        rules: [
                            { id: 'c41_melon', name: 'Melon', tile: 'Melon', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 1), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.7 }
                                ] } },
                            { id: 'c41_grass', name: 'Grass', tile: 'Dirt_Grass', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 1), isSolid, aboveIsAir] } },
                            { id: 'c41_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_5_1', name: '🎹 (5,1) Pianos', collapsed: true,
                        rules: [
                            { id: 'c51_piano', name: 'Piano', tile: 'Piano', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 1), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c51_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_6_1', name: '☁️ (6,1) Clouds', collapsed: true,
                        rules: [
                            { id: 'c61_cloud', name: 'Cloud', tile: 'Cloud', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 1), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_7_1', name: '🏜️ (7,1) Sand', collapsed: true,
                        rules: [
                            { id: 'c71_sand', name: 'Sand', tile: 'Sand', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 1), isSolid] } }
                        ]
                    },
                    
                    // ===================
                    // ROW 2
                    // ===================
                    {
                        type: 'group', id: 'grp_0_2', name: '🎚️ (0,2) Pillar Switches', collapsed: true,
                        rules: [
                            { id: 'c02_on', name: 'On', tile: 'Pillar_Switch_On', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 2), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c02_off', name: 'Off', tile: 'Pillar_Switch_Off', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 2), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 5 }
                                ] } },
                            { id: 'c02_mech', name: 'Mechanical', tile: 'Mechanical_Tile', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_1_2', name: '🧩 (1,2) Puzzle', collapsed: true,
                        rules: [
                            { id: 'c12_puzzle', name: 'Puzzle Wall', tile: 'Brick_Wall_Puzzle', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_2_2', name: '🧱 (2,2) Mixed Terrain', collapsed: true,
                        rules: [
                            { id: 'c22_grass', name: 'Grass', tile: 'Dirt_Grass', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 2), isSolid, aboveIsAir] } },
                            { id: 'c22_bricks', name: 'Dirt Bricks', tile: 'Dirt_Bricks', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 2), isSolid,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.6 }
                                ] } },
                            { id: 'c22_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_3_2', name: '☄️ (3,2) Meteor', collapsed: true,
                        rules: [
                            { id: 'c32_meteor', name: 'Meteor Rock', tile: 'Meteor_Rock', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_4_2', name: '🟢 (4,2) Slime', collapsed: true,
                        rules: [
                            { id: 'c42_slime', name: 'Slime', tile: 'Slime', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_5_2', name: '🏺 (5,2) Carving Variety', collapsed: true,
                        rules: [
                            { id: 'c52_c1', name: 'Carving 1', tile: 'Stone_Carving_1', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 2), isAir,
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.9 },
                                    { type: 'compare', value: 'detail_noise', op: '<', threshold: 0.4 }
                                ] } },
                            { id: 'c52_c2', name: 'Carving 2', tile: 'Stone_Carving_2', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 2), isAir,
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.9 },
                                    { type: 'compare', value: 'detail_noise', op: 'between', min: 0.4, max: 0.7 }
                                ] } },
                            { id: 'c52_c3', name: 'Carving 3', tile: 'Stone_Carving_3', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 2), isAir,
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.9 },
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.7 }
                                ] } },
                            { id: 'c52_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_6_2', name: '🖼️ (6,2) BG Decor', collapsed: true,
                        rules: [
                            { id: 'c62_bg', name: 'BG Brick', tile: 'BG_Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 2), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.5 }
                                ] } },
                            { id: 'c62_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 2), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_7_2', name: '🌫️ (7,2) Far BG', collapsed: true,
                        rules: [
                            { id: 'c72_farbg', name: 'Far BG Brick', tile: 'Far_BG_Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 2), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.4 }
                                ] } },
                            { id: 'c72_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 2), isSolid] } }
                        ]
                    },
                    
                    // ===================
                    // ROW 3 - BG Decorations
                    // ===================
                    {
                        type: 'group', id: 'grp_0_3', name: '🧱 (0,3) BG Brick Fence', collapsed: true,
                        rules: [
                            { id: 'c03_fence', name: 'BG Fence', tile: 'BG_Brick_Fence', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 3), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.5 }
                                ] } },
                            { id: 'c03_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_1_3', name: '🏛️ (1,3) BG Brick Pillar', collapsed: true,
                        rules: [
                            { id: 'c13_bgpillar', name: 'BG Pillar', tile: 'BG_Brick_Pillar', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 3), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 4 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c13_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_2_3', name: '☄️ (2,3) BG Meteor', collapsed: true,
                        rules: [
                            { id: 'c23_bgmet', name: 'BG Meteor', tile: 'BG_Meteor', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 3), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.45 }
                                ] } },
                            { id: 'c23_meteor', name: 'Meteor', tile: 'Meteor_Rock', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_3_3', name: '🏜️ (3,3) BG Sand', collapsed: true,
                        rules: [
                            { id: 'c33_bgsand', name: 'BG Sand', tile: 'BG_Sand', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 3), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.4 }
                                ] } },
                            { id: 'c33_sand', name: 'Sand', tile: 'Sand', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_4_3', name: '🌿 (4,3) BG Thorns', collapsed: true,
                        rules: [
                            { id: 'c43_bgthorn', name: 'BG Thorns', tile: 'BG_Thorns', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 3), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.5 }
                                ] } },
                            { id: 'c43_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_5_3', name: '🖼️ (5,3) Far BG Fence', collapsed: true,
                        rules: [
                            { id: 'c53_farfence', name: 'Far BG Fence', tile: 'Far_BG_Brick_Fence', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 3), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.45 }
                                ] } },
                            { id: 'c53_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_6_3', name: '🏛️ (6,3) Far BG Pillar', collapsed: true,
                        rules: [
                            { id: 'c63_farpillar', name: 'Far BG Pillar', tile: 'Far_BG_Brick_Pillar', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 3), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c63_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 3), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_7_3', name: '🌫️ (7,3) Far BG Meteor', collapsed: true,
                        rules: [
                            { id: 'c73_farmet', name: 'Far BG Meteor', tile: 'Far_BG_Meteor', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 3), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.4 }
                                ] } },
                            { id: 'c73_meteor', name: 'Meteor', tile: 'Meteor_Rock', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 3), isSolid] } }
                        ]
                    },
                    
                    // ===================
                    // ROW 4 - More BG & Combos
                    // ===================
                    {
                        type: 'group', id: 'grp_0_4', name: '🏜️ (0,4) Far BG Sand', collapsed: true,
                        rules: [
                            { id: 'c04_farsand', name: 'Far BG Sand', tile: 'Far_BG_Sand', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 4), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.35 }
                                ] } },
                            { id: 'c04_sand', name: 'Sand', tile: 'Sand', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(0, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_1_4', name: '🌿 (1,4) Far BG Thorns', collapsed: true,
                        rules: [
                            { id: 'c14_farthorn', name: 'Far BG Thorns', tile: 'Far_BG_Thorns', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 4), isAir,
                                    { type: 'compare', value: 'detail_noise', op: '>=', threshold: 0.4 }
                                ] } },
                            { id: 'c14_dirt', name: 'Dirt', tile: 'Dirt', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(1, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_2_4', name: '🔌 (2,4) Power + Switch', collapsed: true,
                        rules: [
                            { id: 'c24_power', name: 'Power', tile: 'Big_Power_Block', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c24_sw', name: 'Switch', tile: 'Pillar_Switch_Button_On', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 4), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 1 }
                                ] } },
                            { id: 'c24_elec', name: 'Electric', tile: 'Electric_Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(2, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_3_4', name: '🎛️ (3,4) Switch Buttons', collapsed: true,
                        rules: [
                            { id: 'c34_on', name: 'Button On', tile: 'Pillar_Switch_Button_On', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 4), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 1 }
                                ] } },
                            { id: 'c34_off', name: 'Button Off', tile: 'Pillar_Switch_Button_Off', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 4), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 4 }
                                ] } },
                            { id: 'c34_mech', name: 'Mechanical', tile: 'Mechanical_Tile', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(3, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_4_4', name: '🪜 (4,4) Ladder + Platform', collapsed: true,
                        rules: [
                            { id: 'c44_ladder', name: 'Ladder', tile: 'Ladder', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c44_plat', name: 'Platform', tile: 'Platform', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 4), isAir,
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c44_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(4, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_5_4', name: '📶 (5,4) Full Staircase', collapsed: true,
                        rules: [
                            { id: 'c54_stl', name: 'Stair TL', tile: 'Stair_Top_Left', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 2 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c54_str', name: 'Stair TR', tile: 'Stair_Top_Right', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c54_sbl', name: 'Stair BL', tile: 'Stair_Bottom_Left', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 2 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c54_sbr', name: 'Stair BR', tile: 'Stair_Bottom_Right', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 }
                                ] } },
                            { id: 'c54_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(5, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_6_4', name: '🗿 (6,4) All Carvings', collapsed: true,
                        rules: [
                            { id: 'c64_c1', name: 'Carving 1', tile: 'Stone_Carving_1', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 1 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c64_c2', name: 'Carving 2', tile: 'Stone_Carving_2', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 3 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c64_c3', name: 'Carving 3', tile: 'Stone_Carving_3', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 4), isAir,
                                    { type: 'compare', value: 'x_tile', modifiers: [{ op: '%', arg: 6 }], op: '==', threshold: 5 },
                                    { type: 'compare', value: 'y_tile', modifiers: [{ op: '%', arg: 5 }], op: '==', threshold: 2 }
                                ] } },
                            { id: 'c64_brick', name: 'Brick', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(6, 4), isSolid] } }
                        ]
                    },
                    {
                        type: 'group', id: 'grp_7_4', name: '🎲 (7,4) Random Mix', collapsed: true,
                        rules: [
                            { id: 'c74_smile', name: 'Smile', tile: 'Smile_Block', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 4), isAir,
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.9 }
                                ] } },
                            { id: 'c74_melon', name: 'Melon', tile: 'Melon', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 4), isAir,
                                    { type: 'compare', value: 'below_is_air', op: '==', threshold: 0 },
                                    { type: 'compare', value: 'random', op: '>=', threshold: 0.6 }
                                ] } },
                            { id: 'c74_mix', name: 'Mixed', tile: 'Brick', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 4), isSolid,
                                    { type: 'compare', value: 'detail_noise', op: '<', threshold: 0.5 }
                                ] } },
                            { id: 'c74_mix2', name: 'Mixed 2', tile: 'Dirt_Bricks', layer: 'fg',
                                conditions: { type: 'AND', conditions: [...inCell(7, 4), isSolid] } }
                        ]
                    },
                    
                    // ===================
                    // BACKGROUND
                    // ===================
                    {
                        type: 'group', id: 'grp_bg', name: '⬛ Background', collapsed: true,
                        rules: [
                            { id: 'zoo_bg', name: 'Black', tile: 'Black', layer: 'bg',
                                conditions: { type: 'AND', conditions: [] } }
                        ]
                    }
                ]
            }
        };
        this.biomeOrder = ['zoo_grid'];
        this.corridorConfig = JSON.parse(JSON.stringify(this.defaults.corridorConfig));
        this.corridorTileRules = JSON.parse(JSON.stringify(this.defaults.corridorTileRules));
        this.rulesLoaded = true;
        this.currentRuleSet = 'Generation Zoo';
        console.log('Loaded Generation Zoo: Terraria-style exhibits (grouped)');
    },
    
    /**
     * Clear all rules (empty state)
     */
    clearRules() {
        this.biomes = {};
        this.biomeOrder = [];
        this.corridorConfig = { width: 3, noiseAmplitude: 4, widthVariation: 2, caveDistance: 12, caveRoughness: 4 };
        this.corridorTileRules = [];
        this.rulesLoaded = false;
        this.currentRuleSet = null;
        console.log('BiomeData cleared');
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
    // AIDEV-NOTE: tileRules can contain:
    //   - Regular rules: { id, name, tile, layer, conditions }
    //   - Groups: { type: 'group', id, name, collapsed, rules: [...] }
    // Groups are flattened for evaluation but displayed collapsed in UI
    
    /**
     * Get flattened tile rules for evaluation (expands groups)
     */
    getBiomeTileRules(biomeId) {
        const biome = this.biomes[biomeId];
        if (!biome) return [];
        return this.flattenRules(biome.tileRules || []);
    },
    
    /**
     * Get raw tile rules including groups (for UI display)
     */
    getBiomeTileRulesRaw(biomeId) {
        return this.biomes[biomeId]?.tileRules || [];
    },
    
    /**
     * Flatten rules array (expand groups into individual rules)
     */
    flattenRules(rules) {
        const result = [];
        for (const item of rules) {
            if (item.type === 'group') {
                result.push(...(item.rules || []));
            } else {
                result.push(item);
            }
        }
        return result;
    },
    
    /**
     * Find a rule by ID (searches inside groups too)
     */
    getBiomeTileRule(biomeId, ruleId) {
        const biome = this.biomes[biomeId];
        if (!biome) return null;
        
        for (const item of biome.tileRules) {
            if (item.type === 'group') {
                const found = item.rules?.find(r => r.id === ruleId);
                if (found) return found;
            } else if (item.id === ruleId) {
                return item;
            }
        }
        return null;
    },
    
    /**
     * Find which group a rule belongs to (returns null if ungrouped)
     */
    findRuleGroup(biomeId, ruleId) {
        const biome = this.biomes[biomeId];
        if (!biome) return null;
        
        for (const item of biome.tileRules) {
            if (item.type === 'group') {
                if (item.rules?.some(r => r.id === ruleId)) {
                    return item;
                }
            }
        }
        return null;
    },
    
    /**
     * Add a rule (optionally to a group)
     */
    addBiomeTileRule(biomeId, rule, groupId = null) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        
        if (groupId) {
            const group = biome.tileRules.find(g => g.type === 'group' && g.id === groupId);
            if (group) {
                group.rules = group.rules || [];
                group.rules.push(rule);
                return;
            }
        }
        biome.tileRules.push(rule);
    },
    
    /**
     * Update a rule (searches inside groups)
     */
    updateBiomeTileRule(biomeId, ruleId, updates) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        
        for (let i = 0; i < biome.tileRules.length; i++) {
            const item = biome.tileRules[i];
            if (item.type === 'group') {
                const idx = item.rules?.findIndex(r => r.id === ruleId) ?? -1;
                if (idx >= 0) {
                    item.rules[idx] = { ...item.rules[idx], ...updates };
                    return;
                }
            } else if (item.id === ruleId) {
                biome.tileRules[i] = { ...item, ...updates };
                return;
            }
        }
    },
    
    /**
     * Remove a rule (searches inside groups)
     */
    removeBiomeTileRule(biomeId, ruleId) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        
        for (let i = 0; i < biome.tileRules.length; i++) {
            const item = biome.tileRules[i];
            if (item.type === 'group') {
                const idx = item.rules?.findIndex(r => r.id === ruleId) ?? -1;
                if (idx >= 0) {
                    item.rules.splice(idx, 1);
                    return;
                }
            } else if (item.id === ruleId) {
                biome.tileRules.splice(i, 1);
                return;
            }
        }
    },
    
    /**
     * Move a tile rule up or down in the order
     */
    moveBiomeTileRule(biomeId, ruleId, direction) {
        const biome = this.biomes[biomeId];
        if (!biome) return false;
        
        // Check if rule is in a group
        for (const item of biome.tileRules) {
            if (item.type === 'group' && item.rules) {
                const idx = item.rules.findIndex(r => r.id === ruleId);
                if (idx >= 0) {
                    const newIdx = idx + direction;
                    if (newIdx < 0 || newIdx >= item.rules.length) return false;
                    const temp = item.rules[idx];
                    item.rules[idx] = item.rules[newIdx];
                    item.rules[newIdx] = temp;
                    return true;
                }
            }
        }
        
        // Check top-level rules
        const index = biome.tileRules.findIndex(r => r.id === ruleId);
        if (index < 0) return false;
        
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= biome.tileRules.length) return false;
        
        const temp = biome.tileRules[index];
        biome.tileRules[index] = biome.tileRules[newIndex];
        biome.tileRules[newIndex] = temp;
        return true;
    },
    
    // =====================
    // GROUP API
    // =====================
    
    /**
     * Add a new group
     */
    addGroup(biomeId, group) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        
        biome.tileRules.push({
            type: 'group',
            id: group.id || 'group_' + Date.now(),
            name: group.name || 'New Group',
            collapsed: group.collapsed ?? true,
            rules: group.rules || []
        });
    },
    
    /**
     * Get a group by ID
     */
    getGroup(biomeId, groupId) {
        const biome = this.biomes[biomeId];
        if (!biome) return null;
        return biome.tileRules.find(g => g.type === 'group' && g.id === groupId) || null;
    },
    
    /**
     * Update a group's properties (name, collapsed)
     */
    updateGroup(biomeId, groupId, updates) {
        const group = this.getGroup(biomeId, groupId);
        if (group) {
            if (updates.name !== undefined) group.name = updates.name;
            if (updates.collapsed !== undefined) group.collapsed = updates.collapsed;
        }
    },
    
    /**
     * Delete a group
     * @param {boolean} deleteRules - If true, delete all rules in group. If false, move them out.
     */
    removeGroup(biomeId, groupId, deleteRules = false) {
        const biome = this.biomes[biomeId];
        if (!biome) return;
        
        const idx = biome.tileRules.findIndex(g => g.type === 'group' && g.id === groupId);
        if (idx < 0) return;
        
        const group = biome.tileRules[idx];
        
        if (!deleteRules && group.rules?.length > 0) {
            // Move rules out of group (insert after group position)
            biome.tileRules.splice(idx, 1, ...group.rules);
        } else {
            // Just delete the group (and its rules)
            biome.tileRules.splice(idx, 1);
        }
    },
    
    /**
     * Move a rule into a group
     */
    moveRuleToGroup(biomeId, ruleId, groupId) {
        const biome = this.biomes[biomeId];
        if (!biome) return false;
        
        // Find and remove the rule from its current location
        let rule = null;
        
        for (let i = 0; i < biome.tileRules.length; i++) {
            const item = biome.tileRules[i];
            if (item.type === 'group') {
                const idx = item.rules?.findIndex(r => r.id === ruleId) ?? -1;
                if (idx >= 0) {
                    rule = item.rules.splice(idx, 1)[0];
                    break;
                }
            } else if (item.id === ruleId) {
                rule = biome.tileRules.splice(i, 1)[0];
                break;
            }
        }
        
        if (!rule) return false;
        
        // Add to target group
        const group = this.getGroup(biomeId, groupId);
        if (group) {
            group.rules = group.rules || [];
            group.rules.push(rule);
            return true;
        }
        
        // If group not found, put rule back at top level
        biome.tileRules.push(rule);
        return false;
    },
    
    /**
     * Move a rule out of its group to top level
     */
    moveRuleOutOfGroup(biomeId, ruleId) {
        const biome = this.biomes[biomeId];
        if (!biome) return false;
        
        for (const item of biome.tileRules) {
            if (item.type === 'group' && item.rules) {
                const idx = item.rules.findIndex(r => r.id === ruleId);
                if (idx >= 0) {
                    const rule = item.rules.splice(idx, 1)[0];
                    biome.tileRules.push(rule);
                    return true;
                }
            }
        }
        return false;
    },
    
    /**
     * Move a group up or down
     */
    moveGroup(biomeId, groupId, direction) {
        const biome = this.biomes[biomeId];
        if (!biome) return false;
        
        const idx = biome.tileRules.findIndex(g => g.type === 'group' && g.id === groupId);
        if (idx < 0) return false;
        
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= biome.tileRules.length) return false;
        
        const temp = biome.tileRules[idx];
        biome.tileRules[idx] = biome.tileRules[newIdx];
        biome.tileRules[newIdx] = temp;
        return true;
    },
    
    // =====================
    // CORRIDOR RULES API
    // =====================
    
    /**
     * Get corridor configuration
     */
    getCorridorConfig() {
        return this.corridorConfig;
    },
    
    /**
     * Update corridor configuration
     */
    updateCorridorConfig(updates) {
        this.corridorConfig = { ...this.corridorConfig, ...updates };
    },
    
    /**
     * Get all corridor tile rules
     */
    getCorridorTileRules() {
        return this.corridorTileRules;
    },
    
    /**
     * Get corridor tile rules by layer ('wall' or 'bg')
     */
    getCorridorTileRulesByLayer(layer) {
        return this.corridorTileRules.filter(r => r.layer === layer);
    },
    
    /**
     * Get a corridor tile rule by ID
     */
    getCorridorTileRule(ruleId) {
        return this.corridorTileRules.find(r => r.id === ruleId) || null;
    },
    
    /**
     * Add a corridor tile rule
     */
    addCorridorTileRule(rule) {
        this.corridorTileRules.push(rule);
    },
    
    /**
     * Update a corridor tile rule
     */
    updateCorridorTileRule(ruleId, updates) {
        const idx = this.corridorTileRules.findIndex(r => r.id === ruleId);
        if (idx >= 0) {
            this.corridorTileRules[idx] = { ...this.corridorTileRules[idx], ...updates };
        }
    },
    
    /**
     * Remove a corridor tile rule
     */
    removeCorridorTileRule(ruleId) {
        const idx = this.corridorTileRules.findIndex(r => r.id === ruleId);
        if (idx >= 0) {
            this.corridorTileRules.splice(idx, 1);
        }
    },
    
    /**
     * Move a corridor tile rule up or down
     */
    moveCorridorTileRule(ruleId, direction) {
        const idx = this.corridorTileRules.findIndex(r => r.id === ruleId);
        if (idx < 0) return false;
        
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= this.corridorTileRules.length) return false;
        
        const temp = this.corridorTileRules[idx];
        this.corridorTileRules[idx] = this.corridorTileRules[newIdx];
        this.corridorTileRules[newIdx] = temp;
        return true;
    },
    
    /**
     * Evaluate corridor tile rules to select a tile
     * @param {string} layer - 'wall' or 'bg'
     * @param {Object} context - Context values (corridor_t, x_tile, y_tile, etc.)
     * @returns {number} Tile index or -1
     */
    selectCorridorTile(layer, context) {
        const rules = this.getCorridorTileRulesByLayer(layer);
        
        for (const rule of rules) {
            if (this.evaluateConditions(rule.conditions, context)) {
                const tileKey = rule.tile.replace(/ /g, '_');
                return TileAtlas.Tiles[tileKey] ?? -1;
            }
        }
        
        // Default fallbacks
        if (layer === 'wall') {
            return TileAtlas.Tiles.Brick ?? 0;
        } else {
            return TileAtlas.Tiles.Black ?? 17;
        }
    },
    
    // =====================
    // PERSISTENCE
    // =====================
    
    reset() {
        this.loadDefaultDungeon();
    },
    
    exportJSON() {
        return JSON.stringify({
            biomeOrder: this.biomeOrder,
            biomes: this.biomes,
            corridorConfig: this.corridorConfig,
            corridorTileRules: this.corridorTileRules
        }, null, 2);
    },
    
    importJSON(json, ruleSetName = 'Imported') {
        try {
            const data = JSON.parse(json);
            if (data.biomes) this.biomes = data.biomes;
            if (data.biomeOrder) {
                this.biomeOrder = data.biomeOrder;
            } else {
                // Fallback for old format
                this.biomeOrder = Object.keys(this.biomes);
            }
            // Load corridor data or use defaults
            if (data.corridorConfig) {
                this.corridorConfig = data.corridorConfig;
            } else {
                this.corridorConfig = JSON.parse(JSON.stringify(this.defaults.corridorConfig));
            }
            if (data.corridorTileRules) {
                this.corridorTileRules = data.corridorTileRules;
            } else {
                this.corridorTileRules = JSON.parse(JSON.stringify(this.defaults.corridorTileRules));
            }
            this.rulesLoaded = true;
            this.currentRuleSet = ruleSetName;
            console.log(`Imported: ${Object.keys(this.biomes).length} biomes, ${this.corridorTileRules.length} corridor rules`);
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
