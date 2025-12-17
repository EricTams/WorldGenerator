// AIDEV-NOTE: Scratch-style logic block system for spawn rules
// Provides draggable blocks for building room spawn conditions

const BlockSystem = {
    // Available block types
    // AIDEV-NOTE: These must match the context values in dungeon.js buildContext()
    blockTypes: {
        // Value blocks (blue) - these are the noise values rules can check
        // AIDEV-NOTE: Must match context values in dungeon.js buildContext()
        values: [
            // Basic noise (use scale modifiers for stretched patterns)
            { id: 'biome_noise', label: 'biome_noise', type: 'value', desc: 'Large-scale noise for biome regions' },
            { id: 'cave_noise', label: 'cave_noise', type: 'value', desc: 'Determines solid vs air (>=0.55 = cave). Use scale for stretched patterns!' },
            { id: 'detail_noise', label: 'detail_noise', type: 'value', desc: 'Fine detail variation' },
            // Neighbor awareness (for surface detection)
            { id: 'above_is_air', label: 'above_is_air', type: 'value', desc: '1 if tile above is air, 0 if solid (for grass tops)' },
            { id: 'below_is_air', label: 'below_is_air', type: 'value', desc: '1 if tile below is air, 0 if solid (for ceilings)' },
            { id: 'left_is_air', label: 'left_is_air', type: 'value', desc: '1 if tile left is air, 0 if solid (for left edges)' },
            { id: 'right_is_air', label: 'right_is_air', type: 'value', desc: '1 if tile right is air, 0 if solid (for right edges)' },
            // Architectural shapes
            { id: 'arch_value', label: 'arch_value', type: 'value', desc: '1 inside arch opening, 0 outside (for doorways)' },
            // Position-based (normalized)
            { id: 'depth', label: 'depth', type: 'value', desc: 'Vertical position (0=top, 1=bottom)' },
            { id: 'x_pos', label: 'x_pos', type: 'value', desc: 'Horizontal position (0-1)' },
            // Raw tile coordinates (use with modifiers like % 4)
            { id: 'y_tile', label: 'y_tile', type: 'value', desc: 'Raw Y tile coordinate (use % for patterns)' },
            { id: 'x_tile', label: 'x_tile', type: 'value', desc: 'Raw X tile coordinate (use % for patterns)' },
            // Random
            { id: 'random', label: 'random', type: 'value', desc: 'Random per-tile value (0-1)' }
        ],
        // Modifier operations (can be applied to any value)
        // AIDEV-NOTE: Modifiers are applied in order as a chain
        // Scale modifiers (xScale, yScale) affect noise sampling coordinates
        // Other modifiers transform the resulting value
        modifiers: [
            { id: 'xScale', label: 'xScale', op: 'xScale', desc: 'Scale X coordinate for noise (horizontal stretch)' },
            { id: 'yScale', label: 'yScale', op: 'yScale', desc: 'Scale Y coordinate for noise (vertical stretch)' },
            { id: 'mod', label: '%', op: '%', desc: 'Modulo (for regular patterns, e.g. y_tile % 4)' },
            { id: 'mul', label: '*', op: '*', desc: 'Multiply (scale up)' },
            { id: 'div', label: '/', op: '/', desc: 'Divide (scale down)' },
            { id: 'add', label: '+', op: '+', desc: 'Add (offset)' },
            { id: 'sub', label: '-', op: '-', desc: 'Subtract' },
            { id: 'pow', label: '^', op: '^', desc: 'Power (^2 = sharper peaks, ^0.5 = softer)' },
            { id: 'floor', label: 'floor', op: 'floor', desc: 'Round down' },
            { id: 'abs', label: 'abs', op: 'abs', desc: 'Absolute value' }
        ],
        // Comparison blocks (purple)
        compare: [
            { id: 'gt', label: '>', type: 'compare', op: '>' },
            { id: 'lt', label: '<', type: 'compare', op: '<' },
            { id: 'gte', label: '>=', type: 'compare', op: '>=' },
            { id: 'lte', label: '<=', type: 'compare', op: '<=' },
            { id: 'eq', label: '==', type: 'compare', op: '==' },
            { id: 'neq', label: '!=', type: 'compare', op: '!=' },
            { id: 'between', label: 'between', type: 'compare', op: 'between' }
        ],
        // Logic blocks (orange)
        logic: [
            { id: 'and', label: 'AND', type: 'logic' },
            { id: 'or', label: 'OR', type: 'logic' }
        ]
    },
    
    // DOM references
    paletteEl: null,
    workspaceEl: null,
    
    // Current expression
    currentExpression: null,
    
    // Selected biome (for saving)
    selectedBiomeId: null,
    
    /**
     * Initialize block system
     * @param {string} paletteId - ID of palette container
     * @param {string} workspaceId - ID of workspace container
     */
    init(paletteId, workspaceId) {
        this.paletteEl = document.getElementById(paletteId);
        this.workspaceEl = document.getElementById(workspaceId);
        
        if (this.paletteEl) {
            this.renderPalette();
        }
        
        console.log('BlockSystem initialized');
    },
    
    /**
     * Switch to a different workspace/palette (for modal vs inline editing)
     * @param {string} paletteId 
     * @param {string} workspaceId 
     */
    setWorkspace(paletteId, workspaceId) {
        this.paletteEl = document.getElementById(paletteId);
        this.workspaceEl = document.getElementById(workspaceId);
        
        if (this.paletteEl) {
            this.renderPalette();
        }
        if (this.workspaceEl) {
            this.renderWorkspace();
        }
    },
    
    /**
     * Render block palette
     */
    renderPalette() {
        this.paletteEl.innerHTML = '';
        
        // Value blocks
        const valueSection = this.createPaletteSection('Values', this.blockTypes.values);
        this.paletteEl.appendChild(valueSection);
        
        // Compare blocks
        const compareSection = this.createPaletteSection('Compare', this.blockTypes.compare);
        this.paletteEl.appendChild(compareSection);
        
        // Logic blocks
        const logicSection = this.createPaletteSection('Logic', this.blockTypes.logic);
        this.paletteEl.appendChild(logicSection);
    },
    
    /**
     * Create a palette section
     * @param {string} label
     * @param {Array} blocks
     * @returns {HTMLElement}
     */
    createPaletteSection(label, blocks) {
        const section = document.createElement('div');
        section.className = 'block-palette-section';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'block-palette-label';
        labelEl.textContent = label;
        section.appendChild(labelEl);
        
        const items = document.createElement('div');
        items.className = 'block-palette-items';
        
        for (const blockDef of blocks) {
            const block = this.createBlock(blockDef, true);
            items.appendChild(block);
        }
        
        section.appendChild(items);
        return section;
    },
    
    /**
     * Create a block element
     * @param {Object} blockDef
     * @param {boolean} isPalette - If true, this is a palette block (drag to copy)
     * @returns {HTMLElement}
     */
    createBlock(blockDef, isPalette = false) {
        const block = document.createElement('div');
        block.className = `block block-${blockDef.type}`;
        block.textContent = blockDef.label;
        block.dataset.blockId = blockDef.id;
        block.dataset.blockType = blockDef.type;
        if (blockDef.op) {
            block.dataset.op = blockDef.op;
        }
        
        // Make draggable
        block.draggable = true;
        block.addEventListener('dragstart', (e) => this.onDragStart(e, blockDef, isPalette));
        block.addEventListener('dragend', (e) => this.onDragEnd(e));
        
        // AIDEV-NOTE: Dynamic overlay for value blocks in palette
        if (blockDef.type === 'value') {
            block.addEventListener('mouseenter', () => {
                this.setDynamicOverlay(blockDef.id, null);
            });
            block.addEventListener('mouseleave', () => {
                this.clearDynamicOverlay();
            });
        }
        
        return block;
    },
    
    /**
     * Handle drag start
     * @param {DragEvent} e
     * @param {Object} blockDef
     * @param {boolean} isPalette
     */
    onDragStart(e, blockDef, isPalette) {
        e.dataTransfer.setData('application/json', JSON.stringify({ blockDef, isPalette }));
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
     * Load spawn rules into workspace
     * @param {Object} rules
     * @param {string} roomTypeId
     */
    loadRules(rules, biomeId) {
        this.selectedBiomeId = biomeId;
        this.currentExpression = rules;
        this.renderWorkspace();
    },
    
    /**
     * Render workspace with current expression
     */
    renderWorkspace() {
        if (!this.workspaceEl) return;
        
        this.workspaceEl.innerHTML = '';
        
        if (!this.currentExpression || !this.currentExpression.conditions) {
            this.workspaceEl.innerHTML = '<div class="block-drop-zone" data-drop="root">Drop blocks here</div>';
            this.setupDropZone(this.workspaceEl.querySelector('.block-drop-zone'));
            return;
        }
        
        // Render each condition
        const container = document.createElement('div');
        container.className = 'expression-builder';
        
        // Logic type selector
        const logicLabel = document.createElement('span');
        logicLabel.className = 'logic-connector';
        logicLabel.textContent = this.currentExpression.type || 'AND';
        logicLabel.addEventListener('click', () => {
            this.currentExpression.type = this.currentExpression.type === 'AND' ? 'OR' : 'AND';
            this.renderWorkspace();
            this.saveCurrentRules();
        });
        container.appendChild(logicLabel);
        
        // Render conditions
        for (let i = 0; i < this.currentExpression.conditions.length; i++) {
            const cond = this.currentExpression.conditions[i];
            const condEl = this.renderCondition(cond, i);
            container.appendChild(condEl);
        }
        
        // Add drop zone for new conditions
        const dropZone = document.createElement('div');
        dropZone.className = 'block-drop-zone';
        dropZone.dataset.drop = 'new';
        dropZone.textContent = '+';
        this.setupDropZone(dropZone);
        container.appendChild(dropZone);
        
        this.workspaceEl.appendChild(container);
    },
    
    /**
     * Render a condition
     * @param {Object} cond
     * @param {number} index
     * @returns {HTMLElement}
     */
    renderCondition(cond, index) {
        const row = document.createElement('div');
        row.className = 'condition-row';
        
        // Ensure modifiers array exists
        if (!cond.modifiers) {
            cond.modifiers = [];
            // Migrate legacy format
            if (cond.scale) {
                if (cond.scale.x && cond.scale.x !== 1) cond.modifiers.push({ op: 'xScale', arg: cond.scale.x });
                if (cond.scale.y && cond.scale.y !== 1) cond.modifiers.push({ op: 'yScale', arg: cond.scale.y });
                delete cond.scale;
            }
            if (cond.modifier) {
                cond.modifiers.push(cond.modifier);
                delete cond.modifier;
            }
        }
        
        // Value block - clickable to change value
        const valueBlock = document.createElement('div');
        valueBlock.className = 'block block-value clickable';
        valueBlock.textContent = cond.value || '?';
        valueBlock.title = 'Click to change value';
        valueBlock.addEventListener('click', () => {
            this.showValueSelector(valueBlock, cond);
        });
        
        // AIDEV-NOTE: Dynamic overlay - update on hover
        valueBlock.addEventListener('mouseenter', () => {
            this.setDynamicOverlay(cond.value, cond.modifiers);
        });
        valueBlock.addEventListener('mouseleave', () => {
            this.clearDynamicOverlay();
        });
        row.appendChild(valueBlock);
        
        // Modifiers chain - each modifier as a block
        const modifiersContainer = document.createElement('div');
        modifiersContainer.className = 'modifiers-chain';
        
        cond.modifiers.forEach((mod, modIndex) => {
            const modBlock = document.createElement('div');
            modBlock.className = 'block block-modifier clickable';
            // Only show operator name, value shown on click/edit
            modBlock.textContent = mod.op;
            modBlock.title = `${mod.op} ${mod.arg ?? ''} - Click to edit`.trim();
            
            modBlock.addEventListener('click', () => {
                this.showModifierEditor(modBlock, cond, modIndex);
            });
            
            // Hover shows overlay with all modifiers up to this point
            modBlock.addEventListener('mouseenter', () => {
                this.setDynamicOverlay(cond.value, cond.modifiers.slice(0, modIndex + 1));
            });
            modBlock.addEventListener('mouseleave', () => {
                this.clearDynamicOverlay();
            });
            
            modifiersContainer.appendChild(modBlock);
        });
        
        // Add modifier button
        const addModBtn = document.createElement('div');
        addModBtn.className = 'block block-modifier-empty clickable';
        addModBtn.textContent = '+';
        addModBtn.title = 'Add modifier to chain';
        addModBtn.addEventListener('click', () => {
            this.showModifierSelector(addModBtn, cond);
        });
        modifiersContainer.appendChild(addModBtn);
        
        row.appendChild(modifiersContainer);
        
        // Operator block - clickable to change operator
        const opBlock = document.createElement('div');
        opBlock.className = 'block block-compare clickable';
        opBlock.textContent = cond.op || '>';
        opBlock.title = 'Click to change comparison';
        opBlock.addEventListener('click', () => {
            this.showCompareSelector(opBlock, cond);
        });
        row.appendChild(opBlock);
        
        // Threshold input with slider
        if (cond.op === 'between') {
            // Between uses two inputs with sliders
            const minContainer = this.createThresholdInput(cond, 'min', cond.min ?? 0);
            row.appendChild(minContainer);
            
            const toLabel = document.createElement('span');
            toLabel.textContent = 'to';
            toLabel.style.margin = '0 4px';
            row.appendChild(toLabel);
            
            const maxContainer = this.createThresholdInput(cond, 'max', cond.max ?? 1);
            row.appendChild(maxContainer);
        } else {
            const threshContainer = this.createThresholdInput(cond, 'threshold', cond.threshold ?? 0);
            row.appendChild(threshContainer);
        }
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-small';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
            this.currentExpression.conditions.splice(index, 1);
            this.renderWorkspace();
            this.saveCurrentRules();
        });
        row.appendChild(deleteBtn);
        
        return row;
    },
    
    /**
     * Create a threshold input with both slider and number input
     * @param {Object} cond - The condition object
     * @param {string} prop - Property name ('threshold', 'min', or 'max')
     * @param {number} value - Initial value
     * @returns {HTMLElement}
     */
    createThresholdInput(cond, prop, value) {
        const container = document.createElement('div');
        container.className = 'threshold-input-container';
        
        // Determine range based on value (auto-expand for values outside 0-1)
        let min = 0, max = 1;
        if (value < 0) min = Math.floor(value);
        if (value > 1) max = Math.ceil(value);
        
        // Slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'threshold-slider';
        slider.min = min;
        slider.max = max;
        slider.step = '0.01';
        slider.value = value;
        
        // Number input
        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.className = 'threshold-number';
        numInput.value = value;
        numInput.step = '0.1';
        
        // Sync slider -> number and save
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            numInput.value = val;
            cond[prop] = val;
            this.saveCurrentRules();
        });
        
        // Sync number -> slider and save (with range expansion)
        numInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            // Expand slider range if needed
            if (val < parseFloat(slider.min)) slider.min = Math.floor(val);
            if (val > parseFloat(slider.max)) slider.max = Math.ceil(val);
            slider.value = val;
            cond[prop] = val;
            this.saveCurrentRules();
        });
        
        container.appendChild(slider);
        container.appendChild(numInput);
        
        return container;
    },
    
    /**
     * Show selector dropdown for adding a new modifier to the chain
     * @param {HTMLElement} block - The block element clicked
     * @param {Object} cond - The condition object to modify
     */
    showModifierSelector(block, cond) {
        this.closeSelector();
        
        const selector = document.createElement('div');
        selector.className = 'block-selector block-selector-modifier';
        selector.id = 'block-selector-active';
        
        // Modifier options
        for (const modDef of this.blockTypes.modifiers) {
            const option = document.createElement('div');
            option.className = 'block-selector-option';
            option.innerHTML = `<strong>${modDef.label}</strong> <span class="desc">${modDef.desc}</span>`;
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showModifierArgInput(block, cond, modDef, -1); // -1 = add new
            });
            selector.appendChild(option);
        }
        
        // Position below the block
        const rect = block.getBoundingClientRect();
        selector.style.position = 'fixed';
        selector.style.left = rect.left + 'px';
        selector.style.top = rect.bottom + 'px';
        
        document.body.appendChild(selector);
        
        setTimeout(() => {
            document.addEventListener('click', this.closeSelectorHandler);
        }, 0);
    },
    
    /**
     * Show editor for an existing modifier in the chain
     * @param {HTMLElement} block - The block element clicked
     * @param {Object} cond - The condition object
     * @param {number} modIndex - Index of the modifier to edit
     */
    showModifierEditor(block, cond, modIndex) {
        this.closeSelector();
        
        const mod = cond.modifiers[modIndex];
        const selector = document.createElement('div');
        selector.className = 'block-selector block-selector-modifier';
        selector.id = 'block-selector-active';
        
        // Remove option
        const removeOption = document.createElement('div');
        removeOption.className = 'block-selector-option block-selector-remove';
        removeOption.textContent = '✕ Remove modifier';
        removeOption.addEventListener('click', (e) => {
            e.stopPropagation();
            cond.modifiers.splice(modIndex, 1);
            this.closeSelector();
            this.renderWorkspace();
            this.saveCurrentRules();
        });
        selector.appendChild(removeOption);
        
        // Edit value option
        const modDef = this.blockTypes.modifiers.find(m => m.op === mod.op);
        if (modDef) {
            const editOption = document.createElement('div');
            editOption.className = 'block-selector-option';
            editOption.textContent = `✎ Edit ${mod.op} value`;
            editOption.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showModifierArgInput(block, cond, modDef, modIndex);
            });
            selector.appendChild(editOption);
        }
        
        // Position below the block
        const rect = block.getBoundingClientRect();
        selector.style.position = 'fixed';
        selector.style.left = rect.left + 'px';
        selector.style.top = rect.bottom + 'px';
        
        document.body.appendChild(selector);
        
        setTimeout(() => {
            document.addEventListener('click', this.closeSelectorHandler);
        }, 0);
    },
    
    /**
     * Show input for modifier argument
     * @param {HTMLElement} block
     * @param {Object} cond
     * @param {Object} modDef
     * @param {number} modIndex - Index to edit, or -1 to add new
     */
    showModifierArgInput(block, cond, modDef, modIndex) {
        this.closeSelector();
        
        // Some modifiers don't need an argument
        const noArgModifiers = ['floor', 'abs'];
        if (noArgModifiers.includes(modDef.op)) {
            if (modIndex === -1) {
                cond.modifiers.push({ op: modDef.op });
            } else {
                cond.modifiers[modIndex] = { op: modDef.op };
            }
            this.renderWorkspace();
            this.saveCurrentRules();
            return;
        }
        
        const selector = document.createElement('div');
        selector.className = 'block-selector block-selector-input';
        selector.id = 'block-selector-active';
        
        const label = document.createElement('div');
        label.textContent = `${modDef.label} value:`;
        label.style.marginBottom = '4px';
        selector.appendChild(label);
        
        // Get default value based on modifier type
        const existingArg = modIndex >= 0 ? cond.modifiers[modIndex]?.arg : null;
        let defaultVal = existingArg ?? 1;
        if (modDef.op === '%') defaultVal = existingArg ?? 4;
        if (modDef.op === 'xScale' || modDef.op === 'yScale') defaultVal = existingArg ?? 3;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.value = defaultVal;
        input.step = (modDef.op === '%' || modDef.op === 'xScale' || modDef.op === 'yScale') ? '1' : '0.1';
        input.style.width = '60px';
        selector.appendChild(input);
        
        const okBtn = document.createElement('button');
        okBtn.className = 'btn btn-small';
        okBtn.textContent = 'OK';
        okBtn.style.marginLeft = '4px';
        okBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newMod = { op: modDef.op, arg: parseFloat(input.value) };
            if (modIndex === -1) {
                cond.modifiers.push(newMod);
            } else {
                cond.modifiers[modIndex] = newMod;
            }
            this.closeSelector();
            this.renderWorkspace();
            this.saveCurrentRules();
        });
        selector.appendChild(okBtn);
        
        // Position below the block
        const rect = block.getBoundingClientRect();
        selector.style.position = 'fixed';
        selector.style.left = rect.left + 'px';
        selector.style.top = rect.bottom + 'px';
        
        document.body.appendChild(selector);
        input.focus();
        input.select();
        
        // Handle enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            }
        });
        
        setTimeout(() => {
            document.addEventListener('click', this.closeSelectorHandler);
        }, 0);
    },
    
    /**
     * Show selector dropdown for changing value
     * @param {HTMLElement} block - The block element clicked
     * @param {Object} cond - The condition object to modify
     */
    showValueSelector(block, cond) {
        // Remove any existing selector
        this.closeSelector();
        
        const selector = document.createElement('div');
        selector.className = 'block-selector';
        selector.id = 'block-selector-active';
        
        for (const valueDef of this.blockTypes.values) {
            const option = document.createElement('div');
            option.className = 'block-selector-option';
            option.textContent = valueDef.label;
            if (valueDef.id === cond.value) {
                option.classList.add('selected');
            }
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                cond.value = valueDef.id;
                this.closeSelector();
                this.renderWorkspace();
                this.saveCurrentRules();
            });
            selector.appendChild(option);
        }
        
        // Position below the block
        const rect = block.getBoundingClientRect();
        selector.style.position = 'fixed';
        selector.style.left = rect.left + 'px';
        selector.style.top = rect.bottom + 'px';
        
        document.body.appendChild(selector);
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this.closeSelectorHandler);
        }, 0);
    },
    
    /**
     * Show selector dropdown for changing comparison operator
     * @param {HTMLElement} block - The block element clicked
     * @param {Object} cond - The condition object to modify
     */
    showCompareSelector(block, cond) {
        // Remove any existing selector
        this.closeSelector();
        
        const selector = document.createElement('div');
        selector.className = 'block-selector';
        selector.id = 'block-selector-active';
        
        for (const compareDef of this.blockTypes.compare) {
            const option = document.createElement('div');
            option.className = 'block-selector-option';
            option.textContent = compareDef.label;
            if (compareDef.op === cond.op) {
                option.classList.add('selected');
            }
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const oldOp = cond.op;
                cond.op = compareDef.op;
                
                // Handle switching to/from 'between' operator
                if (compareDef.op === 'between' && oldOp !== 'between') {
                    // Convert threshold to min/max
                    cond.min = cond.threshold ?? 0;
                    cond.max = 1;
                    delete cond.threshold;
                } else if (compareDef.op !== 'between' && oldOp === 'between') {
                    // Convert min to threshold
                    cond.threshold = cond.min ?? 0;
                    delete cond.min;
                    delete cond.max;
                }
                
                this.closeSelector();
                this.renderWorkspace();
                this.saveCurrentRules();
            });
            selector.appendChild(option);
        }
        
        // Position below the block
        const rect = block.getBoundingClientRect();
        selector.style.position = 'fixed';
        selector.style.left = rect.left + 'px';
        selector.style.top = rect.bottom + 'px';
        
        document.body.appendChild(selector);
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this.closeSelectorHandler);
        }, 0);
    },
    
    /**
     * Handler for closing selector on outside click
     */
    closeSelectorHandler: function(e) {
        const selector = document.getElementById('block-selector-active');
        if (selector && !selector.contains(e.target)) {
            BlockSystem.closeSelector();
        }
    },
    
    /**
     * Close any open selector dropdown
     */
    closeSelector() {
        const existing = document.getElementById('block-selector-active');
        if (existing) {
            existing.remove();
        }
        document.removeEventListener('click', this.closeSelectorHandler);
    },
    
    /**
     * Set up drop zone handlers
     * @param {HTMLElement} zone
     */
    setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', (e) => {
            zone.classList.remove('drag-over');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                this.handleDrop(data.blockDef, zone.dataset.drop);
            } catch (err) {
                console.error('Drop error:', err);
            }
        });
    },
    
    /**
     * Handle block drop
     * @param {Object} blockDef
     * @param {string} dropTarget
     */
    handleDrop(blockDef, dropTarget) {
        if (blockDef.type === 'value') {
            // Add new condition with this value
            if (!this.currentExpression) {
                this.currentExpression = { type: 'AND', conditions: [] };
            }
            
            this.currentExpression.conditions.push({
                type: 'compare',
                value: blockDef.id,
                op: '>',
                threshold: 0
            });
            
            this.renderWorkspace();
            this.saveCurrentRules();
        }
    },
    
    /**
     * Save current rules to room type
     * Note: Actual saving happens when modal Save button is clicked.
     * This just marks data as dirty for auto-save.
     * AIDEV-NOTE: Also triggers live preview regeneration
     */
    saveCurrentRules() {
        if (this.selectedBiomeId && this.currentExpression) {
            // Just mark dirty - the modal's Save button handles actual saving
            Persistence.markDirty();
            
            // Trigger live preview if available
            if (typeof BiomeEditor !== 'undefined' && BiomeEditor.triggerPreview) {
                BiomeEditor.triggerPreview();
            }
        }
    },
    
    /**
     * Get current conditions from the workspace
     * @returns {Object} conditions object
     */
    getConditions() {
        return this.currentExpression || { type: 'AND', conditions: [] };
    },
    
    /**
     * Clear workspace
     */
    clear() {
        this.currentExpression = null;
        this.selectedBiomeId = null;
        if (this.workspaceEl) {
            this.workspaceEl.innerHTML = '<div class="block-drop-zone" data-drop="root">Drop blocks here</div>';
        }
    },
    
    // =====================
    // DYNAMIC OVERLAY
    // =====================
    
    /**
     * Set dynamic overlay to show a value (with optional modifier and scale)
     * @param {string} value - The value name (e.g., 'cave_noise')
     * @param {Array|null} modifiers - Optional modifiers array (e.g., [{ op: 'xScale', arg: 3 }, { op: '^', arg: 2 }])
     */
    setDynamicOverlay(value, modifiers = null) {
        if (typeof Game !== 'undefined' && Game.dynamicOverlay) {
            Game.dynamicOverlay.value = value;
            Game.dynamicOverlay.modifiers = modifiers || [];
        }
    },
    
    /**
     * Clear dynamic overlay
     */
    clearDynamicOverlay() {
        if (typeof Game !== 'undefined' && Game.dynamicOverlay) {
            Game.dynamicOverlay.value = null;
            Game.dynamicOverlay.modifiers = [];
        }
    }
};

