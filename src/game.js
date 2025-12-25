// AIDEV-NOTE: Main Game Controller for WorldGenerator
// Orchestrates all game systems and initializes the application

const Game = {
    // Core systems
    renderer: null,
    world: null,
    player: null,
    camera: null,
    
    // Editor systems
    roomEditor: null,
    tilePalette: null,
    persistence: null,
    
    // State
    initialized: false,
    seed: Math.floor(Math.random() * 100000),  // Random seed on startup
    roomCount: 20,
    showBiomes: false,
    noiseOverlay: null, // which noise to visualize (null = off, 'dynamic' = follow hover)
    
    // Dynamic overlay state (when noiseOverlay === 'dynamic')
    // AIDEV-NOTE: Uses unified modifier chain - modifiers applied in order
    dynamicOverlay: {
        value: null,       // e.g., 'cave_noise'
        modifiers: []      // e.g., [{ op: 'xScale', arg: 3 }, { op: '^', arg: 2 }]
    },
    
    /**
     * Initialize the game
     */
    async init() {
        console.log('=== WorldGenerator Initializing ===');
        
        try {
            // Initialize renderer (WebGL)
            this.renderer = Renderer;
            await this.renderer.init('game-canvas');
            
            // Initialize camera
            this.camera = Camera;
            this.camera.init(this.renderer.width, this.renderer.height);
            
            // Initialize input
            Input.init(this.renderer.canvas);
            
            // Initialize player
            this.player = Player;
            this.player.init(0, 0);
            
            // Initialize biome data (empty state - no rules loaded yet)
            BiomeData.init();
            
            // Initialize world (empty until rules are loaded)
            this.world = World;
            this.world.create({ tiles: [], bgTiles: [], biomeMap: [], spawnPoint: { x: 0, y: 0 } });
            
            // Set initial player position to spawn point
            if (this.world.spawnPoint) {
                this.player.setPosition(this.world.spawnPoint.x, this.world.spawnPoint.y);
            }
            
            // Snap camera to player on initial load
            this.camera.setTarget(this.player.x, this.player.y);
            this.camera.snapToTarget();
            
            // Initialize editor systems
            await this.initEditor();
            
            // Set up UI event handlers
            this.setupUI();
            
            // Initialize game loop
            GameLoop.init(
                (dt) => this.update(dt),
                (dt) => this.render(dt)
            );
            
            // Start the loop
            GameLoop.start();
            
            this.initialized = true;
            console.log('=== WorldGenerator Ready ===');
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            throw error;
        }
    },
    
    /**
     * Initialize editor systems
     */
    async initEditor() {
        // Initialize persistence (load saved data)
        Persistence.init();
        
        // Initialize tile palette
        TilePalette.init('tile-palette');
        
        // Initialize room templates system (auto-loads from localStorage)
        RoomTemplates.init();
        
        // Initialize room upload modal
        await RoomUpload.init();
        
        // Initialize biome editor (used for both Noise and Hub modes)
        BiomeEditor.init();
        
        // Initialize block system
        BlockSystem.init('block-palette', 'block-workspace');
    },
    
    /**
     * Set up UI event handlers
     */
    setupUI() {
        // Regenerate button
        const btnRegenerate = document.getElementById('btn-regenerate');
        if (btnRegenerate) {
            btnRegenerate.addEventListener('click', () => this.regenerate());
        }
        
        // Seed input
        const seedInput = document.getElementById('seed-input');
        if (seedInput) {
            seedInput.value = this.seed;
            seedInput.addEventListener('change', (e) => {
                this.seed = parseInt(e.target.value) || Math.floor(Math.random() * 100000);
            });
        }
        
        // Room count input
        const roomCountInput = document.getElementById('room-count');
        if (roomCountInput) {
            roomCountInput.value = this.roomCount;
            roomCountInput.addEventListener('change', (e) => {
                this.roomCount = Math.max(5, Math.min(100, parseInt(e.target.value) || 20));
            });
        }
        
        // Toggle editor button
        const btnToggle = document.getElementById('btn-toggle-editor');
        const editorPanel = document.getElementById('editor-panel');
        if (btnToggle && editorPanel) {
            btnToggle.addEventListener('click', () => {
                const isCollapsed = editorPanel.classList.toggle('collapsed');
                btnToggle.classList.toggle('panel-closed', isCollapsed);
                btnToggle.textContent = isCollapsed ? '◀' : '▶';
            });
        }
        
        // Save/Export buttons
        document.getElementById('btn-save')?.addEventListener('click', () => Persistence.save());
        document.getElementById('btn-export')?.addEventListener('click', () => Persistence.exportJSON());
        
        // File input for import (used by both rule loader and editor)
        document.getElementById('import-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                Persistence.importJSON(file);
                e.target.value = ''; // Reset for next import
                // Update editor visibility after import
                if (typeof BiomeEditor !== 'undefined') {
                    BiomeEditor.onRulesLoaded();
                }
            }
        });
        
        // Add biome button
        document.getElementById('btn-add-biome')?.addEventListener('click', () => {
            BiomeEditor.addNewBiome();
        });
        
        // Add tile rule button
        document.getElementById('btn-add-tile-rule')?.addEventListener('click', () => {
            BiomeEditor.addNewTileRule();
        });
        
        // Add group button
        document.getElementById('btn-add-group')?.addEventListener('click', () => {
            BiomeEditor.addNewGroup();
        });
        
        // Biome overlay toggle
        const btnBiomeOverlay = document.getElementById('btn-biome-overlay');
        if (btnBiomeOverlay) {
            btnBiomeOverlay.addEventListener('click', () => {
                this.showBiomes = !this.showBiomes;
                btnBiomeOverlay.classList.toggle('btn-overlay-active', this.showBiomes);
                // Turn off noise overlay when biome overlay is on
                if (this.showBiomes) {
                    this.noiseOverlay = null;
                    document.getElementById('noise-overlay-select').value = '';
                }
            });
        }
        
        // Noise overlay dropdown
        const noiseSelect = document.getElementById('noise-overlay-select');
        if (noiseSelect) {
            noiseSelect.addEventListener('change', (e) => {
                this.noiseOverlay = e.target.value || null;
                // Turn off biome overlay when noise overlay is on
                if (this.noiseOverlay) {
                    this.showBiomes = false;
                    btnBiomeOverlay?.classList.remove('btn-overlay-active');
                }
            });
        }
        
        // Generation mode selector
        const genModeSelect = document.getElementById('gen-mode-select');
        if (genModeSelect) {
            genModeSelect.value = Dungeon.generationMode;
            genModeSelect.addEventListener('change', (e) => {
                Dungeon.generationMode = e.target.value;
                console.log(`Generation mode set to: ${Dungeon.generationMode}`);
            });
        }
        
        // Room upload button
        const btnUploadRoom = document.getElementById('btn-upload-room');
        if (btnUploadRoom) {
            btnUploadRoom.addEventListener('click', () => {
                RoomUpload.show();
            });
        }
    },
    
    /**
     * Regenerate the dungeon
     * AIDEV-NOTE: Does NOT touch the camera or player - they are managed independently
     * This allows live preview of rule changes without jumping around
     */
    regenerate() {
        // Both modes use BiomeData rules for tile selection
        if (!BiomeData.rulesLoaded) {
            console.log('No rules loaded - creating empty world');
            this.world.create({ tiles: [], bgTiles: [], biomeMap: [], spawnPoint: { x: 0, y: 0 } });
            return;
        }
        
        // Hub & Spokes mode also needs room templates
        if (Dungeon.generationMode === 'hub') {
            const templates = RoomTemplates.getAllTemplates();
            if (templates.length === 0) {
                // AIDEV-NOTE: Gracefully fall back to noise mode instead of blocking
                console.log('No room templates loaded - falling back to Noise generation');
                console.log('Upload rooms via "📁 Rooms" button to use Hub & Spokes mode');
                Dungeon.generationMode = 'noise';
                // Continue to noise generation below
            } else {
                console.log(`Regenerating Hub & Spokes with seed ${this.seed}, ${templates.length} templates`);
                const dungeonData = Dungeon.generate(this.seed);
                this.world.create(dungeonData);
                // AIDEV-NOTE: Don't move camera on regenerate - preserves view during live preview
                return;
            }
        }
        
        console.log(`Regenerating dungeon with seed ${this.seed}, ${this.roomCount} rooms`);
        
        // Generate new dungeon
        const dungeonData = Dungeon.generate(this.seed);
        
        // Create world from dungeon data
        this.world.create(dungeonData);
    },
    
    /**
     * Update game state
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update player (reads input)
        this.player.update(dt, Input);
        
        // Update camera to follow player (reads input for zoom)
        this.camera.setTarget(this.player.x, this.player.y);
        this.camera.update(dt);
        
        // Update status bar
        this.updateStatusBar();
        
        // Clear one-frame input states AFTER everything has processed them
        // AIDEV-NOTE: This must be last - keysPressed/wheel are cleared here
        Input.update();
    },
    
    /**
     * Render the game
     * @param {number} dt - Delta time in seconds
     */
    render(dt) {
        // Clear and render world
        this.renderer.clear();
        this.renderer.renderWorld(this.world, this.camera);
        this.renderer.renderPlayer(this.player, this.camera);
        
        // Render overlay (biome or noise visualization)
        this.renderer.renderOverlay(this.world, this.camera, this.showBiomes, this.noiseOverlay);
    },
    
    /**
     * Update status bar information
     */
    updateStatusBar() {
        // Coordinates
        const coordsEl = document.getElementById('status-coords');
        if (coordsEl) {
            coordsEl.textContent = `X: ${Math.floor(this.player.x)}, Y: ${Math.floor(this.player.y)}`;
        }
        
        // Tile under player
        const tileEl = document.getElementById('status-tile');
        if (tileEl && this.world) {
            const tileX = Math.floor(this.player.x / 16);
            const tileY = Math.floor(this.player.y / 16);
            const tile = this.world.getTile(tileX, tileY);
            if (tile !== null && tile >= 0) {
                const tileData = TileAtlas.TileData[tile];
                tileEl.textContent = `Tile: ${tileData?.name || tile}`;
            } else {
                tileEl.textContent = 'Tile: Air';
            }
        }
        
        // Biome at player position
        const biomeEl = document.getElementById('status-biome');
        if (biomeEl && this.world) {
            const tileX = Math.floor(this.player.x / 16);
            const tileY = Math.floor(this.player.y / 16);
            const biomeId = this.world.getBiomeAt(tileX, tileY);
            const biome = biomeId ? BiomeData.getBiome(biomeId) : null;
            biomeEl.textContent = `Biome: ${biome?.name || '-'}`;
        }
        
        // Dynamic overlay indicator
        const overlayEl = document.getElementById('status-overlay');
        if (overlayEl) {
            if (this.noiseOverlay === 'dynamic' && this.dynamicOverlay.value) {
                let label = this.dynamicOverlay.value;
                // Show modifier chain
                const mods = this.dynamicOverlay.modifiers || [];
                if (mods.length > 0) {
                    const modStr = mods.map(m => `${m.op}${m.arg ?? ''}`).join(' ');
                    label += ` → ${modStr}`;
                }
                overlayEl.textContent = `🔍 ${label}`;
                overlayEl.style.display = '';
            } else {
                overlayEl.style.display = 'none';
            }
        }
        
        // FPS
        const fpsEl = document.getElementById('status-fps');
        if (fpsEl) {
            fpsEl.textContent = `FPS: ${GameLoop.getFPS()}`;
        }
    },
    
    /**
     * Navigate to a specific cell in the Generation Zoo
     * AIDEV-NOTE: Helper for testing - call from browser console: Game.goToCell(6, 1)
     * @param {number} col - Cell column (0-7)
     * @param {number} row - Cell row (0-7)
     */
    goToCell(col, row) {
        const CELL_SIZE = 16; // tiles per cell
        const TILE_SIZE = 16; // pixels per tile
        const x = col * CELL_SIZE * TILE_SIZE + (CELL_SIZE * TILE_SIZE / 2);
        const y = row * CELL_SIZE * TILE_SIZE + (CELL_SIZE * TILE_SIZE / 2);
        this.player.x = x;
        this.player.y = y;
        this.camera.setTarget(x, y);
        this.camera.snapToTarget();
        console.log(`Moved to cell (${col}, ${row})`);
    }
};

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Game.init().catch(err => {
        console.error('Game initialization failed:', err);
        alert('Failed to initialize game. Check console for details.');
    });
});

