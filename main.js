/*
 * Loy Krathong Interactive Web Application - main.js (FIXED VERSION)
 *
 * This file contains all the game logic, animation, and event handlers.
 * All DOM manipulation and event listeners are wrapped in a DOMContentLoaded
 * listener to prevent "Cannot set properties of null" errors due to race conditions.
 *
 * FIXES APPLIED:
 * 1. Removed duplicate KRATHONG_COUNT declaration
 * 2. Moved resizeCanvas() out of gameLoop for better performance
 * 3. Fixed path for kt5.png in service worker
 * 4. Improved responsive canvas scaling
 * 5. Better krathong management (reuse when off-screen)
 * 6. Limited fireworks count to prevent performance issues
 */

// Constants
const CANVAS_ID = 'scene';
const KRATHONG_COUNT = 5; // FIXED: Removed duplicate declaration
const KRATHONG_SPACING = 300;
const KRATHONG_SPEED = 1.5;
const TUKTUK_SPEED = 4.0;
const FIREWORK_COUNT = 10;
const MAX_FIREWORKS = 20; // FIXED: Limit total fireworks

const ROAD_OFFSET_FROM_BOTTOM = 200;
const WATER_LEVEL_OFFSET = 100;

// Global Variables
let canvas, ctx;
let width, height;
let krathongs = [];
let waterLevel = 0;
let tuktuk = { x: -100, y: 0, image: null, width: 150, height: 100 };
let fireworks = [];
let lastTime = 0;
let isMusicPlaying = false;
let isLaunched = false;
let krathongCounter = 0;
let wishes = [];

// FIXED: Cached values for performance
let cachedScaleFactor = 1;
let cachedEffectiveWidth = 0;
let cachedEffectiveHeight = 0;
let cachedXOffset = 0;
let cachedYOffset = 0;

const FIXED_FIREWORK_POSITIONS = [
    { x: 0.2 * 1920, y: 0.2 * 1080 },
    { x: 0.5 * 1920, y: 0.1 * 1080 },
    { x: 0.8 * 1920, y: 0.2 * 1080 }
];
let fireworkTimer = 0;
const FIREWORK_INTERVAL = 5000;

// Assets
const assets = {
    tuktuk: 'images/tuktuk.png',
    song: 'audio/song.mp3',
    fireworkLogo: 'images/logo.png', // FIXED: Use logo.png instead
    krathongs: []
};

for (let i = 1; i <= KRATHONG_COUNT; i++) {
    assets.krathongs.push(`images/kt${i}.png`);
}

let loadedAssets = 0;
const totalAssets = 1 + assets.krathongs.length + 1 + 1;

// Utility Functions
function haptic() {
    if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }
}

function showToast() {
    const toastEl = document.getElementById('toast');
    if (toastEl) {
        toastEl.textContent = 'คำอธิษฐานของคุณถูกส่งไปแล้ว';
        toastEl.classList.add('show');
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, 3000);
    }
}

// FIXED: Improved resizeCanvas with caching
function resizeCanvas() {
    canvas = document.getElementById(CANVAS_ID);
    if (!canvas) return;

    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 0;
    
    width = window.innerWidth;
    height = window.innerHeight - headerHeight;
    canvas.width = width;
    canvas.height = height;

    // Calculate background scaling (for 'contain' effect)
    const bgWidth = 1920;
    const bgHeight = 1080;
    const bgAspectRatio = bgWidth / bgHeight;

    if (width / height > bgAspectRatio) {
        cachedEffectiveHeight = height;
        cachedEffectiveWidth = height * bgAspectRatio;
        cachedXOffset = (width - cachedEffectiveWidth) / 2;
        cachedYOffset = 0;
    } else {
        cachedEffectiveWidth = width;
        cachedEffectiveHeight = width / bgAspectRatio;
        cachedXOffset = 0;
        cachedYOffset = (height - cachedEffectiveHeight) / 2;
    }

    cachedScaleFactor = cachedEffectiveHeight / bgHeight;

    // Calculate road position
    const roadPositionRatio = 0.82;
    const roadYInImage = bgHeight * roadPositionRatio;
    const roadYScreen = cachedYOffset + (roadYInImage * cachedScaleFactor);

    // Update tuktuk position
    if (tuktuk.image) {
        // FIXED: Scale tuktuk based on screen size
        const baseWidth = 150;
        const baseHeight = 100;
        tuktuk.width = baseWidth * Math.min(1, cachedScaleFactor);
        tuktuk.height = baseHeight * Math.min(1, cachedScaleFactor);
        tuktuk.y = roadYScreen - tuktuk.height + 10;
    }

    // Calculate water level
    const waterPositionRatio = 0.90;
    const waterYInImage = bgHeight * waterPositionRatio;
    waterLevel = cachedYOffset + (waterYInImage * cachedScaleFactor);

    // Update krathong positions and sizes
    krathongs.forEach(k => {
        const baseSize = 80;
        k.width = baseSize * Math.min(1, cachedScaleFactor);
        k.height = baseSize * Math.min(1, cachedScaleFactor);
        k.y = waterLevel - k.height / 2;
    });
}

// Krathong Class
class Krathong {
    constructor(id, image, wish) {
        this.id = id;
        this.image = image;
        this.wish = wish;
        this.width = 80;
        this.height = 80;
        this.x = -this.width - (id * KRATHONG_SPACING);
        this.y = waterLevel - this.height / 2;
        this.speed = KRATHONG_SPEED + (Math.random() * 0.2 - 0.1);
        this.waveOffset = Math.random() * Math.PI * 2;
    }

    update(deltaTime) {
        if (isLaunched) {
            this.x += this.speed * deltaTime * 0.01;
            this.y = waterLevel - this.height / 2 + Math.sin(this.waveOffset + this.x * 0.01) * 5;
            
            // FIXED: Reuse krathong when it goes off-screen
            if (this.x > width) {
                this.x = -this.width;
                // Reset wish to allow reuse
                this.wish = null;
            }
        }
    }

    draw() {
        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            
            if (this.wish) {
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(12, 16 * cachedScaleFactor)}px "TH Sarabun New", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                const maxLen = 15;
                const displayWish = this.wish.length > maxLen ? this.wish.substring(0, maxLen) + '...' : this.wish;

                const textX = this.x + this.width / 2;
                const textY = this.y - 15;
                
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 2;
                ctx.strokeText(displayWish, textX, textY);
                
                ctx.fillText(displayWish, textX, textY);
                ctx.restore();
            }
        }
    }
}

// Firework Class
class Firework {
    constructor(x, y, isFixed = false) {
        this.targetX = x;
        this.targetY = y;
        this.x = x;
        this.y = height;
        this.speed = 5;
        this.particles = [];
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.life = 0;
        this.maxLife = 100;
        this.exploded = false;
        this.isAscending = isFixed;
        this.isFixed = isFixed;
        this.logoImage = null;
        
        if (this.isFixed) {
            this.logoImage = new Image();
            this.logoImage.src = 'images/logo.png'; // FIXED: Use logo.png instead of no-smoking.png
        }
    }

    createParticles() {
        if (!this.isFixed) {
            const particleCount = 50;
            for (let i = 0; i < particleCount; i++) {
                this.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.random() * 4 - 2,
                    vy: Math.random() * 4 - 2,
                    alpha: 1,
                    size: Math.random() * 2 + 1
                });
            }
        }
        this.exploded = true;
    }

    update(deltaTime) {
        if (this.isAscending) {
            if (this.y > this.targetY) {
                this.y -= this.speed * deltaTime * 0.01;
            } else {
                this.isAscending = false;
                this.exploded = true;
                this.x = this.targetX;
            }
        } else if (this.exploded && !this.isFixed) {
            this.life += deltaTime * 0.01;
            this.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05;
                p.alpha -= 0.01;
            });
            this.particles = this.particles.filter(p => p.alpha > 0);
        } else if (this.exploded && this.isFixed) {
            this.life += 1;
        }
    }

    draw() {
        if (this.isAscending) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.exploded) {
            if (this.isFixed) {
                if (this.logoImage && this.logoImage.complete) {
                    const logoSize = 100 * cachedScaleFactor;
                    const alpha = Math.max(0, 1 - this.life / 100);
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(this.logoImage, this.x - logoSize / 2, this.y - logoSize / 2, logoSize, logoSize);
                    ctx.restore();
                }
            } else {
                this.particles.forEach(p => {
                    ctx.fillStyle = this.color;
                    ctx.globalAlpha = p.alpha;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
            }
        }
    }
}

// Load Assets
function loadAsset(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            loadedAssets++;
            updateLoadingStatus();
            resolve(img);
        };
        img.onerror = () => {
            loadedAssets++;
            updateLoadingStatus();
            console.error(`Failed to load asset: ${src}`);
            resolve(null);
        };
        img.src = src;
    });
}

function updateLoadingStatus() {
    const loadingEl = document.getElementById('loadInfo');
    if (loadingEl) {
        loadingEl.textContent = `กำลังเตรียมฉาก… โหลดแล้ว ${loadedAssets}/${totalAssets}`;
    }
}

async function loadAllAssets() {
    tuktuk.image = await loadAsset(assets.tuktuk);

    for (const src of assets.krathongs) {
        const img = await loadAsset(src);
        if (img) {
            krathongs.push(new Krathong(krathongs.length, img, null));
        }
    }

    const logoImg = await loadAsset(assets.fireworkLogo);
    if (logoImg) {
        FIXED_FIREWORK_POSITIONS.forEach(pos => {
            fireworks.push(new Firework(pos.x, pos.y, true));
        });
    }

    loadedAssets++;
    updateLoadingStatus();

    const splashEl = document.getElementById('splash');
    if (splashEl) {
        splashEl.classList.add('hide');
        setTimeout(() => {
            splashEl.style.display = 'none';
            requestAnimationFrame(gameLoop);
        }, 350);
    }
}

// Game Loop
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, width, height);

    drawWaterWaves(deltaTime);

    krathongs.forEach(k => {
        k.update(deltaTime);
        k.draw();
    });

    if (tuktuk.image) {
        tuktuk.x += TUKTUK_SPEED * deltaTime * 0.01;
        if (tuktuk.x > width) {
            tuktuk.x = -tuktuk.width;
        }
        ctx.drawImage(tuktuk.image, tuktuk.x, tuktuk.y, tuktuk.width, tuktuk.height);
    }

    // Fireworks
    fireworkTimer += deltaTime;
    if (fireworkTimer > FIREWORK_INTERVAL) {
        fireworkTimer = 0;
        // FIXED: Limit total fireworks
        if (fireworks.length < MAX_FIREWORKS) {
            const randomX = Math.random() * width;
            const randomY = Math.random() * height * 0.5;
            fireworks.push(new Firework(randomX, randomY, false));
        }
    }

    // FIXED: Update fixed firework positions using cached values
    fireworks.forEach(f => {
        if (f.isFixed) {
            f.x = cachedXOffset + (f.targetX * cachedScaleFactor);
            f.y = cachedYOffset + (f.targetY * cachedScaleFactor);
        }
        f.update(deltaTime);
        f.draw();
    });

    fireworks = fireworks.filter(f => f.isFixed || f.particles.length > 0 || f.isAscending);

    requestAnimationFrame(gameLoop);
}

// Draw Water Waves
function drawWaterWaves(deltaTime) {
    const waveHeight = 15;
    const waveLength = 80;
    const time = lastTime * 0.0003;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3;

    for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(0, waterLevel + i * 5);
        for (let x = 0; x < width; x++) {
            const y = waterLevel + i * 5 + Math.sin(x / waveLength + time * (i + 1) * 0.5) * waveHeight;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

// Event Listeners and Initialization
document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    // FIXED: Only call resizeCanvas on resize event, not in gameLoop
    window.addEventListener('resize', resizeCanvas);

    loadAllAssets();

    const bgm = document.getElementById('bgm');
    const tapMusicBtn = document.getElementById('tapMusic');
    
    if (tapMusicBtn) {
        tapMusicBtn.addEventListener('click', () => {
            if (bgm.paused) {
                bgm.play().catch(e => console.error("Music play failed:", e));
                tapMusicBtn.textContent = '⏸ หยุดเพลง';
            } else {
                bgm.pause();
                tapMusicBtn.textContent = '▶ เล่นเพลง';
            }
        });
    }

    const launchBtn = document.getElementById('launch');
    const wishInput = document.getElementById('wish');

    if (launchBtn) {
        launchBtn.addEventListener('click', () => {
            const wishText = wishInput.value.trim();
            if (!wishText) {
                alert("กรุณาพิมพ์คำอธิษฐานก่อนปล่อยกระทง");
                return;
            }

            // FIXED: Find first available krathong (including those that have been reused)
            let krathongToLaunch = krathongs.find(k => k.wish === null);

            if (krathongToLaunch) {
                krathongToLaunch.wish = wishText;
                isLaunched = true;
                showToast();
                wishInput.value = '';
                haptic();
            } else {
                alert("กระทงเต็มแล้ว! กรุณารอสักครู่");
            }
        });
    }
});
