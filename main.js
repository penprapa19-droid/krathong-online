/*
 * Loy Krathong Interactive Web Application - main.js
 *
 * This file contains all the game logic, animation, and event handlers.
 * All DOM manipulation and event listeners are wrapped in a DOMContentLoaded
 * listener to prevent "Cannot set properties of null" errors due to race conditions.
 */

// Constants
const CANVAS_ID = 'canvas';
const KRATHONG_COUNT = 5;
const KRATHONG_SPACING = 150; // Increased spacing for better visual separation
const KRATHONG_SPEED = 0.5;
const TUKTUK_SPEED = 1.5;
const FIREWORK_COUNT = 10;
const ROAD_OFFSET_FROM_BOTTOM = 450; // Adjusted for better positioning on the road
const WATER_FACTOR = 0.1; // Controls how much krathongs sink into the water

// Global Variables
let canvas, ctx;
let width, height;
let krathongs = [];
let tuktuk = { x: -100, y: 0, image: null, width: 150, height: 100 };
let fireworks = [];
let lastTime = 0;
let isMusicPlaying = false;
let isLaunched = false;
let krathongCounter = 0;
let wishes = [];

// Assets
const assets = {
    tuktuk: 'tuktuk.png',
    song: 'song.mp3',
    krathongs: []
};

for (let i = 1; i <= KRATHONG_COUNT; i++) {
    assets.krathongs.push(`kt${i}.png`);
}

let loadedAssets = 0;
const totalAssets = Object.keys(assets).length - 1 + assets.krathongs.length; // -1 for krathongs array, + krathongs.length

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

function resizeCanvas() {
    canvas = document.getElementById(CANVAS_ID);
    if (!canvas) return;

    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Recalculate tuktuk position based on new height
    if (tuktuk.image) {
        tuktuk.y = height - ROAD_OFFSET_FROM_BOTTOM - tuktuk.height + 2; // +2px to lift it slightly
    }

    // Recalculate krathong positions
    krathongs.forEach(k => {
        k.y = height - (height * WATER_FACTOR) - k.height / 2;
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
        this.x = width + (id * KRATHONG_SPACING); // Start off-screen with spacing
        this.y = height - (height * WATER_FACTOR) - this.height / 2; // Position in the water
        this.speed = KRATHONG_SPEED + (Math.random() * 0.2 - 0.1); // Slight speed variation
        this.waveOffset = Math.random() * Math.PI * 2; // Start at random point in wave cycle
    }

    update(deltaTime) {
        if (isLaunched) {
            this.x -= this.speed * deltaTime * 0.01;
            // Simple wave motion
            this.y = height - (height * WATER_FACTOR) - this.height / 2 + Math.sin(this.waveOffset + this.x * 0.01) * 5;
        }
    }

    draw() {
        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
    }
}

// Firework Class
class Firework {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.life = 0;
        this.maxLife = 100;
        this.exploded = false;
        this.createParticles();
    }

    createParticles() {
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: this.x,
                y: this.y,
                vx: Math.random() * 4 - 2,
                vy: Math.random() * 4 - 2,
                alpha: 1,
                size: Math.random() * 2 + 1
            });
        }
        this.exploded = true;
    }

    update(deltaTime) {
        if (this.exploded) {
            this.life += deltaTime * 0.01;
            this.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05; // Gravity
                p.alpha -= 0.01;
            });
            this.particles = this.particles.filter(p => p.alpha > 0);
        }
    }

    draw() {
        if (this.exploded) {
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

    isFinished() {
        return this.exploded && this.particles.length === 0;
    }
}

// Game Loop
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw water line (for visual reference)
    ctx.fillStyle = 'rgba(0, 0, 100, 0.3)';
    ctx.fillRect(0, height - (height * WATER_FACTOR), width, height * WATER_FACTOR);

    // Update and Draw Krathongs
    krathongs.forEach(k => {
        k.update(deltaTime);
        k.draw();
    });

    // Update and Draw TukTuk
    if (tuktuk.image) {
        if (tuktuk.x < width + tuktuk.width) {
            tuktuk.x += TUKTUK_SPEED * deltaTime * 0.01;
        } else {
            tuktuk.x = -tuktuk.width; // Loop the tuktuk
        }
        ctx.drawImage(tuktuk.image, tuktuk.x, tuktuk.y, tuktuk.width, tuktuk.height);
    }

    // Update and Draw Fireworks
    fireworks.forEach(f => {
        f.update(deltaTime);
        f.draw();
    });
    fireworks = fireworks.filter(f => !f.isFinished());

    // Spawn new fireworks randomly
    if (Math.random() < 0.005) {
        fireworks.push(new Firework(Math.random() * width, Math.random() * height * 0.5));
    }

    requestAnimationFrame(gameLoop);
}

// Asset Loading
function assetLoaded() {
    loadedAssets++;
    const progress = (loadedAssets / totalAssets) * 100;
    const progressEl = document.getElementById('loading-progress');
    if (progressEl) {
        progressEl.style.width = `${progress}%`;
    }

    if (loadedAssets === totalAssets) {
        initGame();
    }
}

function loadAssets() {
    // Load TukTuk
    tuktuk.image = new Image();
    tuktuk.image.onload = assetLoaded;
    tuktuk.image.src = assets.tuktuk;

    // Load Krathongs
    assets.krathongs.forEach((src, index) => {
        const img = new Image();
        img.onload = assetLoaded;
        img.src = src;
        krathongs.push(new Krathong(index, img, ''));
    });

    // Load Music
    const musicEl = document.getElementById('bg-music');
    if (musicEl) {
        musicEl.src = assets.song;
        musicEl.onloadeddata = assetLoaded;
    }
}

// Game Initialization
function initGame() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Hide splash screen
    const splashEl = document.getElementById('splash');
    if (splashEl) {
        splashEl.classList.add('hidden');
        setTimeout(() => {
            splashEl.style.display = 'none';
        }, 1000);
    }

    // Start the game loop
    requestAnimationFrame(gameLoop);
}

// Event Handlers
function launch(wish) {
    const wishInputContainer = document.getElementById('wish-input-container');
    if (wishInputContainer) {
        wishInputContainer.style.display = 'none';
    }

    // Create a new krathong with the wish
    const krathongImage = krathongs[krathongCounter % KRATHONG_COUNT].image;
    const newKrathong = new Krathong(krathongs.length, krathongImage, wish);
    newKrathong.x = width + 50; // Start just off-screen
    krathongs.push(newKrathong);
    krathongCounter++;
    wishes.push({ id: newKrathong.id, wish: wish, timestamp: new Date().toISOString() });

    isLaunched = true;

    // Play music if not playing
    const musicEl = document.getElementById('bg-music');
    if (musicEl && !isMusicPlaying) {
        musicEl.play().then(() => {
            isMusicPlaying = true;
            updateMusicButton();
        }).catch(error => {
            console.error("Music playback failed:", error);
        });
    }
}

function resetGame() {
    krathongs = [];
    wishes = [];
    krathongCounter = 0;
    tuktuk.x = -tuktuk.width;
    isLaunched = false;
    fireworks = [];
    haptic();
}

function toggleMusic() {
    const musicEl = document.getElementById('bg-music');
    if (musicEl) {
        if (isMusicPlaying) {
            musicEl.pause();
        } else {
            musicEl.play().catch(error => {
                console.error("Music playback failed:", error);
            });
        }
        isMusicPlaying = !isMusicPlaying;
        updateMusicButton();
        haptic();
    }
}

function updateMusicButton() {
    const btnMusic = document.getElementById('btn-music');
    if (btnMusic) {
        btnMusic.textContent = `เพลง: ${isMusicPlaying ? 'ปิด' : 'เปิด'}`;
    }
}

function exportCSV() {
    if (wishes.length === 0) {
        alert('ยังไม่มีคำอธิษฐานที่ถูกปล่อย');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Wish,Timestamp\n";
    wishes.forEach(w => {
        // Simple CSV escaping for wishes
        const escapedWish = w.wish.replace(/"/g, '""');
        csvContent += `${w.id},"${escapedWish}",${w.timestamp}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "loy_krathong_wishes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    haptic();
}

/* ===== DOMContentLoaded: Main Entry Point ===== */
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById(CANVAS_ID);
    if (canvas) {
        ctx = canvas.getContext('2d');
    }

    // Get DOM elements
    const wishEl = document.getElementById('wish-input');
    const wishInputContainer = document.getElementById('wish-input-container');

    // Launch button (inside wish-input-container)
    const launchEl = document.getElementById('launch');
    if (launchEl) {
        launchEl.onclick = () => {
            launch(wishEl ? wishEl.value || "" : "");
            if (wishEl) wishEl.value = "";
            showToast();
            haptic();
        };
    }

    // Header buttons
    const btnLaunchHeader = document.getElementById('btn-launch-header');
    if (btnLaunchHeader) {
        btnLaunchHeader.onclick = () => {
            if (wishInputContainer) {
                wishInputContainer.style.display = 'flex';
            }
            haptic();
        };
    }

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.onclick = resetGame;
    }

    const btnMusic = document.getElementById('btn-music');
    if (btnMusic) {
        btnMusic.onclick = toggleMusic;
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.onclick = exportCSV;
    }

    // Mobile Bar buttons (redundant but kept for completeness, though mobileBar is hidden by CSS)
    const btnLaunchMobile = document.getElementById('btn-launch-mobile');
    if (btnLaunchMobile) {
        btnLaunchMobile.onclick = () => {
            if (wishInputContainer) {
                wishInputContainer.style.display = 'flex';
            }
            haptic();
        };
    }

    const btnResetMobile = document.getElementById('btn-reset-mobile');
    if (btnResetMobile) {
        btnResetMobile.onclick = resetGame;
    }

    const btnMusicMobile = document.getElementById('btn-music-mobile');
    if (btnMusicMobile) {
        btnMusicMobile.onclick = toggleMusic;
    }

    const btnExportMobile = document.getElementById('btn-export-mobile');
    if (btnExportMobile) {
        btnExportMobile.onclick = exportCSV;
    }

    // Initial music button state
    updateMusicButton();

    // Start loading assets
    loadAssets();
});
