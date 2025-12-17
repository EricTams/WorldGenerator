// AIDEV-NOTE: Tile Palette for WorldGenerator
// Displays all 48 tiles organized by category for drag-and-drop assignment

const TilePalette = {
    // DOM reference
    containerEl: null,
    
    // Currently selected tile
    selectedTile: null,
    
    // Callback for tile selection
    onTileSelect: null,
    
    /**
     * Initialize tile palette
     * @param {string} containerId
     */
    init(containerId) {
        this.containerEl = document.getElementById(containerId);
        if (this.containerEl) {
            this.render();
        }
        console.log('TilePalette initialized');
    },
    
    /**
     * Render the tile palette
     */
    render() {
        if (!this.containerEl) return;
        
        this.containerEl.innerHTML = '';
        
        // Get tiles by category
        const categories = ['TERRAIN', 'DUNGEON', 'MECHANICAL', 'SPECIAL', 'BG', 'FAR_BG'];
        
        for (const category of categories) {
            const tiles = TileAtlas.getTilesByCategory(category);
            if (tiles.length === 0) continue;
            
            // Category label
            const label = document.createElement('div');
            label.className = 'tile-category';
            label.textContent = category.replace('_', ' ');
            this.containerEl.appendChild(label);
            
            // Tiles
            for (const tile of tiles) {
                const tileEl = this.createTileElement(tile);
                this.containerEl.appendChild(tileEl);
            }
        }
    },
    
    /**
     * Create a tile element
     * @param {Object} tile
     * @returns {HTMLElement}
     */
    createTileElement(tile) {
        const el = document.createElement('div');
        el.className = 'tile-palette-item';
        el.title = tile.name;
        el.dataset.tileIndex = tile.index;
        el.dataset.tileName = tile.name.replace(/ /g, '_');
        
        // Set background to show tile from atlas
        const uv = TileAtlas.getUV(tile.index);
        const atlasSize = TileAtlas.ATLAS_SIZE;
        const tileSize = TileAtlas.TILE_SIZE;
        
        // Calculate background position and size
        const bgX = -tile.col * tileSize * 2; // 2x scale for 32px display
        const bgY = -tile.row * tileSize * 2;
        const bgSize = atlasSize * 2;
        
        el.style.backgroundImage = 'url(assets/tiles/atlas.png)';
        el.style.backgroundPosition = `${bgX}px ${bgY}px`;
        el.style.backgroundSize = `${bgSize}px ${bgSize}px`;
        
        // Make draggable
        el.draggable = true;
        el.addEventListener('dragstart', (e) => this.onDragStart(e, tile));
        el.addEventListener('dragend', (e) => this.onDragEnd(e));
        
        // Click to select
        el.addEventListener('click', () => this.selectTile(tile));
        
        return el;
    },
    
    /**
     * Handle drag start
     * @param {DragEvent} e
     * @param {Object} tile
     */
    onDragStart(e, tile) {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'tile',
            tile: tile
        }));
        e.target.classList.add('dragging');
    },
    
    /**
     * Handle drag end
     * @param {DragEvent} e
     */
    onDragEnd(e) {
        e.target.classList.remove('dragging');
    },
    
    /**
     * Select a tile
     * @param {Object} tile
     */
    selectTile(tile) {
        // Update selection visual
        const items = this.containerEl.querySelectorAll('.tile-palette-item');
        items.forEach(item => item.classList.remove('selected'));
        
        const selectedEl = this.containerEl.querySelector(`[data-tile-index="${tile.index}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
        
        this.selectedTile = tile;
        
        // Trigger callback
        if (this.onTileSelect) {
            this.onTileSelect(tile);
        }
    },
    
    /**
     * Set tile selection callback
     * @param {Function} callback
     */
    setOnTileSelect(callback) {
        this.onTileSelect = callback;
    },
    
    /**
     * Get selected tile
     * @returns {Object|null}
     */
    getSelectedTile() {
        return this.selectedTile;
    }
};

