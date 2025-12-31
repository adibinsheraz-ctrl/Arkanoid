/**
 * Arkanoid Web - Massive Arcade Edition
 * Enhanced Levels, Fully Functioning Power-ups & Juicy Physics
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const livesElement = document.getElementById('lives');

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

// Max levels
const MAX_LEVELS = 200;

// Base configuration for difficulty scaling
const DIFFICULTY_PADDLE_SHRINK = 0.0; // Disable paddle shrinking for easier gameplay
const DIFFICULTY_BALL_SPEED_INC = 0.008; // Increased slightly for faster level scaling

// Seeded Random for procedural consistency
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}



// Mellow, Classic Sound Effects using Web Audio API
const sfx = {
    ctx: null,
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { console.warn("AudioContext failing"); }
    },
    play(freq, type, duration, vol = 0.05, decayType = 'exponential') {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type; // 'sine', 'triangle' are smoother
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.01); // Soft attack

        if (decayType === 'exponential') {
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        } else {
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        }

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    hitPaddle() {
        // Soft "thip"
        this.play(220, 'triangle', 0.15, 0.08);
    },
    hitBrick() {
        // Musical pings using a pentatonic flavor
        const notes = [440, 493.88, 554.37, 659.25, 739.99];
        const freq = notes[Math.floor(Math.random() * notes.length)] * 1.5;
        this.play(freq, 'sine', 0.2, 0.04);
    },
    hitWall() {
        // Very soft thud
        this.play(120, 'sine', 0.1, 0.03);
    },
    powerup() {
        // Harmonious upward chime
        this.play(523.25, 'triangle', 0.4, 0.04);
        setTimeout(() => this.play(783.99, 'triangle', 0.4, 0.03), 50);
        setTimeout(() => this.play(1046.50, 'triangle', 0.4, 0.02), 100);
    },
    lose() {
        // Gentle downward sigh
        const now = this.ctx.currentTime;
        this.play(300, 'sine', 0.8, 0.05);
        this.play(200, 'sine', 0.8, 0.05);
    },
    win() {
        // Achievement arpeggio
        const root = 523.25; // C5
        [0, 4, 7, 12].forEach((semi, i) => {
            setTimeout(() => {
                const f = root * Math.pow(2, semi / 12);
                this.play(f, 'triangle', 0.5, 0.05);
            }, i * 100);
        });
    }
};

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = 2 + Math.random() * 4;
    }
    update(ts) {
        this.x += this.vx * ts; this.y += this.vy * ts;
        this.life -= this.decay * ts;
        this.vy += 0.1 * ts; // Gravity
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.width = 25; this.height = 12; this.vy = 2.5;
        this.label = type === 'expand' ? '↔' : (type === 'multi' ? '●●' : '★');
        this.color = type === 'expand' ? '#00ffff' : (type === 'multi' ? '#ff00ff' : '#ffff00');
    }
    update(ts) { this.y += this.vy * ts; }
    draw() {
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.label, this.x, this.y + 5);
        ctx.shadowBlur = 0;
    }
}

class Platform {
    constructor() {
        const isMobile = (window.innerWidth <= 600) || ('ontouchstart' in window);
        this.initialWidth = isMobile ? 160 : 120; // Scaled down for high-density look
        this.width = this.initialWidth;
        this.height = isMobile ? 10 : 15;
        this.x = (BASE_WIDTH - this.width) / 2;
        this.y = isMobile ? 570 : 560; // Pushed further down for more space
        const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff41', '#ff0040', '#0070ff', '#ff8c00'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.vel = 14;
        this.targetWidth = this.width;
    }
    update(keys, touchX, ts) {
        let movingWithKeys = false;
        if ((keys['KeyA'] || keys['ArrowLeft']) && this.x > 0) {
            this.x -= this.vel * ts;
            movingWithKeys = true;
        }
        if ((keys['KeyD'] || keys['ArrowRight']) && this.x < BASE_WIDTH - this.width) {
            this.x += this.vel * ts;
            movingWithKeys = true;
        }

        // Only use touch/mouse if not actively moving with keys
        if (!movingWithKeys && touchX !== null) {
            this.x = touchX - this.width / 2;
        }

        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x > BASE_WIDTH - this.width) this.x = BASE_WIDTH - this.width;

        if (this.width < this.targetWidth) this.width += 2 * ts;
        if (this.width > this.targetWidth) this.width -= 1 * ts;
    }
    draw() {
        ctx.fillStyle = game.mode === 'modern' ? '#ff8c42' : this.color;
        ctx.shadowBlur = game.mode === 'modern' ? 0 : 15; ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        if (game.mode !== 'modern') {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(this.x, this.y, this.width, 5);
        }
        ctx.shadowBlur = 0;
    }
    get rect() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

class Ball {
    constructor(x, y, dx, dy) {
        this.radius = game.mode === 'modern' ? 8 : 5; // Larger ball for modern visibility
        this.x = x || BASE_WIDTH / 2;
        this.y = y || 550; // Starts closer to the slider area
        this.velx = dx !== undefined ? dx : (Math.random() - 0.5) * 8;
        this.vely = dy !== undefined ? dy : -7; // Moves upwards towards the top fast

        // Difficulty scaling: speed up ball based on level
        const speedBoost = 1 + (game.level - 1) * DIFFICULTY_BALL_SPEED_INC;
        this.velx *= speedBoost;
        this.vely *= speedBoost;

        this.speed = Math.sqrt(this.velx ** 2 + this.vely ** 2);
    }
    update(ts) {
        this.x += this.velx * ts;
        this.y += this.vely * ts;

        // Wall collisions
        if (this.x - this.radius <= 0) { this.x = this.radius; this.velx = Math.abs(this.velx); game.shake = 5; sfx.hitWall(); }
        if (this.x + this.radius >= BASE_WIDTH) { this.x = BASE_WIDTH - this.radius; this.velx = -Math.abs(this.velx); game.shake = 5; sfx.hitWall(); }
        if (this.y - this.radius <= 0) { this.y = this.radius; this.vely = Math.abs(this.vely); game.shake = 5; sfx.hitWall(); }
    }
    normalize() {
        const currentSpeed = Math.sqrt(this.velx ** 2 + this.vely ** 2);
        if (currentSpeed === 0) { this.vely = -this.speed; return; }
        const ratio = this.speed / currentSpeed;
        this.velx *= ratio;
        this.vely *= ratio;

        // Prevent too horizontal movement (minimum 15% vertical)
        const minVely = this.speed * 0.15;
        if (Math.abs(this.vely) < minVely) {
            this.vely = (this.vely < 0 ? -1 : 1) * minVely;
            // Re-normalize to keep exact speed
            const newVelx = Math.sqrt(this.speed ** 2 - this.vely ** 2) * (this.velx < 0 ? -1 : 1);
            this.velx = newVelx;
        }
    }
    draw() {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Block {
    constructor(x, y, width, height, type) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.type = type;
        this.hits = type === 2 ? Infinity : (type === 'heart' ? 1 : type);
        this.colors = [
            '#ff00ff', '#00ff41', '#ff0040', '#ffff00', '#00ffff',
            '#ff8c00', '#a020f0', '#32cd32', '#ff1493', '#0000ff',
            '#ffffff', '#808080', '#008080', '#ffa500', '#ee82ee'
        ];
        this.color = this.colors[(Math.floor(y / 40) + Math.floor(x / 100)) % this.colors.length];
    }
    draw() {
        if (game.mode === 'modern') {
            if (this.type === 2) {
                // Metallic Silver for Steel Walls
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 1;
                ctx.strokeRect(this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
            // No stroke or shine for modern pixel look
        } else {
            ctx.fillStyle = this.hits >= 2 ? '#b0b0b0' : this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(this.x, this.y, this.width, 4);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            if (this.hits >= 2) {
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + this.width, this.y + this.height); ctx.stroke();
            }
        }
    }
}

const game = {
    platform: null, balls: [], blocks: [], particles: [], powerups: [],
    score: 0, level: 1, unlockedLevel: 1, lives: 10, keys: {}, touchX: null,
    running: false, paused: false, shake: 0, powerupTimer: null,
    ballSpawnTimer: 0, // Timer for Modern Mode ball shower
    mode: 'classic', // 'classic' or 'modern'

    init() {
        this.loadProgress();
        sfx.init();

        // Firebase Auth State Listener
        setTimeout(() => {
            if (window.firebaseAuth) {
                window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, async (user) => {
                    this.user = user;
                    this.updateAuthUI();
                    if (user) {
                        await this.loadFromFirebase();
                        // If we are already in level select, refresh it
                        const levelSelect = document.getElementById('level-select-screen');
                        if (!levelSelect.classList.contains('hidden')) {
                            this.showLevelSelect();
                        }
                    }
                });
            }
        }, 1000);

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            // Prevent scrolling with arrows
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
            if (e.code === 'Escape' || e.code === 'KeyP') {
                this.togglePause();
            }
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        // Touch events
        canvas.addEventListener('touchstart', e => this.handleTouch(e), { passive: false });
        canvas.addEventListener('touchmove', e => this.handleTouch(e), { passive: false });
        canvas.addEventListener('touchend', () => { this.touchX = null; }, { passive: false });

        // Mouse events (for desktop drag/move)
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.touchX = (e.clientX - rect.left) * (BASE_WIDTH / rect.width);
        });
        canvas.addEventListener('mouseleave', () => { this.touchX = null; });

        this.showOverlay('start-screen');
    },

    handleTouch(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        this.touchX = (touch.clientX - rect.left) * (BASE_WIDTH / rect.width);
    },

    start(level = 1) {
        this.level = level;
        if (level === 1) this.score = 0;
        this.lives = 10; // 10 lives for easy mode
        this.setupLevel();
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        this.hideOverlays();
        document.getElementById('ui-layer').classList.remove('hidden');
        requestAnimationFrame(() => this.loop());
    },

    togglePause() {
        if (!this.running && !this.paused) return;
        this.paused = !this.paused;
        if (this.paused) {
            this.showOverlay('pause-screen');
        } else {
            this.hideOverlays();
            this.lastTime = performance.now();
            requestAnimationFrame(() => this.loop());
        }
    },

    nextLevel() {
        this.level++;
        if (this.level > MAX_LEVELS) {
            this.winGame();
        } else {
            this.setupLevel();
            this.running = true;
            this.paused = false;
            this.lastTime = performance.now();
            this.hideOverlays();
            document.getElementById('ui-layer').classList.remove('hidden');
            requestAnimationFrame(() => this.loop());
        }
    },

    loadProgress() {
        const key = `arkanoid_unlocked_level_${this.mode}`;
        const saved = localStorage.getItem(key);
        this.unlockedLevel = saved ? parseInt(saved) : 1;
    },

    saveProgress() {
        if (this.level >= this.unlockedLevel) {
            this.unlockedLevel = Math.min(MAX_LEVELS, this.level + 1);
            const key = `arkanoid_unlocked_level_${this.mode}`;
            localStorage.setItem(key, this.unlockedLevel);
            if (this.user) {
                this.saveToFirebase();
            }
        }
    },

    showLevelSelect() {
        this.running = false;
        this.paused = false;
        this.showOverlay('level-select-screen');
        document.getElementById('ui-layer').classList.add('hidden');
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        for (let i = 1; i <= MAX_LEVELS; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            if (i > this.unlockedLevel) btn.classList.add('locked');
            if (i === this.level) btn.classList.add('current');
            btn.textContent = i;
            btn.onclick = () => {
                if (i <= this.unlockedLevel) {
                    this.start(i);
                }
            };
            grid.appendChild(btn);
        }
    },

    showStartScreen() {
        this.running = false;
        this.paused = false;
        this.showOverlay('start-screen');
        document.getElementById('ui-layer').classList.add('hidden');
    },

    selectMode(mode) {
        this.mode = mode;
        document.body.classList.toggle('modern-theme', mode === 'modern');
        document.getElementById('game-container').classList.toggle('modern-theme', mode === 'modern');
        this.loadProgress();
        this.showLevelSelect();
    },

    // --- Firebase Auth & Sync ---
    authMode: 'login', // 'login' or 'signup'

    showAuthMenu() {
        this.showOverlay('auth-screen');
    },

    toggleAuthMode(event) {
        this.authMode = this.authMode === 'login' ? 'signup' : 'login';
        document.getElementById('auth-title').textContent = this.authMode.toUpperCase();
        document.getElementById('primary-auth-btn').textContent = this.authMode.toUpperCase();
        if (event && event.target) {
            event.target.textContent = this.authMode === 'login' ? 'GO TO SIGNUP' : 'GO TO LOGIN';
        }
    },

    async handleAuth(token) {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        if (!email || !password) {
            if (window.grecaptcha) window.grecaptcha.reset();
            return alert('Enter email and password');
        }

        if (!token) {
            // If called without token (e.g. manually), trigger recaptcha
            if (window.grecaptcha) window.grecaptcha.execute();
            return;
        }

        try {
            if (this.authMode === 'login') {
                await window.firebaseAuth.signInWithEmailAndPassword(window.firebaseAuth.auth, email, password);
            } else {
                await window.firebaseAuth.createUserWithEmailAndPassword(window.firebaseAuth.auth, email, password);
            }
            this.showStartScreen();
        } catch (err) {
            alert(err.message);
            if (window.grecaptcha) window.grecaptcha.reset();
        }
    },

    async logout() {
        await window.firebaseAuth.signOut(window.firebaseAuth.auth);
        this.unlockedLevel = 1;
        localStorage.setItem('arkanoid_unlocked_level', 1);
        this.showStartScreen();
    },

    updateAuthUI() {
        const authBtn = document.getElementById('auth-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userDisplay = document.getElementById('user-display');
        const loginHint = document.getElementById('login-hint');

        if (this.user) {
            authBtn.classList.add('hidden');
            if (loginHint) loginHint.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            userDisplay.classList.remove('hidden');
            userDisplay.textContent = `PLAYER: ${this.user.email}`;
        } else {
            authBtn.classList.remove('hidden');
            if (loginHint) loginHint.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            userDisplay.classList.add('hidden');
        }
    },

    async saveToFirebase() {
        if (!this.user || !window.firebaseDb) return;
        try {
            const userDoc = window.firebaseFirestore.doc(window.firebaseDb, "users", this.user.uid);
            const data = {
                score: this.score,
                lastUpdated: Date.now()
            };
            data[`unlockedLevel_${this.mode}`] = this.unlockedLevel;
            await window.firebaseFirestore.setDoc(userDoc, data, { merge: true });
        } catch (e) { console.error("Firebase Save Error", e); }
    },

    async loadFromFirebase() {
        if (!this.user || !window.firebaseDb) return;
        try {
            const userDoc = window.firebaseFirestore.doc(window.firebaseDb, "users", this.user.uid);
            const docSnap = await window.firebaseFirestore.getDoc(userDoc);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const modeKey = `unlockedLevel_${this.mode}`;
                if (data[modeKey] && data[modeKey] > this.unlockedLevel) {
                    this.unlockedLevel = data[modeKey];
                    localStorage.setItem(`arkanoid_unlocked_level_${this.mode}`, this.unlockedLevel);
                    // Refresh current view if needed
                    if (this.unlockedLevel > 1) {
                        console.log("Progress loaded from Firebase: Level", this.unlockedLevel);
                    }
                }
            }
        } catch (e) { console.error("Firebase Load Error", e); }
    },

    setupLevel() {
        this.platform = new Platform();
        this.balls = [new Ball()];
        this.powerups = []; this.particles = [];
        this.ballSpawnTimer = 0; // Reset shower timer
        this.currentConfig = this.mode === 'classic' ? generateLevelConfig(this.level) : generateModernLevel(this.level);
        this.createBlocks();
        this.updateUI();
        clearTimeout(this.powerupTimer);

        // Reset twist-related values
        this.twistTime = 0;
        this.windForce = 0;
        if (this.currentConfig.twist === 'wind_force') {
            this.windForce = (Math.random() - 0.5) * 0.1;
        }
    },

    createBlocks() {
        this.blocks = [];
        const config = this.currentConfig;
        const isMobile = (window.innerWidth <= 600) || ('ontouchstart' in window);

        // Add vertical padding for the "wall design" in classic mode
        const vPadding = this.mode === 'classic' ? 2 : 0;
        const effectiveCols = config.cols + (this.mode === 'classic' ? 2 : 0);

        const blockW = (BASE_WIDTH / effectiveCols) - 1;
        // Ultra-thin bricks for "full-stop" look (Modern: 4px, Classic: 14-22px)
        const blockH = this.mode === 'modern' ? (isMobile ? 3 : 4) : (isMobile ? 14 : 22);
        const yOffset = this.mode === 'modern' ? 40 : 60;

        for (let r = 0; r < config.rows; r++) {
            for (let c = 0; c < config.cols; c++) {
                let type = config.pattern(r, c);

                // Add border walls for classic mode here, modern handles it in generateModernLevel
                let finalC = c;
                if (this.mode === 'classic') {
                    finalC = c + 1; // Shift content right
                }

                if (type !== 0) {
                    const block = new Block(finalC * (blockW + 1) + 1, r * (blockH + 2) + yOffset, blockW, blockH, type);
                    if (this.mode === 'modern') {
                        if (type === "heart") block.color = "#ff1493";
                        else if (type === 2) block.color = "#bdc3c7";
                        else {
                            const ratio = r / config.rows;
                            if (ratio < 0.3) block.color = "#4b0082";
                            else if (ratio < 0.6) block.color = "#ff0080";
                            else if (ratio < 0.8) block.color = "#ff4500";
                            else block.color = "#ffd700";
                        }
                    }
                    this.blocks.push(block);
                }
            }
        }

        // Add physical walls for Classic Mode
        if (this.mode === 'classic') {
            const wallRows = config.rows;
            for (let r = 0; r < wallRows; r++) {
                this.blocks.push(new Block(1, r * (blockH + 2) + yOffset, blockW, blockH, 2)); // Left
                this.blocks.push(new Block((effectiveCols - 1) * (blockW + 2) + 1, r * (blockH + 2) + yOffset, blockW, blockH, 2)); // Right
            }
            // Top wall
            for (let c = 0; c < effectiveCols; c++) {
                this.blocks.push(new Block(c * (blockW + 2) + 1, yOffset - (blockH + 2), blockW, blockH, 2));
            }
        }
    },

    updateUI() {
        scoreElement.textContent = this.score;
        levelElement.textContent = this.level;
        livesElement.textContent = this.lives;

        // Hide/Show standard stats based on mode
        const statsGroup = document.getElementById('stats-group');
        if (this.mode === 'modern') {
            statsGroup.style.opacity = '0'; // We use Canvas HUD
        } else {
            statsGroup.style.opacity = '1';
        }
    },

    spawnParticles(x, y, color) { for (let i = 0; i < 15; i++) this.particles.push(new Particle(x, y, color)); },

    spawnPowerUp(x, y) {
        if (Math.random() < 0.15) {
            const types = ['expand', 'multi', 'speed'];
            this.powerups.push(new PowerUp(x, y, types[Math.floor(Math.random() * types.length)]));
        }
    },

    applyPowerUp(type) {
        if (type === 'expand') {
            this.platform.targetWidth = 220;
            clearTimeout(this.powerupTimer);
            this.powerupTimer = setTimeout(() => this.platform.targetWidth = this.platform.initialWidth, 10000);
        } else if (type === 'multi') {
            const b = this.balls[0] || { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 };
            this.balls.push(new Ball(b.x, b.y, 5, -5), new Ball(b.x, b.y, -5, -5));
        } else if (type === 'speed') {
            this.balls.forEach(b => { b.velx *= 1.3; b.vely *= 1.3; });
            setTimeout(() => this.balls.forEach(b => { b.velx /= 1.3; b.vely /= 1.3; }), 5000);
        }
        sfx.powerup();
        this.score += 100;
        this.updateUI();
    },

    handleBallLoss() {
        if (this.balls.length > 0) return;
        this.lives--; this.updateUI();
        this.shake = 15;
        sfx.lose();
        if (this.lives <= 0) this.gameOver();
        else {
            this.balls = [new Ball()];
            this.platform.targetWidth = this.platform.initialWidth;
            this.powerups = [];
        }
    },

    gameOver() {
        this.running = false;
        document.getElementById('ui-layer').classList.add('hidden');
        document.getElementById('final-score-lose').textContent = this.score;
        this.showOverlay('game-over-screen');
    },

    win() {
        this.running = false;
        this.saveProgress();
        sfx.win();
        document.getElementById('ui-layer').classList.add('hidden');
        this.showOverlay('level-complete-screen');
    },

    winGame() {
        this.running = false;
        document.getElementById('ui-layer').classList.add('hidden');
        document.getElementById('final-score-win').textContent = this.score;
        this.showOverlay('win-screen');
    },

    loop() {
        if (!this.running || this.paused) return;

        const now = performance.now();
        const dt = now - (this.lastTime || now);
        this.lastTime = now;
        // Baseline: 60fps = 16.67ms. timeScale = dt / 16.67
        const ts = Math.min(dt / 16.67, 3); // Cap timeScale to prevent huge leaps

        let offsetX = (Math.random() - 0.5) * this.shake;
        let offsetY = (Math.random() - 0.5) * this.shake;
        if (this.shake > 0) this.shake *= 0.85;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -20, BASE_WIDTH + 40, BASE_HEIGHT + 40);

        // Draw Game Boundary
        ctx.strokeStyle = game.mode === 'modern' ? 'rgba(255,255,255,0.1)' : 'rgba(0,255,65,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        this.platform.update(this.keys, this.touchX, ts);
        this.platform.draw();

        // Modern Mode: Ball Shower (7 balls every 7 seconds)
        if (this.mode === 'modern' && this.running && !this.paused) {
            this.ballSpawnTimer += 0.016 * ts;
            if (this.ballSpawnTimer >= 7) {
                this.ballSpawnTimer = 0;
                const breakableBlocks = this.blocks.filter(b => b.hits !== Infinity);
                if (breakableBlocks.length > 0) {
                    const count = Math.min(7, breakableBlocks.length);
                    // Shuffle or pick random blocks
                    const shuffled = breakableBlocks.sort(() => 0.5 - Math.random());
                    for (let i = 0; i < count; i++) {
                        const target = shuffled[i];
                        this.balls.push(new Ball(target.x + target.width / 2, target.y + target.height / 2, (Math.random() - 0.5) * 10, 5));
                    }
                    sfx.powerup(); // Use powerup sound for shower start
                }
            }
        }

        // Apply Twists
        this.twistTime += 0.016 * ts; // Approx time per frame
        const twist = this.currentConfig.twist;

        if (twist === 'ball_gravity') {
            this.balls.forEach(b => { b.vely += 0.05 * ts; b.normalize(); });
        } else if (twist === 'wind_force') {
            this.balls.forEach(b => { b.velx += this.windForce * ts; b.normalize(); });
        } else if (twist === 'jittery_ball' && Math.random() < 0.05) {
            this.balls.forEach(b => {
                b.velx += (Math.random() - 0.5) * 0.5 * ts;
                b.vely += (Math.random() - 0.5) * 0.5 * ts;
                b.normalize();
            });
        } else if (twist === 'speed_pulse') {
            const pulse = 1 + Math.sin(this.twistTime * 2) * 0.3;
            this.balls.forEach(b => {
                const currentSpeed = Math.sqrt(b.velx ** 2 + b.vely ** 2);
                const targetSpeed = b.speed * pulse;
                const ratio = targetSpeed / (currentSpeed || 1);
                b.velx *= ratio;
                b.vely *= ratio;
            });
        } else if (twist === 'moving_paddle_shrink') {
            if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.keys['KeyD'] || this.keys['ArrowRight'] || this.touchX !== null) {
                if (this.platform.width > 60) this.platform.width -= 0.1 * ts;
                this.platform.targetWidth = this.platform.width;
            }
        } else if (twist === 'fast_ball') {
            this.balls.forEach(b => {
                if (!b.speedBoosted) {
                    b.velx *= 1.3;
                    b.vely *= 1.3;
                    b.speedBoosted = true;
                }
            });
        }

        if (twist === 'shifting_colors') {
            this.blocks.forEach(b => {
                const colors = ['#ff00ff', '#00ff41', '#ff0040', '#ffff00', '#00ffff'];
                if (Math.random() < 0.01) {
                    b.color = colors[Math.floor(Math.random() * colors.length)];
                }
            });
        }

        // Update Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i]; p.update(ts); p.draw();
            const plat = this.platform.rect;
            if (p.y + p.height / 2 >= plat.y && p.y - p.height / 2 <= plat.y + plat.height &&
                p.x + p.width / 2 >= plat.x && p.x - p.width / 2 <= plat.x + plat.width) {
                this.applyPowerUp(p.type);
                this.powerups.splice(i, 1);
                continue;
            }
            if (p.y > BASE_HEIGHT + 50) this.powerups.splice(i, 1);
        }

        // Update Balls with Physics Sub-stepping (to prevent tunneling)
        const subSteps = 4;
        const subTs = ts / subSteps;

        for (let step = 0; step < subSteps; step++) {
            for (let i = this.balls.length - 1; i >= 0; i--) {
                const ball = this.balls[i];
                ball.update(subTs);
                const p = this.platform.rect;

                // Platform collision
                if (ball.y + ball.radius >= p.y && ball.y - ball.radius <= p.y + p.height &&
                    ball.x >= p.x && ball.x <= p.x + p.width && ball.vely > 0) {
                    ball.y = p.y - ball.radius;
                    const hitPos = (ball.x - (p.x + p.width / 2)) / (p.width / 2);
                    const maxAngle = Math.PI / 3;
                    const angle = hitPos * maxAngle;
                    ball.velx = ball.speed * Math.sin(angle);
                    ball.vely = -ball.speed * Math.cos(angle);
                    this.shake = 4;
                    sfx.hitPaddle();
                }

                // Block/Wall collisions (Strict logic)
                for (let j = this.blocks.length - 1; j >= 0; j--) {
                    const b = this.blocks[j];
                    let closestX = Math.max(b.x, Math.min(ball.x, b.x + b.width));
                    let closestY = Math.max(b.y, Math.min(ball.y, b.y + b.height));
                    let distanceX = ball.x - closestX;
                    let distanceY = ball.y - closestY;
                    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

                    if (distanceSquared < (ball.radius * ball.radius)) {
                        const isSteelWall = b.hits === Infinity;
                        const shouldBounce = (this.mode === 'classic') || isSteelWall;

                        if (shouldBounce) {
                            let overlapX = ball.radius - Math.abs(distanceX);
                            let overlapY = ball.radius - Math.abs(distanceY);

                            if (overlapX < overlapY) {
                                ball.velx = distanceX > 0 ? Math.abs(ball.velx) : -Math.abs(ball.velx);
                                ball.x += distanceX > 0 ? overlapX : -overlapX;
                            } else {
                                ball.vely = distanceY > 0 ? Math.abs(ball.vely) : -Math.abs(ball.vely);
                                ball.y += distanceY > 0 ? overlapY : -overlapY;
                            }
                        }

                        if (b.hits !== Infinity) {
                            sfx.hitBrick();
                            b.hits--;
                            if (b.hits <= 0) {
                                this.spawnParticles(b.x + b.width / 2, b.y + b.height / 2, b.color);
                                this.spawnPowerUp(b.x + b.width / 2, b.y + b.height / 2);
                                this.blocks.splice(j, 1);
                                this.score += 20;
                            } else {
                                this.spawnParticles(ball.x, ball.y, '#fff');
                                this.score += 5;
                            }
                            this.updateUI();
                            this.shake = 6;
                        } else {
                            sfx.hitWall();
                            this.shake = 2;
                        }
                        break;
                    }
                }

                if (ball.y > BASE_HEIGHT + 20) {
                    this.balls.splice(i, 1);
                }
            }
        }

        // Check for ball loss AFTER all sub-steps
        if (this.balls.length === 0 && this.running) {
            this.handleBallLoss();
        }

        this.balls.forEach(b => b.draw());

        if (this.blocks.filter(b => b.hits !== Infinity).length === 0 && this.running) this.win();

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(ts); this.particles[i].draw();
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        this.blocks.forEach(b => {
            if (twist === 'invisible_bricks') {
                const minDist = Math.min(...this.balls.map(ball => {
                    const dx = ball.x - (b.x + b.width / 2);
                    const dy = ball.y - (b.y + b.height / 2);
                    return Math.sqrt(dx * dx + dy * dy);
                }));
                if (minDist < 150) {
                    ctx.globalAlpha = Math.max(0, 1 - (minDist / 150));
                    b.draw();
                    ctx.globalAlpha = 1.0;
                }
            } else {
                b.draw();
            }
        });

        if (this.mode === 'modern') this.drawHUD();

        ctx.restore();
        requestAnimationFrame(() => this.loop());
    },

    drawHUD() {
        // Pixel Hearts Logic
        const drawPixelHeart = (x, y, scale = 2) => {
            ctx.fillStyle = '#ff1493'; // Deep pink
            const heart = [
                " 00 00 ",
                "0000000",
                "0000000",
                " 00000 ",
                "  000  ",
                "   0   "
            ];
            heart.forEach((row, r) => {
                [...row].forEach((char, c) => {
                    if (char === '0') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
                });
            });
        };

        // Draw lives as hearts in top right
        for (let i = 0; i < this.lives; i++) {
            drawPixelHeart(BASE_WIDTH - 40 - i * 35, 20, 4);
        }

        // Mini score and level indicator
        ctx.fillStyle = '#fff';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${this.score}`, 20, 35);
        ctx.fillText(`LVL: ${this.level}`, 20, 55);
    },

    showOverlay(id) { this.hideOverlays(); document.getElementById(id).classList.remove('hidden'); },
    hideOverlays() { document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden')); }
};

game.init();
