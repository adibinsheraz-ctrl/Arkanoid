/**
 * Classic Mode Level Generation - Enhanced for 200 Unique Designs
 */

function generateLevelConfig(level) {
    const seed = level * 123.456;
    const rnd = (s) => {
        const x = Math.sin(seed + s) * 10000;
        return x - Math.floor(x);
    };

    // Columns and rows scaling
    let cols = 8 + Math.floor((level - 1) / 10);
    let rows = 6 + Math.floor(level / 10);
    cols = Math.min(cols, 14);
    rows = Math.min(rows, 12);

    // Level 15 special design: ADI
    if (level === 15) {
        const adiPattern = [
            "  XXX   XXXX  XXXXX",
            " X   X  X   X   X  ",
            " XXXXX  X   X   X  ",
            " X   X  X   X   X  ",
            " X   X  XXXX  XXXXX"
        ];
        return {
            rows: adiPattern.length,
            cols: adiPattern[0].length,
            pattern: (r, c) => adiPattern[r][c] === 'X' ? 1 : 0,
            twist: 'speed_pulse'
        };
    }

    // Varied Pattern Collection
    const patternArchetypes = [
        (r, c) => 1, // Solid
        (r, c) => (r % 2 === 0) ? 1 : 0, // Stripes
        (r, c) => (c % 2 === 0) ? 1 : 0, // Vertical stripes
        (r, c) => (r + c) % 2 === 0 ? 1 : 0, // Checkerboard
        (r, c) => { // Diamond
            const midR = (rows - 1) / 2;
            const midC = (cols - 1) / 2;
            const dist = Math.abs(r - midR) / rows + Math.abs(c - midC) / cols;
            return dist < 0.4 ? 1 : 0;
        },
        (r, c) => { // Frame
            return (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) ? 1 : 0;
        },
        (r, c) => { // X-Shape
            const slope = rows / cols;
            return (Math.abs(r - c * slope) < 1 || Math.abs(r - (cols - 1 - c) * slope) < 1) ? 1 : 0;
        },
        (r, c) => { // Pyramid
            return r >= c && r >= (cols - 1 - c) ? 1 : 0;
        },
        (r, c) => { // Inverted Pyramid
            return r <= c && r <= (cols - 1 - c) ? 1 : 0;
        },
        (r, c) => { // Circle/Oval
            const midR = (rows - 1) / 2;
            const midC = (cols - 1) / 2;
            const dx = (c - midC) / (cols / 1.5);
            const dy = (r - midR) / (rows / 1.5);
            return (dx * dx + dy * dy) < 0.25 ? 1 : 0;
        },
        (r, c) => { // Waves
            return r === Math.floor(rows / 2 + Math.sin(c * 0.5) * (rows / 3)) ? 1 : 0;
        },
        (r, c) => { // Random Dithered
            return rnd(r * 10 + c) > 0.4 ? 1 : 0;
        }
    ];

    // Pick pattern based on level with secondary variations
    const archIdx = (level - 1) % patternArchetypes.length;
    const basePattern = patternArchetypes[archIdx];

    // Add level-based "Noise" or "Modulation" to ensure every single level is different
    const finalPattern = (r, c) => {
        const base = basePattern(r, c);
        if (base === 0) return 0;

        // At higher levels, introduce random gaps to make it unique
        if (level > 20) {
            const noise = rnd(r * 31 + c * 17 + level);
            if (noise < (level / 1000)) return 0;
        }
        return 1;
    };

    const twists = [
        'none', 'moving_paddle_shrink', 'ball_gravity', 'shifting_colors',
        'fast_ball', 'invisible_bricks', 'wind_force', 'jittery_ball'
    ];
    const twist = twists[level % twists.length];

    return {
        rows: rows,
        cols: cols,
        pattern: finalPattern,
        twist: twist
    };
}
