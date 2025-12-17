// AIDEV-NOTE: Perlin Noise implementation for WorldGenerator
// Used for room theme variation, decoration placement, and tile variation

const Noise = {
    // Permutation table (will be shuffled based on seed)
    perm: [],
    
    /**
     * Initialize noise with a seed
     * @param {number} seed - Random seed
     */
    init(seed) {
        // Create base permutation array
        const base = [];
        for (let i = 0; i < 256; i++) {
            base[i] = i;
        }
        
        // Shuffle using seed
        const random = this.seededRandom(seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [base[i], base[j]] = [base[j], base[i]];
        }
        
        // Duplicate for overflow
        this.perm = new Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = base[i & 255];
        }
    },
    
    /**
     * Create a seeded random number generator
     * @param {number} seed
     * @returns {Function}
     */
    seededRandom(seed) {
        let s = seed;
        return function() {
            s = Math.sin(s * 9999) * 10000;
            return s - Math.floor(s);
        };
    },
    
    /**
     * Fade function for smooth interpolation
     * @param {number} t
     * @returns {number}
     */
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    },
    
    /**
     * Linear interpolation
     * @param {number} a
     * @param {number} b
     * @param {number} t
     * @returns {number}
     */
    lerp(a, b, t) {
        return a + t * (b - a);
    },
    
    /**
     * Gradient function
     * @param {number} hash
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    grad(hash, x, y) {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    },
    
    /**
     * 2D Perlin noise
     * @param {number} x
     * @param {number} y
     * @returns {number} Value between -1 and 1
     */
    perlin2D(x, y) {
        // Find grid cell
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Relative position in cell
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        
        // Fade curves
        const u = this.fade(xf);
        const v = this.fade(yf);
        
        // Hash corners
        const aa = this.perm[this.perm[X] + Y];
        const ab = this.perm[this.perm[X] + Y + 1];
        const ba = this.perm[this.perm[X + 1] + Y];
        const bb = this.perm[this.perm[X + 1] + Y + 1];
        
        // Gradient and interpolate
        const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
        const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
        
        return this.lerp(x1, x2, v);
    },
    
    /**
     * Fractal Brownian Motion (layered noise)
     * @param {number} x
     * @param {number} y
     * @param {number} octaves - Number of layers
     * @param {number} persistence - Amplitude reduction per octave
     * @param {number} lacunarity - Frequency increase per octave
     * @returns {number} Value between -1 and 1
     */
    fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
        let total = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.perlin2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    },
    
    /**
     * Get noise value normalized to 0-1 range
     * @param {number} x
     * @param {number} y
     * @param {number} scale - Scale factor (larger = smoother)
     * @returns {number} Value between 0 and 1
     */
    get(x, y, scale = 1) {
        const value = this.perlin2D(x / scale, y / scale);
        return (value + 1) / 2; // Normalize to 0-1
    },
    
    /**
     * Get FBM noise value normalized to 0-1 range
     * @param {number} x
     * @param {number} y
     * @param {number} scale
     * @param {number} octaves
     * @returns {number} Value between 0 and 1
     */
    getFBM(x, y, scale = 1, octaves = 4) {
        const value = this.fbm(x / scale, y / scale, octaves);
        return (value + 1) / 2; // Normalize to 0-1
    },
    
    // =====================
    // ADVANCED NOISE TYPES
    // AIDEV-NOTE: These create different patterns useful for procedural level generation
    // =====================
    
    /**
     * Directionally-biased noise (stretched in one axis)
     * AIDEV-NOTE: Key technique for platforms/ladders:
     *   - xScale > yScale = horizontal bands (platforms)
     *   - yScale > xScale = vertical bands (ladders, pillars)
     * @param {number} x
     * @param {number} y
     * @param {number} xScale - Scale for X axis (larger = more horizontal stretch)
     * @param {number} yScale - Scale for Y axis (larger = more vertical stretch)
     * @returns {number} Value between 0 and 1
     */
    getStretched(x, y, xScale = 1, yScale = 1) {
        const value = this.perlin2D(x / xScale, y / yScale);
        return (value + 1) / 2;
    },
    
    /**
     * Ridge noise - creates sharp ridge lines where noise crosses zero
     * AIDEV-NOTE: Great for creating distinct platform edges or vein patterns
     * Formula: 1 - |noise| creates peaks at zero crossings
     * @param {number} x
     * @param {number} y
     * @param {number} scale
     * @returns {number} Value between 0 and 1 (1 at ridges)
     */
    getRidge(x, y, scale = 1) {
        const value = this.perlin2D(x / scale, y / scale);
        return 1 - Math.abs(value);
    },
    
    /**
     * Directional ridge noise - ridge noise with axis stretching
     * AIDEV-NOTE: Combines ridge sharpness with directional bias
     * Perfect for creating horizontal platform lines within caves
     * @param {number} x
     * @param {number} y
     * @param {number} xScale
     * @param {number} yScale
     * @returns {number} Value between 0 and 1
     */
    getStretchedRidge(x, y, xScale = 1, yScale = 1) {
        const value = this.perlin2D(x / xScale, y / yScale);
        return 1 - Math.abs(value);
    },
    
    /**
     * Terrace noise - quantizes continuous noise into discrete steps
     * AIDEV-NOTE: Creates flat shelf-like regions at regular intervals
     * Useful for creating distinct platform levels
     * @param {number} x
     * @param {number} y
     * @param {number} scale
     * @param {number} steps - Number of discrete levels (more = finer terracing)
     * @returns {number} Value between 0 and 1, quantized to steps
     */
    getTerrace(x, y, scale = 1, steps = 4) {
        const value = this.get(x, y, scale);
        return Math.floor(value * steps) / (steps - 1);
    },
    
    /**
     * Billowy noise - inverse of ridge, creates soft bumps
     * AIDEV-NOTE: abs(noise) creates valleys at zero crossings
     * Good for rounded, cloud-like formations
     * @param {number} x
     * @param {number} y
     * @param {number} scale
     * @returns {number} Value between 0 and 1
     */
    getBillowy(x, y, scale = 1) {
        const value = this.perlin2D(x / scale, y / scale);
        return Math.abs(value);
    },
    
    /**
     * Threshold band noise - returns 1 if noise is within a band, 0 otherwise
     * AIDEV-NOTE: Creates discrete bands/stripes in the noise field
     * Useful for spawning features only within narrow noise ranges
     * @param {number} x
     * @param {number} y
     * @param {number} scale
     * @param {number} center - Center of the band (0-1)
     * @param {number} width - Width of the band (0-1)
     * @returns {number} 0 or 1
     */
    getBand(x, y, scale, center, width) {
        const value = this.get(x, y, scale);
        const halfWidth = width / 2;
        return (value >= center - halfWidth && value <= center + halfWidth) ? 1 : 0;
    },
    
    /**
     * Domain-warped noise - use one noise to distort another
     * AIDEV-NOTE: Creates organic, twisted patterns
     * The warp noise offsets the sample position of the main noise
     * @param {number} x
     * @param {number} y
     * @param {number} scale
     * @param {number} warpScale - Scale of the warping noise
     * @param {number} warpStrength - How much to distort (in tiles)
     * @returns {number} Value between 0 and 1
     */
    getWarped(x, y, scale = 1, warpScale = 20, warpStrength = 4) {
        const warpX = this.perlin2D(x / warpScale, y / warpScale) * warpStrength;
        const warpY = this.perlin2D((x + 100) / warpScale, (y + 100) / warpScale) * warpStrength;
        return this.get(x + warpX, y + warpY, scale);
    },
    
    // =====================
    // ARCHITECTURAL SHAPES
    // AIDEV-NOTE: Mathematical shapes for structured level features
    // =====================
    
    /**
     * Arch shape generator - creates periodic arch/doorway openings
     * AIDEV-NOTE: Returns 1 if position is inside an arch opening, 0 otherwise
     * Useful for carving doorways into solid terrain via biome rules
     * @param {number} x - X position
     * @param {number} y - Y position  
     * @param {number} spacing - Horizontal distance between arch centers
     * @param {number} width - Half-width of each arch (total width = 2*width)
     * @param {number} height - Height of arch at center
     * @returns {number} 1 if inside arch, 0 if outside
     */
    getArch(x, y, spacing = 12, width = 3, height = 5) {
        // Find nearest arch center (arches repeat horizontally)
        const archCenterX = Math.round(x / spacing) * spacing;
        const distFromCenter = Math.abs(x - archCenterX);
        
        // Outside arch width
        if (distFromCenter >= width) return 0;
        
        // Parabolic arch shape: y = height * (1 - (x/width)^2)
        // This creates a rounded arch that's tallest at center
        const archCeiling = height * (1 - Math.pow(distFromCenter / width, 2));
        
        // Y position relative to arch base (arches start at bottom of each period)
        const yInPeriod = y % spacing;
        
        // Inside arch if below the ceiling curve
        return (yInPeriod < archCeiling) ? 1 : 0;
    }
};

