/**
 * Modern Mode Level Generation - Enhanced for 200 Unique Designs
 */

function generateModernLevel(level) {
    const cols = 80;
    const rows = 40;
    const seed = level * 133.7;
    const rnd = (s) => {
        const x = Math.sin(seed + s) * 10000;
        return x - Math.floor(x);
    };

    // Custom hand-designed levels 1-3
    const handDesignedPatterns = [
        // Level 1: Room + Path 
        (r, c) => {
            const roomLeft = 16, roomRight = 62, roomTop = 4, roomBottom = 32;
            const inRoomArea = (r >= roomTop && r <= roomBottom && c >= roomLeft && c <= roomRight);
            const isRoomWall = (
                ((r === roomTop || r === roomBottom) && c >= roomLeft && c <= roomRight) ||
                ((c === roomLeft || c === roomRight) && r >= roomTop && r <= roomBottom)
            );
            const entranceGap = (c >= 36 && c <= 42 && r === roomBottom);
            const isPathWall = (r > roomBottom && (c === 35 || c === 43));
            if (isRoomWall && !entranceGap) return 2;
            if (isPathWall) return 2;
            if (inRoomArea && !isRoomWall) {
                if (c === 48 && r > 8 && r < 28) return 1;
                if (r === 8 && c > 24 && c <= 48) return 1;
                const drawsHeart = (ox, oy) => {
                    const x = (c - ox) / 2.4;
                    const y = (oy - r) / 2.4;
                    return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
                };
                if (drawsHeart(58, 10)) return "heart";
            }
            return 0;
        },
        // Level 2: Double Room with Path
        (r, c) => {
            const isLRoom = (r >= 8 && r <= 24 && c >= 8 && c <= 32);
            const isLWall = (isLRoom && (r === 8 || r === 24 || c === 8 || c === 32));
            const isRRoom = (r >= 8 && r <= 24 && c >= 46 && c <= 70);
            const isRWall = (isRRoom && (r === 8 || r === 24 || c === 46 || c === 70));
            const isLGap = (c >= 18 && c <= 24 && r === 24);
            const isRGap = (c >= 54 && c <= 60 && r === 24);
            const isLPath = (r > 24 && (c === 16 || c === 26));
            const isRPath = (r > 24 && (c === 52 || c === 62));
            if ((isLWall && !isLGap) || (isRWall && !isRGap) || isLPath || isRPath) return 2;
            const isHeart = (ox, oy, size) => {
                const x = (c - ox) / size;
                const y = (oy - r) / size;
                return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
            };
            if (isLRoom && isHeart(20, 16, 6)) return 1;
            if (isRRoom && isHeart(58, 16, 6)) return 1;
            return 0;
        },
        // Level 3: Dual Waves
        (r, c) => {
            const wave1 = 10 + Math.sin(c * 0.2) * 5;
            const wave2 = 20 + Math.cos(c * 0.2) * 5;
            if (Math.abs(r - wave1) < 2 || Math.abs(r - wave2) < 2) return 1;
            return 0;
        }
    ];

    let patternFunc;
    if (level <= 3) {
        patternFunc = handDesignedPatterns[level - 1];
    } else {
        // Advanced Procedural Archetypes for Modern Mode
        const archetypes = [
            (r, c) => { // Spiral
                const midR = rows / 2, midC = cols / 2;
                const dx = c - midC, dy = r - midR;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                const spiral = (dist * 0.5) % (Math.PI * 2);
                return Math.abs(angle - spiral) < 0.3 ? 1 : 0;
            },
            (r, c) => { // Radial Symmetry / Mandala
                const midR = rows / 2, midC = cols / 2;
                const dx = Math.abs(c - midC), dy = Math.abs(r - midR);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const val = Math.sin(dist * 0.4) + Math.cos(dx * 0.2) * Math.sin(dy * 0.2);
                return val > 0.6 ? 1 : 0;
            },
            (r, c) => { // Geometric Grid with Offset
                const mod = 5 + Math.floor(rnd(1) * 5);
                const offset = rnd(2) * mod;
                return ((c + offset) % mod < 2 || (r + offset) % mod < 2) ? 1 : 0;
            },
            (r, c) => { // Perlin-ish organic blobs
                const freq = 0.05 + rnd(3) * 0.1;
                const val = Math.sin(c * freq) + Math.sin(r * freq) + Math.sin((c + r) * freq);
                return val > 1.2 ? 1 : 0;
            },
            (r, c) => { // Concentric Shapes
                const midR = rows / 2, midC = cols / 2;
                const dist = Math.max(Math.abs(c - midC) / 2, Math.abs(r - midR));
                return Math.floor(dist) % 4 === 0 ? 1 : 0;
            }
        ];

        const archIdx = (level - 4) % archetypes.length;
        const baseArch = archetypes[archIdx];

        patternFunc = (r, c) => {
            const base = baseArch(r, c);
            if (base === 0) return 0;
            // Add level-specific unique jitter
            const jitter = rnd(r * 13 + c * 7 + level);
            return jitter > 0.1 ? 1 : 0;
        };
    }

    const wrappedPattern = (r, c) => {
        // Modern outer border
        if (r === 0 || c === 0 || c === cols - 1) return 2;
        return patternFunc(r, c);
    };

    return {
        rows: rows,
        cols: cols,
        pattern: wrappedPattern,
        twist: 'none'
    };
}
