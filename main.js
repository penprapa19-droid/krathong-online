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
// Adjusted ROAD_OFFSET_FROM_BOTTOM to lift the tuktuk above the red area
const ROAD_OFFSET_FROM_BOTTOM = 250; // Further adjusted to be above the red area (approx. 250px from bottom)
const WATER_LEVEL_OFFSET = 100; // Adjusted water level to be lower (approx. 100px from bottom)

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

// Fixed firework positions (normalized to 0-1000 for responsive calculation)
const FIXED_FIREWORK_POSITIONS = [
    { x: 200, y: 200 }, // Left
    { x: 500, y: 100 }, // Center
    { x: 800, y: 200 }  // Right
];
let fireworkTimer = 0;
const FIREWORK_INTERVAL = 5000; // 5 seconds between fixed firework bursts

// Assets
const assets = {
    tuktuk: 'images/tuktuk.png', // Corrected path
    song: 'audio/song.mp3', // Assuming audio is in 'audio/' folder
    krathongs: []
};

for (let i = 1; i <= KRATHONG_COUNT; i++) {
    assets.krathongs.push(`images/kt${i}.png`); // Corrected path
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
        // Tuktuk should be positioned on the road, which is above the water line
        tuktuk.y = height - ROAD_OFFSET_FROM_BOTTOM - tuktuk.height + 2; // +2px to lift it slightly
    }

    // Recalculate krathong positions
    krathongs.forEach(k => {
        // Krathongs should be positioned at the water level
        k.y = height - WATER_LEVEL_OFFSET - k.height / 2;
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
        this.x = -this.width - (id * KRATHONG_SPACING); // Start off-screen LEFT (Issue 5)
        this.y = height - WATER_LEVEL_OFFSET - this.height / 2; // Position in the water
        this.speed = KRATHONG_SPEED + (Math.random() * 0.2 - 0.1); // Slight speed variation
        this.waveOffset = Math.random() * Math.PI * 2; // Start at random point in wave cycle
    }

    update(deltaTime) {
        if (isLaunched) {
            this.x += this.speed * deltaTime * 0.01; // Move from LEFT to RIGHT (Issue 5)
            // Simple wave motion
            this.y = height - WATER_LEVEL_OFFSET - this.height / 2 + Math.sin(this.waveOffset + this.x * 0.01) * 5;
            
            // Loop krathong when it goes off-screen right
            if (this.x > width) {
                this.x = -this.width;
            }
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
    constructor(x, y, isFixed = false) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.life = 0;
        this.maxLife = 100;
        this.exploded = false;
        this.isFixed = isFixed;
        this.createParticles();
    }

    createParticles() {
        // For fixed fireworks, make them a bit more spectacular
        const particleCount = this.isFixed ? 80 : 50;
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

    // --- Draw Water Line and Water Area (Issue 3 Fix) ---
    // The water line is now positioned relative to the bottom using a fixed offset
    const waterLevel = height - WATER_LEVEL_OFFSET;
    
    // Draw water area
    ctx.fillStyle = 'rgba(0, 0, 100, 0.3)';
    ctx.fillRect(0, waterLevel, width, WATER_LEVEL_OFFSET);

    // Draw water line (a simple blue line)
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, waterLevel);
    ctx.lineTo(width, waterLevel);
    ctx.stroke();
    // --------------------------------------


    // Update and Draw Krathongs
    krathongs.forEach(k => {
        k.update(deltaTime);
        k.draw();
    });

    // Update and Draw TukTuk (Issue 4 Fix: Position adjusted in resizeCanvas and constants)
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

    // --- Fixed Firework Spawning (Issue 2 Fix) ---
    fireworkTimer += deltaTime;
    if (fireworkTimer > FIREWORK_INTERVAL) {
        fireworkTimer = 0;
        FIXED_FIREWORK_POSITIONS.forEach(pos => {
            // Convert normalized position (0-1000) to actual screen coordinates
            const x = (pos.x / 1000) * width;
            const y = (pos.y / 1000) * height;
            fireworks.push(new Firework(x, y, true));
        });
    }
    // ---------------------------------------------

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
    const krathongImages = [];
    assets.krathongs.forEach((src, index) => {
        const img = new Image();
        img.onload = assetLoaded;
        img.src = src;
        krathongImages.push(img);
    });
    
    // Pre-initialize krathongs array with loaded images
    for (let i = 0; i < KRATHONG_COUNT; i++) {
        // Ensure the image is loaded before creating the Krathong object
        // This is a bit tricky with async loading, but since we wait for all assets,
        // we can rely on the images being in the DOM or fully loaded by initGame.
        // For now, we will create the Krathong objects with the image objects.
        // The image objects will be updated when they finish loading.
        const img = new Image();
        img.onload = assetLoaded;
        img.src = assets.krathongs[i];
        krathongs.push(new Krathong(i, img, ''));
    }


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

    // Find the next krathong image to use
    const krathongImage = krathongs[krathongCounter % KRATHONG_COUNT].image;
    
    // Create a new krathong with the wish
    const newKrathong = new Krathong(krathongs.length, krathongImage, wish);
    newKrathong.x = -newKrathong.width; // Start off-screen left
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
    // Reset krathongs to only the initial 5 placeholders
    krathongs = krathongs.slice(0, KRATHONG_COUNT);
    // Reset positions of initial krathongs to off-screen left
    krathongs.forEach((k, index) => {
        k.x = -k.width - (index * KRATHONG_SPACING);
        k.y = height - WATER_LEVEL_OFFSET - k.height / 2;
    });
    
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
