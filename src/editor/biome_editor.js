// AIDEV-NOTE: Biome Editor for WorldGenerator
// Each biome has spawn conditions (where it appears) + tile rules (what tiles to use)
// Uses inline editor for tile rules, modal for biome spawn conditions

const BiomeEditor = {
    // DOM references
    biomesListEl: null,
    tileRulesListEl: null,
    versionWarningEl: null,
    
    // Rule loader elements
    ruleLoaderEl: null,
    editorContentEl: null,
    rulesetTitleEl: null,
    
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
    editingCorridorRule: null, // For corridor tile rule editing
    editingType: null,      // 'biome', 'tile', or 'corridor'
    
    // Corridor rules DOM references
    corridorSectionEl: null,
    corridorContentEl: null,
    corridorRulesListEl: null,
    corridorWidthSlider: null,
    corridorNoiseSlider: null,
    corridorVariationSlider: null,
    caveDistanceSlider: null,
    caveRoughnessSlider: null,
    
    // AIDEV-NOTE: Live preview system
    // Debounces regeneration while editing rules
    previewTimer: null,
    PREVIEW_DELAY: 300, // ms delay before regenerating
    
    init() {
        // Rule loader elements
        this.ruleLoaderEl = document.getElementById('rule-loader');
        this.editorContentEl = document.getElementById('editor-content');
        this.rulesetTitleEl = document.getElementById('ruleset-title');
        
        // Set up rule loader buttons
        this.setupRuleLoader();
        
        // List elements
        this.biomesListEl = document.getElementById('biomes-list');
        this.tileRulesListEl = document.getElementById('tile-rules-list');
        
        // Sidebar sections (for hide/show during editing)
        this.headerEl = this.editorContentEl?.querySelector('.editor-header');
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
        
        // Load button (return to rule selection)
        document.getElementById('btn-load-rules')?.addEventListener('click', () => this.showRuleLoader());
        
        // Corridor rules section
        this.setupCorridorRules();
        
        // Generation mode toggle - show/hide relevant sections
        this.setupGenerationModeToggle();
        
        // Update UI based on whether rules are loaded
        this.updateLoaderVisibility();
        
        this.renderAll();
        console.log('BiomeEditor initialized');
    },
    
    /**
     * Set up generation mode toggle to show/hide relevant sections
     * AIDEV-NOTE: Biomes + Tile Rules only apply to Noise Gen mode
     * Corridor Rules only apply to Hub & Spokes mode
     */
    setupGenerationModeToggle() {
        const modeSelect = document.getElementById('gen-mode-select');
        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                this.updateSectionsForMode(modeSelect.value);
            });
            // Initialize on load
            this.updateSectionsForMode(modeSelect.value);
        }
    },
    
    /**
     * Show/hide editor sections based on generation mode
     * @param {'noise'|'hub'} mode
     */
    updateSectionsForMode(mode) {
        const isHubMode = mode === 'hub';
        
        // Biomes and Tile Rules: only for Noise Gen
        if (this.biomesSectionEl) {
            this.biomesSectionEl.style.display = isHubMode ? 'none' : '';
        }
        if (this.tileRulesSectionEl) {
            this.tileRulesSectionEl.style.display = isHubMode ? 'none' : '';
        }
        
        // Corridor Rules: only for Hub & Spokes
        if (this.corridorSectionEl) {
            this.corridorSectionEl.style.display = isHubMode ? '' : 'none';
        }
    },
    
    /**
     * Set up corridor rules section (sliders and rule list)
     */
    setupCorridorRules() {
        this.corridorSectionEl = document.querySelector('.corridor-rules-section');
        this.corridorContentEl = document.getElementById('corridor-rules-content');
        this.corridorRulesListEl = document.getElementById('corridor-tile-rules-list');
        
        // Collapse toggle
        const header = document.getElementById('corridor-section-header');
        header?.addEventListener('click', () => {
            this.corridorSectionEl?.classList.toggle('collapsed');
        });
        
        // Shape config sliders
        this.corridorWidthSlider = document.getElementById('corridor-width');
        this.corridorNoiseSlider = document.getElementById('corridor-noise');
        this.corridorVariationSlider = document.getElementById('corridor-variation');
        
        // Slider event handlers
        this.corridorWidthSlider?.addEventListener('input', (e) => {
            document.getElementById('corridor-width-value').textContent = e.target.value;
            BiomeData.updateCorridorConfig({ width: parseInt(e.target.value) });
            this.triggerPreview();
        });
        
        this.corridorNoiseSlider?.addEventListener('input', (e) => {
            document.getElementById('corridor-noise-value').textContent = e.target.value;
            BiomeData.updateCorridorConfig({ noiseAmplitude: parseInt(e.target.value) });
            this.triggerPreview();
        });
        
        this.corridorVariationSlider?.addEventListener('input', (e) => {
            document.getElementById('corridor-variation-value').textContent = e.target.value;
            BiomeData.updateCorridorConfig({ widthVariation: parseInt(e.target.value) });
            this.triggerPreview();
        });
        
        // Cave carving sliders
        this.caveDistanceSlider = document.getElementById('cave-distance');
        this.caveRoughnessSlider = document.getElementById('cave-roughness');
        
        this.caveDistanceSlider?.addEventListener('input', (e) => {
            document.getElementById('cave-distance-value').textContent = e.target.value;
            BiomeData.updateCorridorConfig({ caveDistance: parseInt(e.target.value) });
            this.triggerPreview();
        });
        
        this.caveRoughnessSlider?.addEventListener('input', (e) => {
            document.getElementById('cave-roughness-value').textContent = e.target.value;
            BiomeData.updateCorridorConfig({ caveRoughness: parseInt(e.target.value) });
            this.triggerPreview();
        });
        
        // Add corridor rule button
        document.getElementById('btn-add-corridor-rule')?.addEventListener('click', () => {
            this.addCorridorRule();
        });
    },
    
    /**
     * Set up rule loader button handlers
     */
    setupRuleLoader() {
        // Show local button if local rules exist
        const btnLocal = document.getElementById('btn-load-local');
        if (btnLocal && Persistence.hasLocalRules()) {
            btnLocal.classList.remove('hidden');
        }
        
        // Local rules button
        btnLocal?.addEventListener('click', () => {
            Persistence.load();
            this.onRulesLoaded();
        });
        
        // Default Dungeon button
        document.getElementById('btn-load-default')?.addEventListener('click', () => {
            BiomeData.loadDefaultDungeon();
            this.onRulesLoaded();
        });
        
        // Generation Zoo button
        document.getElementById('btn-load-zoo')?.addEventListener('click', () => {
            BiomeData.loadGenerationZoo();
            this.onRulesLoaded();
        });
        
        // Import JSON button
        document.getElementById('btn-load-import')?.addEventListener('click', () => {
            document.getElementById('import-file')?.click();
        });
    },
    
    /**
     * Called when rules are loaded - update UI and regenerate
     */
    onRulesLoaded() {
        this.updateLoaderVisibility();
        this.renderAll();
        
        // Regenerate world with new rules
        if (typeof Game !== 'undefined' && Game.regenerate) {
            Game.regenerate();
        }
    },
    
    /**
     * Show the rule loader screen (keeps current world visible)
     */
    showRuleLoader() {
        this.selectedBiome = null;
        
        // Show loader, hide editor content
        this.ruleLoaderEl?.classList.remove('hidden');
        this.editorContentEl?.classList.add('hidden');
        
        // Update local button visibility
        const btnLocal = document.getElementById('btn-load-local');
        if (btnLocal) {
            if (Persistence.hasLocalRules()) {
                btnLocal.classList.remove('hidden');
            } else {
                btnLocal.classList.add('hidden');
            }
        }
    },
    
    /**
     * Update visibility of rule loader vs editor content
     */
    updateLoaderVisibility() {
        if (BiomeData.rulesLoaded) {
            // Show editor content, hide loader
            this.ruleLoaderEl?.classList.add('hidden');
            this.editorContentEl?.classList.remove('hidden');
            
            // Update title with current rule set name
            if (this.rulesetTitleEl && BiomeData.currentRuleSet) {
                this.rulesetTitleEl.textContent = BiomeData.currentRuleSet;
            }
        } else {
            // Show loader, hide editor content
            this.ruleLoaderEl?.classList.remove('hidden');
            this.editorContentEl?.classList.add('hidden');
            
            // Update local button visibility
            const btnLocal = document.getElementById('btn-load-local');
            if (btnLocal) {
                if (Persistence.hasLocalRules()) {
                    btnLocal.classList.remove('hidden');
                } else {
                    btnLocal.classList.add('hidden');
                }
            }
        }
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
     * Debounced to avoid too many regenerations while dragging sliders
     * Works for: corridor config sliders, corridor rules, biome tile rules
     */
    triggerPreview() {
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
        // Regenerate world to show changes
        if (typeof Game !== 'undefined' && Game.regenerate) {
            Game.regenerate();
        }
        
        // Update tile rules list if editing biome rules
        if (this.editingTileRule && this.selectedBiome) {
            this.renderTileRules();
        }
    },
    
    renderAll() {
        this.renderBiomes();
        this.renderTileRules();
        this.renderCorridorRules();
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
    // TILE RULES (with Group support)
    // =====================
    
    renderTileRules() {
        if (!this.tileRulesListEl) return;
        this.tileRulesListEl.innerHTML = '';
        
        if (!this.selectedBiome) {
            this.tileRulesListEl.innerHTML = '<p class="hint-text">Select a biome first</p>';
            return;
        }
        
        // Get raw rules (includes groups)
        const items = BiomeData.getBiomeTileRulesRaw(this.selectedBiome.id);
        const totalCount = items.length;
        
        items.forEach((item, index) => {
            if (item.type === 'group') {
                const groupEl = this.createGroupCard(item, index, totalCount);
                this.tileRulesListEl.appendChild(groupEl);
            } else {
                const card = this.createTileRuleCard(item, index, totalCount, null);
                this.tileRulesListEl.appendChild(card);
            }
        });
    },
    
    /**
     * Create a collapsible group card
     */
    createGroupCard(group, index, totalCount) {
        const container = document.createElement('div');
        container.className = 'rule-group';
        container.dataset.groupId = group.id;
        if (group.collapsed) {
            container.classList.add('collapsed');
        }
        
        // Group header
        const header = document.createElement('div');
        header.className = 'rule-group-header';
        
        // Collapse toggle
        const toggle = document.createElement('span');
        toggle.className = 'group-toggle';
        toggle.textContent = group.collapsed ? '▶' : '▼';
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleGroup(group.id);
        });
        header.appendChild(toggle);
        
        // Group name
        const name = document.createElement('span');
        name.className = 'group-name';
        name.textContent = group.name;
        header.appendChild(name);
        
        // Rule count
        const count = document.createElement('span');
        count.className = 'group-count';
        count.textContent = `(${group.rules?.length || 0})`;
        header.appendChild(count);
        
        // Group actions
        const actions = document.createElement('div');
        actions.className = 'group-actions';
        
        // Move up
        const upBtn = document.createElement('button');
        upBtn.className = 'btn-reorder';
        upBtn.textContent = '▲';
        upBtn.title = 'Move group up';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveGroup(group.id, -1);
        });
        actions.appendChild(upBtn);
        
        // Move down
        const downBtn = document.createElement('button');
        downBtn.className = 'btn-reorder';
        downBtn.textContent = '▼';
        downBtn.title = 'Move group down';
        downBtn.disabled = index === totalCount - 1;
        downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveGroup(group.id, 1);
        });
        actions.appendChild(downBtn);
        
        // Edit group name
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-group-action';
        editBtn.textContent = '✎';
        editBtn.title = 'Rename group';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.renameGroup(group.id);
        });
        actions.appendChild(editBtn);
        
        // Delete group
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-group-action btn-group-delete';
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'Delete group';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteGroup(group.id);
        });
        actions.appendChild(deleteBtn);
        
        header.appendChild(actions);
        container.appendChild(header);
        
        // Group content (rules inside)
        const content = document.createElement('div');
        content.className = 'rule-group-content';
        
        if (group.rules && group.rules.length > 0) {
            group.rules.forEach((rule, ruleIndex) => {
                const card = this.createTileRuleCard(rule, ruleIndex, group.rules.length, group.id);
                content.appendChild(card);
            });
        } else {
            const empty = document.createElement('p');
            empty.className = 'hint-text';
            empty.textContent = 'No rules in group';
            content.appendChild(empty);
        }
        
        container.appendChild(content);
        return container;
    },
    
    createTileRuleCard(rule, index, totalCount, groupId) {
        const card = document.createElement('div');
        card.className = 'rule-card';
        if (groupId) {
            card.classList.add('in-group');
        }
        if (this.editingTileRule && this.editingTileRule.id === rule.id) {
            card.classList.add('selected');
        }
        card.dataset.ruleId = rule.id;
        if (groupId) {
            card.dataset.groupId = groupId;
        }
        
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
            if (typeof Game !== 'undefined' && Game.regenerate) {
                Game.regenerate();
            }
        }
    },
    
    // =====================
    // GROUP ACTIONS
    // =====================
    
    /**
     * Toggle group collapsed state
     */
    toggleGroup(groupId) {
        if (!this.selectedBiome) return;
        
        const group = BiomeData.getGroup(this.selectedBiome.id, groupId);
        if (group) {
            BiomeData.updateGroup(this.selectedBiome.id, groupId, { collapsed: !group.collapsed });
            this.renderTileRules();
        }
    },
    
    /**
     * Move a group up or down
     */
    moveGroup(groupId, direction) {
        if (!this.selectedBiome) return;
        
        const moved = BiomeData.moveGroup(this.selectedBiome.id, groupId, direction);
        if (moved) {
            Persistence.markDirty();
            this.renderTileRules();
            if (typeof Game !== 'undefined' && Game.regenerate) {
                Game.regenerate();
            }
        }
    },
    
    /**
     * Rename a group
     */
    renameGroup(groupId) {
        if (!this.selectedBiome) return;
        
        const group = BiomeData.getGroup(this.selectedBiome.id, groupId);
        if (!group) return;
        
        const newName = prompt('Enter new group name:', group.name);
        if (newName && newName.trim()) {
            BiomeData.updateGroup(this.selectedBiome.id, groupId, { name: newName.trim() });
            Persistence.markDirty();
            this.renderTileRules();
        }
    },
    
    /**
     * Delete a group (with confirmation)
     */
    deleteGroup(groupId) {
        if (!this.selectedBiome) return;
        
        const group = BiomeData.getGroup(this.selectedBiome.id, groupId);
        if (!group) return;
        
        const ruleCount = group.rules?.length || 0;
        
        if (ruleCount > 0) {
            // Show modal with options
            const choice = confirm(
                `Delete group "${group.name}"?\n\n` +
                `This group contains ${ruleCount} rule(s).\n\n` +
                `Click OK to DELETE all rules in the group.\n` +
                `Click Cancel to keep the rules (they will be ungrouped).`
            );
            
            BiomeData.removeGroup(this.selectedBiome.id, groupId, choice);
        } else {
            BiomeData.removeGroup(this.selectedBiome.id, groupId, true);
        }
        
        Persistence.markDirty();
        this.renderTileRules();
        
        if (typeof Game !== 'undefined' && Game.regenerate) {
            Game.regenerate();
        }
    },
    
    /**
     * Add a new group
     */
    addNewGroup() {
        if (!this.selectedBiome) {
            alert('Select a biome first!');
            return;
        }
        
        const name = prompt('Enter group name:', 'New Group');
        if (!name || !name.trim()) return;
        
        BiomeData.addGroup(this.selectedBiome.id, {
            id: 'group_' + Date.now(),
            name: name.trim(),
            collapsed: false,
            rules: []
        });
        
        Persistence.markDirty();
        this.renderTileRules();
    },
    
    // =====================
    // CORRIDOR RULES
    // =====================
    
    /**
     * Render corridor rules section (sliders and tile rules list)
     */
    renderCorridorRules() {
        if (!this.corridorRulesListEl) return;
        
        // Update slider values from config
        const config = BiomeData.getCorridorConfig();
        if (this.corridorWidthSlider) {
            this.corridorWidthSlider.value = config.width;
            document.getElementById('corridor-width-value').textContent = config.width;
        }
        if (this.corridorNoiseSlider) {
            this.corridorNoiseSlider.value = config.noiseAmplitude;
            document.getElementById('corridor-noise-value').textContent = config.noiseAmplitude;
        }
        if (this.corridorVariationSlider) {
            this.corridorVariationSlider.value = config.widthVariation;
            document.getElementById('corridor-variation-value').textContent = config.widthVariation;
        }
        // Cave carving sliders
        if (this.caveDistanceSlider) {
            this.caveDistanceSlider.value = config.caveDistance ?? 12;
            document.getElementById('cave-distance-value').textContent = config.caveDistance ?? 12;
        }
        if (this.caveRoughnessSlider) {
            this.caveRoughnessSlider.value = config.caveRoughness ?? 4;
            document.getElementById('cave-roughness-value').textContent = config.caveRoughness ?? 4;
        }
        
        // Render corridor tile rules
        this.corridorRulesListEl.innerHTML = '';
        
        const rules = BiomeData.getCorridorTileRules();
        if (rules.length === 0) {
            this.corridorRulesListEl.innerHTML = '<p class="hint-text">No corridor rules defined</p>';
            return;
        }
        
        for (const rule of rules) {
            const card = this.createCorridorRuleCard(rule);
            this.corridorRulesListEl.appendChild(card);
        }
    },
    
    /**
     * Create a corridor rule card element
     */
    createCorridorRuleCard(rule) {
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.dataset.ruleId = rule.id;
        
        // Tile preview
        const preview = document.createElement('div');
        preview.className = 'rule-tile-preview';
        const tileKey = rule.tile?.replace(/ /g, '_');
        const tileData = TileAtlas.TileData[TileAtlas.Tiles[tileKey]];
        if (tileData) {
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
        name.style.flex = '1';
        card.appendChild(name);
        
        // Layer badge
        const layer = document.createElement('span');
        layer.className = `layer-badge ${rule.layer}`;
        layer.textContent = rule.layer === 'wall' ? 'WALL' : 'BG';
        card.appendChild(layer);
        
        // Reorder buttons
        const reorderBtns = document.createElement('div');
        reorderBtns.className = 'rule-reorder-btns';
        
        const btnUp = document.createElement('button');
        btnUp.className = 'btn-reorder';
        btnUp.textContent = '▲';
        btnUp.title = 'Move up';
        btnUp.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveCorridorRule(rule.id, -1);
        });
        reorderBtns.appendChild(btnUp);
        
        const btnDown = document.createElement('button');
        btnDown.className = 'btn-reorder';
        btnDown.textContent = '▼';
        btnDown.title = 'Move down';
        btnDown.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveCorridorRule(rule.id, 1);
        });
        reorderBtns.appendChild(btnDown);
        
        card.appendChild(reorderBtns);
        
        // Click to edit
        card.addEventListener('click', () => this.openCorridorRuleEditor(rule));
        
        return card;
    },
    
    /**
     * Add a new corridor tile rule
     */
    addCorridorRule() {
        const newRule = {
            id: 'corridor_rule_' + Date.now(),
            name: 'New Corridor Rule',
            tile: 'Brick',
            layer: 'wall',
            conditions: {
                type: 'AND',
                conditions: []
            }
        };
        
        BiomeData.addCorridorTileRule(newRule);
        Persistence.markDirty();
        this.renderCorridorRules();
        this.openCorridorRuleEditor(newRule);
    },
    
    /**
     * Move a corridor rule up or down
     */
    moveCorridorRule(ruleId, direction) {
        const moved = BiomeData.moveCorridorTileRule(ruleId, direction);
        if (moved) {
            Persistence.markDirty();
            this.renderCorridorRules();
            this.triggerPreview();
        }
    },
    
    /**
     * Open the inline editor for a corridor rule
     */
    openCorridorRuleEditor(rule) {
        // Close any existing editor
        if (this.editingBiome) {
            this.closeModal();
        }
        
        this.editingCorridorRule = rule;
        this.editingType = 'corridor';
        
        // Use the inline workspace
        BlockSystem.setWorkspace('block-palette', 'block-workspace');
        
        // Set title
        this.editorTitleEl.textContent = 'Edit Corridor Rule';
        
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
        
        // Set layer (corridor uses 'wall' and 'bg')
        this.editorLayerSelect.innerHTML = `
            <option value="wall">Wall (corridor border)</option>
            <option value="bg">Background (inside corridor)</option>
        `;
        this.editorLayerSelect.value = rule?.layer || 'wall';
        
        // Load conditions into block editor
        BlockSystem.loadRules(rule?.conditions || { type: 'AND', conditions: [] }, rule?.id);
        
        // Hide other sidebar sections, show editor (full takeover)
        this.setSidebarMode('editor');
    },
    
    /**
     * Save the currently editing corridor rule
     */
    saveCorridorRule() {
        if (!this.editingCorridorRule) return;
        
        const updates = {
            name: this.editorNameInput.value,
            tile: this.editorTileSelect.value,
            layer: this.editorLayerSelect.value,
            // BlockSystem.getConditions() already returns { type: 'AND', conditions: [...] }
            conditions: BlockSystem.getConditions()
        };
        
        BiomeData.updateCorridorTileRule(this.editingCorridorRule.id, updates);
        Persistence.markDirty();
    },
    
    /**
     * Delete the currently editing corridor rule
     */
    deleteCorridorRule() {
        if (!this.editingCorridorRule) return;
        
        if (confirm('Delete this corridor rule?')) {
            BiomeData.removeCorridorTileRule(this.editingCorridorRule.id);
            Persistence.markDirty();
            this.closeEditor();
            this.renderCorridorRules();
            this.triggerPreview();
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
        this.editingCorridorRule = null;
        this.editingType = null;
        
        // Show normal sidebar sections, hide editor
        this.setSidebarMode('normal');
        BlockSystem.clear();
        this.renderTileRules();
        this.renderCorridorRules();
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
            this.corridorSectionEl?.classList.add('hidden');
            // Show editor
            this.editorEl?.classList.remove('hidden');
        } else {
            // Show normal sections
            this.headerEl?.classList.remove('hidden');
            this.biomesSectionEl?.classList.remove('hidden');
            this.tileRulesSectionEl?.classList.remove('hidden');
            this.corridorSectionEl?.classList.remove('hidden');
            // Hide editor
            this.editorEl?.classList.add('hidden');
        }
    },
    
    /**
     * Handle changes in the inline editor - save and preview
     */
    onEditorChange() {
        // Handle corridor rule editing
        if (this.editingType === 'corridor' && this.editingCorridorRule) {
            this.saveCorridorRule();
            this.triggerPreview();
            return;
        }
        
        // Handle biome tile rule editing
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
        // Handle corridor rule deletion
        if (this.editingType === 'corridor' && this.editingCorridorRule) {
            this.deleteCorridorRule();
            return;
        }
        
        // Handle biome tile rule deletion
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
