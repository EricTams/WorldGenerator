// AIDEV-NOTE: Biome Editor for WorldGenerator
// Each biome has spawn conditions (where it appears) + tile rules (what tiles to use)
// Uses inline editor for tile rules, modal for biome spawn conditions

const BiomeEditor = {
    // DOM references
    biomesListEl: null,
    tileRulesListEl: null,
    versionWarningEl: null,
    
    // Inline editor elements (for tile rules)
    editorEl: null,
    editorTitleEl: null,
    editorNameInput: null,
    editorTileSelect: null,
    editorLayerSelect: null,
    
    // Modal elements (for biome spawn conditions)
    modalEl: null,
    modalTitleEl: null,
    modalNameInput: null,
    modalTargetSection: null,
    modalTargetLabel: null,
    modalTargetSelect: null,
    modalLayerSection: null,
    modalLayerSelect: null,
    
    // Selection state
    selectedBiome: null,
    
    // Currently editing
    editingBiome: null,     // For biome modal
    editingTileRule: null,  // For inline tile rule editor
    editingType: null,      // 'biome' or 'tile'
    
    // AIDEV-NOTE: Live preview system
    // Debounces regeneration while editing rules
    previewTimer: null,
    PREVIEW_DELAY: 300, // ms delay before regenerating
    
    init() {
        // List elements
        this.biomesListEl = document.getElementById('biomes-list');
        this.tileRulesListEl = document.getElementById('tile-rules-list');
        
        // Sidebar sections (for hide/show during editing)
        this.headerEl = document.querySelector('.editor-header');
        this.biomesSectionEl = this.biomesListEl?.closest('.editor-section');
        this.tileRulesSectionEl = this.tileRulesListEl?.closest('.editor-section');
        
        // Create version warning + reset button container
        this.createVersionUI();
        
        // Inline editor elements
        this.editorEl = document.getElementById('rule-editor');
        this.editorTitleEl = document.getElementById('editor-title');
        this.editorNameInput = document.getElementById('editor-rule-name');
        this.editorTileSelect = document.getElementById('editor-tile-select');
        this.editorLayerSelect = document.getElementById('editor-layer-select');
        
        // Inline editor event handlers
        document.getElementById('btn-close-editor')?.addEventListener('click', () => this.closeEditor());
        document.getElementById('btn-delete-rule')?.addEventListener('click', () => this.deleteCurrentRule());
        
        // Live preview on inline editor changes
        this.editorNameInput?.addEventListener('input', () => this.onEditorChange());
        this.editorTileSelect?.addEventListener('change', () => this.onEditorChange());
        this.editorLayerSelect?.addEventListener('change', () => this.onEditorChange());
        
        // Modal elements (for biome editing)
        this.modalEl = document.getElementById('rule-modal');
        this.modalTitleEl = document.getElementById('modal-title');
        this.modalNameInput = document.getElementById('modal-rule-name');
        this.modalTargetSection = document.getElementById('modal-target-section');
        this.modalTargetLabel = document.getElementById('modal-target-label');
        this.modalTargetSelect = document.getElementById('modal-target-select');
        this.modalLayerSection = document.getElementById('modal-layer-section');
        this.modalLayerSelect = document.getElementById('modal-layer-select');
        
        // Modal buttons
        document.getElementById('btn-modal-close')?.addEventListener('click', () => this.closeModal());
        document.getElementById('btn-modal-cancel')?.addEventListener('click', () => this.closeModal());
        document.getElementById('btn-modal-save')?.addEventListener('click', () => this.saveModal());
        document.getElementById('btn-modal-delete')?.addEventListener('click', () => this.deleteItem());
        
        // Close modal on backdrop click
        this.modalEl?.addEventListener('click', (e) => {
            if (e.target === this.modalEl) this.closeModal();
        });
        
        this.renderAll();
        console.log('BiomeEditor initialized');
    },
    
    /**
     * Create version warning UI and reset button
     */
    createVersionUI() {
        // Find the biomes panel header to insert after
        const biomesPanel = this.biomesListEl?.parentElement;
        if (!biomesPanel) return;
        
        // Create container
        const container = document.createElement('div');
        container.className = 'version-controls';
        container.id = 'version-controls';
        
        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-small btn-reset';
        resetBtn.textContent = '↺ Reset';
        resetBtn.title = 'Reset all biomes to default configuration';
        resetBtn.addEventListener('click', () => Persistence.resetToDefaults());
        container.appendChild(resetBtn);
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-small btn-copy';
        copyBtn.textContent = '📋 Copy';
        copyBtn.title = 'Copy biome rules to clipboard';
        copyBtn.addEventListener('click', () => this.copyToClipboard());
        container.appendChild(copyBtn);
        
        // Version warning (hidden by default)
        this.versionWarningEl = document.createElement('span');
        this.versionWarningEl.className = 'version-warning hidden';
        this.versionWarningEl.textContent = 'New version!';
        this.versionWarningEl.title = 'Default biomes have been updated. Click Reset to get the new version.';
        container.appendChild(this.versionWarningEl);
        
        // Insert at the top of the biomes panel
        biomesPanel.insertBefore(container, this.biomesListEl);
    },
    
    /**
     * Copy biome rules to clipboard
     */
    async copyToClipboard() {
        try {
            const json = BiomeData.exportJSON();
            await navigator.clipboard.writeText(json);
            
            // Show feedback
            const copyBtn = document.querySelector('.btn-copy');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied!';
                copyBtn.classList.add('btn-success');
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('btn-success');
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        }
    },
    
    /**
     * Update version warning visibility
     */
    updateVersionWarning() {
        if (!this.versionWarningEl) return;
        
        const versionInfo = Persistence.getVersionInfo();
        if (versionInfo.outdated) {
            this.versionWarningEl.classList.remove('hidden');
            this.versionWarningEl.title = `Your biomes: v${versionInfo.saved} | Latest: v${versionInfo.latest}\nClick Reset to Defaults to get new features.`;
        } else {
            this.versionWarningEl.classList.add('hidden');
        }
    },
    
    /**
     * AIDEV-NOTE: Live preview - regenerate world when editing rules
     * Debounced to avoid too many regenerations while typing
     */
    triggerPreview() {
        // Only preview when editing a tile rule (not biome spawn conditions)
        if (this.editingType !== 'tile' || !this.editingTileRule || !this.selectedBiome) {
            return;
        }
        
        // Clear existing timer
        if (this.previewTimer) {
            clearTimeout(this.previewTimer);
        }
        
        // Debounce: wait before regenerating
        this.previewTimer = setTimeout(() => {
            this.applyPreview();
        }, this.PREVIEW_DELAY);
    },
    
    /**
     * Apply current values and regenerate
     */
    applyPreview() {
        if (!this.editingTileRule || !this.selectedBiome) return;
        
        // Regenerate world to show changes
        if (typeof Game !== 'undefined' && Game.regenerate) {
            Game.regenerate();
        }
        
        // Update the tile rules list to show current state
        this.renderTileRules();
    },
    
    renderAll() {
        this.renderBiomes();
        this.renderTileRules();
        this.updateVersionWarning();
    },
    
    // =====================
    // BIOMES
    // =====================
    
    renderBiomes() {
        if (!this.biomesListEl) return;
        this.biomesListEl.innerHTML = '';
        
        const biomes = BiomeData.getBiomes();
        for (const biome of biomes) {
            const card = this.createBiomeCard(biome);
            this.biomesListEl.appendChild(card);
        }
    },
    
    createBiomeCard(biome) {
        const card = document.createElement('div');
        card.className = 'biome-card';
        card.dataset.biomeId = biome.id;
        
        if (this.selectedBiome?.id === biome.id) {
            card.classList.add('selected');
        }
        
        // Color dot
        const colorDot = document.createElement('span');
        colorDot.className = 'color-dot';
        colorDot.style.backgroundColor = biome.color || '#666';
        card.appendChild(colorDot);
        
        // Icon
        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = biome.icon || '🔲';
        card.appendChild(icon);
        
        // Name
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = biome.name;
        card.appendChild(name);
        
        // Edit button (gear icon)
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-biome';
        editBtn.textContent = '⚙';
        editBtn.title = 'Edit biome settings';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openBiomeModal(biome);
        });
        card.appendChild(editBtn);
        
        // Click to select
        card.addEventListener('click', () => this.selectBiome(biome));
        
        return card;
    },
    
    selectBiome(biome) {
        this.selectedBiome = biome;
        
        // Update selection visuals
        this.biomesListEl.querySelectorAll('.biome-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.biomeId === biome.id);
        });
        
        // Show tile rules for this biome
        this.renderTileRules();
    },
    
    openBiomeModal(biome) {
        this.editingBiome = biome;
        this.editingType = 'biome';
        
        // Close inline editor if open
        if (this.editingTileRule) {
            this.closeEditor();
        }
        
        // Switch block system to modal workspace
        BlockSystem.setWorkspace('modal-block-palette', 'modal-block-workspace');
        
        // Set modal title
        this.modalTitleEl.textContent = 'Edit Biome';
        
        // Set name
        this.modalNameInput.value = biome.name || '';
        
        // Hide tile-specific sections
        this.modalTargetSection.classList.add('hidden');
        this.modalLayerSection.classList.add('hidden');
        
        // Load spawn conditions into block editor
        BlockSystem.loadRules(biome.spawnConditions || { type: 'AND', conditions: [] }, biome.id);
        
        // Show modal
        this.modalEl.classList.remove('hidden');
    },
    
    addNewBiome() {
        const id = 'biome_' + Date.now();
        const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        
        const newBiome = {
            id,
            name: 'New Biome',
            icon: '🔲',
            color,
            spawnConditions: { type: 'AND', conditions: [] },
            tileRules: []
        };
        
        BiomeData.addBiome(newBiome);
        Persistence.markDirty();
        this.renderBiomes();
        this.selectBiome(newBiome);
        this.openBiomeModal(newBiome);
    },
    
    // =====================
    // TILE RULES
    // =====================
    
    renderTileRules() {
        if (!this.tileRulesListEl) return;
        this.tileRulesListEl.innerHTML = '';
        
        if (!this.selectedBiome) {
            this.tileRulesListEl.innerHTML = '<p class="hint-text">Select a biome first</p>';
            return;
        }
        
        const rules = BiomeData.getBiomeTileRules(this.selectedBiome.id);
        const totalCount = rules.length;
        rules.forEach((rule, index) => {
            const card = this.createTileRuleCard(rule, index, totalCount);
            this.tileRulesListEl.appendChild(card);
        });
    },
    
    createTileRuleCard(rule, index, totalCount) {
        const card = document.createElement('div');
        card.className = 'rule-card';
        if (this.editingTileRule && this.editingTileRule.id === rule.id) {
            card.classList.add('selected');
        }
        card.dataset.ruleId = rule.id;
        
        // Reorder buttons container
        const reorderBtns = document.createElement('div');
        reorderBtns.className = 'rule-reorder-btns';
        
        // Up button
        const upBtn = document.createElement('button');
        upBtn.className = 'btn-reorder';
        upBtn.textContent = '▲';
        upBtn.title = 'Move up (higher priority)';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveRule(rule.id, -1);
        });
        reorderBtns.appendChild(upBtn);
        
        // Down button
        const downBtn = document.createElement('button');
        downBtn.className = 'btn-reorder';
        downBtn.textContent = '▼';
        downBtn.title = 'Move down (lower priority)';
        downBtn.disabled = index === totalCount - 1;
        downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveRule(rule.id, 1);
        });
        reorderBtns.appendChild(downBtn);
        
        card.appendChild(reorderBtns);
        
        // Tile preview
        const preview = document.createElement('div');
        preview.className = 'rule-tile-preview';
        const tileKey = rule.tile.replace(/ /g, '_');
        const tileIndex = TileAtlas.Tiles[tileKey];
        if (tileIndex !== undefined && TileAtlas.TileData[tileIndex]) {
            const tileData = TileAtlas.TileData[tileIndex];
            preview.style.backgroundImage = 'url(assets/tiles/atlas.png)';
            preview.style.backgroundPosition = `${-tileData.col * 24}px ${-tileData.row * 24}px`;
            preview.style.backgroundSize = `${TileAtlas.ATLAS_SIZE * 1.5}px`;
            preview.style.width = '24px';
            preview.style.height = '24px';
            preview.style.imageRendering = 'pixelated';
        }
        card.appendChild(preview);
        
        // Rule name
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = rule.name;
        card.appendChild(name);
        
        // Layer badge
        const layer = document.createElement('span');
        layer.className = 'layer-badge';
        layer.textContent = rule.layer === 'bg' ? 'BG' : 'FG';
        layer.style.fontSize = '9px';
        layer.style.padding = '1px 4px';
        layer.style.background = rule.layer === 'bg' ? '#664' : '#446';
        layer.style.borderRadius = '3px';
        layer.style.marginLeft = 'auto';
        card.appendChild(layer);
        
        card.addEventListener('click', () => this.openTileRuleModal(rule));
        
        return card;
    },
    
    /**
     * Move a tile rule up or down and re-render
     */
    moveRule(ruleId, direction) {
        if (!this.selectedBiome) return;
        
        const moved = BiomeData.moveBiomeTileRule(this.selectedBiome.id, ruleId, direction);
        if (moved) {
            Persistence.markDirty();
            this.renderTileRules();
            // Regenerate to show new rule order effect
            if (typeof Game !== 'undefined' && Game.regenerate) {
                Game.regenerate();
            }
        }
    },
    
    // =====================
    // INLINE TILE RULE EDITOR
    // =====================
    
    /**
     * Open inline editor for a tile rule - takes over entire sidebar
     */
    openTileRuleEditor(rule) {
        // Close biome modal if open
        if (this.editingBiome) {
            this.closeModal();
        }
        
        this.editingTileRule = rule;
        this.editingType = 'tile';
        
        // Ensure we're using the inline workspace
        BlockSystem.setWorkspace('block-palette', 'block-workspace');
        
        // Set title
        this.editorTitleEl.textContent = rule.name || 'Edit Rule';
        
        // Set name
        this.editorNameInput.value = rule?.name || '';
        
        // Populate tile select
        this.editorTileSelect.innerHTML = '';
        const categories = ['TERRAIN', 'DUNGEON', 'MECHANICAL', 'SPECIAL', 'BG', 'FAR_BG'];
        for (const cat of categories) {
            const tiles = TileAtlas.getTilesByCategory(cat);
            if (tiles.length > 0) {
                const optGroup = document.createElement('optgroup');
                optGroup.label = cat;
                for (const tile of tiles) {
                    const opt = document.createElement('option');
                    opt.value = tile.name.replace(/ /g, '_');
                    opt.textContent = tile.name;
                    if (rule?.tile === tile.name.replace(/ /g, '_')) opt.selected = true;
                    optGroup.appendChild(opt);
                }
                this.editorTileSelect.appendChild(optGroup);
            }
        }
        
        // Set layer
        this.editorLayerSelect.value = rule?.layer || 'fg';
        
        // Load conditions into block editor
        BlockSystem.loadRules(rule?.conditions || { type: 'AND', conditions: [] }, rule?.id);
        
        // Hide other sidebar sections, show editor (full takeover)
        this.setSidebarMode('editor');
    },
    
    /**
     * Close the inline editor and return to normal sidebar
     */
    closeEditor() {
        this.editingTileRule = null;
        this.editingType = null;
        
        // Show normal sidebar sections, hide editor
        this.setSidebarMode('normal');
        BlockSystem.clear();
        this.renderTileRules();
    },
    
    /**
     * Switch sidebar between normal mode and editor mode
     * @param {'normal'|'editor'} mode
     */
    setSidebarMode(mode) {
        if (mode === 'editor') {
            // Hide normal sections
            this.headerEl?.classList.add('hidden');
            this.biomesSectionEl?.classList.add('hidden');
            this.tileRulesSectionEl?.classList.add('hidden');
            // Show editor
            this.editorEl?.classList.remove('hidden');
        } else {
            // Show normal sections
            this.headerEl?.classList.remove('hidden');
            this.biomesSectionEl?.classList.remove('hidden');
            this.tileRulesSectionEl?.classList.remove('hidden');
            // Hide editor
            this.editorEl?.classList.add('hidden');
        }
    },
    
    /**
     * Handle changes in the inline editor - save and preview
     */
    onEditorChange() {
        if (!this.editingTileRule || !this.selectedBiome) return;
        
        // Get current values
        const name = this.editorNameInput.value.trim() || 'Unnamed Rule';
        const tile = this.editorTileSelect.value;
        const layer = this.editorLayerSelect.value;
        const conditions = BlockSystem.getConditions();
        
        // Update the rule
        this.editingTileRule.name = name;
        BiomeData.updateBiomeTileRule(this.selectedBiome.id, this.editingTileRule.id, {
            name,
            tile,
            layer,
            conditions
        });
        
        // Update title
        this.editorTitleEl.textContent = name;
        
        // Mark dirty and trigger preview
        Persistence.markDirty();
        this.triggerPreview();
    },
    
    /**
     * Delete the currently editing rule
     */
    deleteCurrentRule() {
        if (!this.editingTileRule || !this.selectedBiome) return;
        
        if (confirm(`Delete rule "${this.editingTileRule.name}"?`)) {
            BiomeData.removeBiomeTileRule(this.selectedBiome.id, this.editingTileRule.id);
            Persistence.markDirty();
            this.closeEditor();
            
            // Regenerate
            if (typeof Game !== 'undefined' && Game.regenerate) {
                Game.regenerate();
            }
        }
    },
    
    // Keep old function name for compatibility
    openTileRuleModal(rule) {
        this.openTileRuleEditor(rule);
    },
    
    addNewTileRule() {
        if (!this.selectedBiome) {
            alert('Select a biome first!');
            return;
        }
        
        // Create a new rule and open modal
        const id = this.selectedBiome.id + '_rule_' + Date.now();
        const newRule = {
            id,
            name: 'New Tile Rule',
            tile: 'Brick',
            layer: 'fg',
            conditions: { type: 'AND', conditions: [] }
        };
        
        BiomeData.addBiomeTileRule(this.selectedBiome.id, newRule);
        Persistence.markDirty();
        this.renderTileRules();
        this.openTileRuleModal(newRule);
    },
    
    // =====================
    // MODAL ACTIONS
    // =====================
    
    /**
     * Save biome from modal (tile rules are saved inline now)
     */
    saveModal() {
        if (this.editingType !== 'biome' || !this.editingBiome) return;
        
        const name = this.modalNameInput.value.trim();
        if (!name) {
            alert('Please enter a name');
            return;
        }
        
        // Get conditions from block editor
        const conditions = BlockSystem.getConditions();
        
        BiomeData.updateBiome(this.editingBiome.id, {
            name,
            spawnConditions: conditions
        });
        this.renderBiomes();
        
        Persistence.markDirty();
        this.closeModal();
        
        // Regenerate to show biome changes
        if (typeof Game !== 'undefined' && Game.regenerate) {
            Game.regenerate();
        }
    },
    
    /**
     * Delete biome from modal
     */
    deleteItem() {
        if (this.editingType !== 'biome' || !this.editingBiome) return;
        
        if (!confirm(`Delete biome "${this.editingBiome.name}"?`)) return;
        
        BiomeData.removeBiome(this.editingBiome.id);
        if (this.selectedBiome?.id === this.editingBiome.id) {
            this.selectedBiome = null;
        }
        this.renderBiomes();
        this.renderTileRules();
        
        Persistence.markDirty();
        this.closeModal();
        
        // Regenerate
        if (typeof Game !== 'undefined' && Game.regenerate) {
            Game.regenerate();
        }
    },
    
    closeModal() {
        this.modalEl?.classList.add('hidden');
        this.editingBiome = null;
        // Note: editingTileRule is managed by inline editor now
        if (this.editingType === 'biome') {
            this.editingType = null;
            BlockSystem.clear();
            // Switch back to inline editor workspace
            BlockSystem.setWorkspace('block-palette', 'block-workspace');
        }
    },
    
    refresh() {
        this.renderAll();
    }
};
