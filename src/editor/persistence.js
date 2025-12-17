// AIDEV-NOTE: Persistence system for WorldGenerator
// Handles localStorage auto-save and JSON export/import

const Persistence = {
    // Storage key
    STORAGE_KEY: 'worldgen_biomes',
    
    // Auto-save state
    isDirty: false,
    autoSaveTimer: null,
    AUTO_SAVE_DELAY: 2000, // 2 seconds
    
    // Version tracking
    savedVersion: null,
    
    /**
     * Initialize persistence system
     */
    init() {
        // Try to load saved data
        this.load();
        
        // Set up auto-save
        window.addEventListener('beforeunload', () => {
            if (this.isDirty) {
                this.save();
            }
        });
        
        console.log('Persistence initialized');
    },
    
    /**
     * Check if saved version is behind defaults
     * @returns {boolean}
     */
    isOutdated() {
        if (this.savedVersion === null) return false; // No saved data
        return this.savedVersion < BiomeData.DEFAULTS_VERSION;
    },
    
    /**
     * Get version info for display
     * @returns {Object} { saved, latest, outdated }
     */
    getVersionInfo() {
        return {
            saved: this.savedVersion,
            latest: BiomeData.DEFAULTS_VERSION,
            outdated: this.isOutdated()
        };
    },
    
    /**
     * Mark data as dirty (needs saving)
     */
    markDirty() {
        this.isDirty = true;
        
        // Schedule auto-save
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        this.autoSaveTimer = setTimeout(() => {
            this.save();
        }, this.AUTO_SAVE_DELAY);
    },
    
    /**
     * Save to localStorage
     */
    save() {
        try {
            // Include version in saved data
            const data = {
                version: BiomeData.DEFAULTS_VERSION,
                biomeOrder: BiomeData.biomeOrder,
                biomes: BiomeData.biomes
            };
            const json = JSON.stringify(data, null, 2);
            localStorage.setItem(this.STORAGE_KEY, json);
            this.savedVersion = BiomeData.DEFAULTS_VERSION;
            this.isDirty = false;
            console.log(`Biomes saved to localStorage (v${this.savedVersion})`);
        } catch (e) {
            console.error('Failed to save:', e);
        }
    },
    
    /**
     * Load from localStorage
     */
    load() {
        try {
            const json = localStorage.getItem(this.STORAGE_KEY);
            if (json) {
                const data = JSON.parse(json);
                
                // Extract version (default to 1 for old saves without version)
                this.savedVersion = data.version ?? 1;
                
                // Import the biome data
                BiomeData.importJSON(json);
                
                console.log(`Biomes loaded from localStorage (v${this.savedVersion}, latest: v${BiomeData.DEFAULTS_VERSION})`);
                
                if (this.isOutdated()) {
                    console.warn(`⚠️ Saved biomes are outdated (v${this.savedVersion} < v${BiomeData.DEFAULTS_VERSION})`);
                }
                
                // Refresh editor if initialized
                if (typeof BiomeEditor !== 'undefined' && BiomeEditor.refresh) {
                    BiomeEditor.refresh();
                }
            }
        } catch (e) {
            console.error('Failed to load:', e);
        }
    },
    
    /**
     * Export to JSON file
     */
    exportJSON() {
        try {
            const json = BiomeData.exportJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'worldgen_biomes.json';
            link.click();
            
            URL.revokeObjectURL(url);
            console.log('Biomes exported to JSON');
        } catch (e) {
            console.error('Failed to export:', e);
            alert('Failed to export: ' + e.message);
        }
    },
    
    /**
     * Import from JSON file
     * @param {File} file
     */
    importJSON(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const json = e.target.result;
                BiomeData.importJSON(json);
                this.save(); // Save imported data
                
                // Refresh editor
                if (typeof BiomeEditor !== 'undefined' && BiomeEditor.refresh) {
                    BiomeEditor.refresh();
                }
                
                // Regenerate dungeon with new biomes
                if (typeof Game !== 'undefined' && Game.regenerate) {
                    Game.regenerate();
                }
                
                console.log('Biomes imported from JSON');
                alert('Biomes imported successfully!');
            } catch (err) {
                console.error('Failed to import:', err);
                alert('Failed to import: ' + err.message);
            }
        };
        
        reader.onerror = () => {
            alert('Failed to read file');
        };
        
        reader.readAsText(file);
    },
    
    /**
     * Clear all saved data and reset to defaults
     */
    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            BiomeData.reset();
            this.savedVersion = null;
            
            // Save the fresh defaults
            this.save();
            
            if (typeof BiomeEditor !== 'undefined' && BiomeEditor.refresh) {
                BiomeEditor.refresh();
            }
            
            // Regenerate dungeon with new defaults
            if (typeof Game !== 'undefined' && Game.regenerate) {
                Game.regenerate();
            }
            
            console.log('Reset to defaults (v' + BiomeData.DEFAULTS_VERSION + ')');
        } catch (e) {
            console.error('Failed to clear:', e);
        }
    },
    
    /**
     * Reset to defaults (called from UI)
     */
    resetToDefaults() {
        if (!confirm('Reset all biomes to defaults? This will erase your customizations.')) {
            return;
        }
        this.clear();
    }
};
