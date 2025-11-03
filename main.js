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
// FINAL FIX: Increased spacing to prevent krathongs from colliding
const KRATHONG_SPACING = 300; 
// FINAL FIX: Increased KRATHONG_SPEED slightly (from 0.5 to 0.7)
const KRATHONG_SPEED = 0.7;
// FINAL FIX: Increased TUKTUK_SPEED significantly (from 1.5 to 4.0) to meet the user's request for a faster speed (40)
const TUKTUK_SPEED = 4.0; 
const FIREWORK_COUNT = 10;

// FINAL FIX: Adjusted ROAD_OFFSET_FROM_BOTTOM to place the tuktuk on the red border (approx. 200px from bottom)
const ROAD_OFFSET_FROM_BOTTOM = 200; 
// FINAL FIX: Adjusted WATER_LEVEL_OFFSET to place krathongs on the water (approx. 100px from bottom)
const WATER_LEVEL_OFFSET = 100; 

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

// FINAL FIX: Re-introducing fixed firework positions as they are NOT part of the background image
const FIXED_FIREWORK_POSITIONS = [
    { x: 0.2 * 1920, y: 0.2 * 1080 }, // Left
    { x: 0.5 * 1920, y: 0.1 * 1080 }, // Center
    { x: 0.8 * 1920, y: 0.2 * 1080 }  // Right
];
let fireworkTimer = 0;
const FIREWORK_INTERVAL = 5000; 

// Assets
const assets = {
    tuktuk: 'images/tuktuk.png', 
    song: 'audio/song.mp3', 
    fireworkLogo: 'images/logo.png', // Temporary fix: Using a known existing asset to prevent 404 and InvalidStateError
    krathongs: []
};

for (let i = 1; i <= KRATHONG_COUNT; i++) {
    assets.krathongs.push(`images/kt${i}.png`); 
}

let loadedAssets = 0;
const totalAssets = 1 + assets.krathongs.length + 1 + 1; // 1 for tuktuk, 5 for krathongs, 1 for song, 1 for fireworkLogo

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
        // Tuktuk should be positioned on the red border
        // The background image is set to 'contain' and 'center center' in index.html.
        const aspectRatio = 1920 / 1080;
        let effectiveHeight = height;
        let effectiveWidth = width;

        if (width / height > aspectRatio) {
            effectiveWidth = height * aspectRatio;
        } else {
            effectiveHeight = width / aspectRatio;
        }

        const imageBottom = height - (height - effectiveHeight) / 2;
        
        // The red line seems to be around 18% from the bottom of the image.
        const roadPositionRatio = 0.18; 
        const roadY = imageBottom - (effectiveHeight * roadPositionRatio);

        // FINAL FIX: Adjusting the vertical position of the tuktuk to run on the red line
        tuktuk.y = roadY - tuktuk.height + 10; 
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
        this.x = -this.width - (id * KRATHONG_SPACING); // Start off-screen LEFT
        this.y = height - WATER_LEVEL_OFFSET - this.height / 2; // Position in the water
        this.speed = KRATHONG_SPEED + (Math.random() * 0.2 - 0.1); // Slight speed variation
        this.waveOffset = Math.random() * Math.PI * 2; // Start at random point in wave cycle
    }

    update(deltaTime) {
        if (isLaunched) {
            this.x += this.speed * deltaTime * 0.01; // Move from LEFT to RIGHT
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
            
            // FINAL FIX: Draw wish text on the krathong with better styling
            if (this.wish) {
                ctx.save();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 14px Chonburi'; // Increased font size and bold
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Truncate wish to fit on krathong
                const maxLen = 10;
                const displayWish = this.wish.length > maxLen ? this.wish.substring(0, maxLen) + '...' : this.wish;

                // Position text slightly above the center of the krathong
                ctx.fillText(displayWish, this.x + this.width / 2, this.y + this.height / 2 - 10);
                ctx.restore();
            }
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
        this.logoImage = null; // For the logo firework
        this.createParticles();
    }

    createParticles() {
        // FINAL FIX: Load logo image for firework
        if (this.isFixed && assets.fireworkLogo) {
            this.logoImage = new Image();
            this.logoImage.src = assets.fireworkLogo;
            this.exploded = true;
            return;
        }

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
        if (this.exploded && !this.logoImage) {
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
            if (this.logoImage && this.logoImage.complete && this.logoImage.naturalWidth !== 0) { // Check for complete and not broken
                // FINAL FIX: Draw the logo image instead of particles
                const logoSize = 100;
                ctx.globalAlpha = 1 - (this.life / this.maxLife); // Fade out the logo
                ctx.drawImage(this.logoImage, this.x - logoSize / 2, this.y - logoSize / 2, logoSize, logoSize);
                ctx.globalAlpha = 1;
                this.life += 1; // Manually increase life for fade out
            } else if (!this.logoImage) {
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

    isFinished() {
        // FINAL FIX: Check if logo firework has faded out
        if (this.logoImage) {
            return this.life >= this.maxLife;
        }
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

    // FINAL FIX: Re-introducing water line drawing
    drawWaterLines();

    // Update and Draw Krathongs
    krathongs.forEach(k => {
        k.update(deltaTime);
        k.draw();
    });

    // Update and Draw TukTuk (Position adjusted in resizeCanvas and constants)
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

    // FINAL FIX: Re-introducing fixed firework spawning
    fireworkTimer += deltaTime;
    if (fireworkTimer >= FIREWORK_INTERVAL) {
        fireworkTimer = 0;
        // Map fixed positions to current screen size
        const pos = FIXED_FIREWORK_POSITIONS[Math.floor(Math.random() * FIXED_FIREWORK_POSITIONS.length)];
        const fireworkX = pos.x * (width / 1920);
        const fireworkY = pos.y * (height / 1080);
        fireworks.push(new Firework(fireworkX, fireworkY, true));
    }

    requestAnimationFrame(gameLoop);
}

// FINAL FIX: Re-introducing water line drawing function with more lines and slower speed
function drawWaterLines() {
    const waterLevel = height - WATER_LEVEL_OFFSET;
    const waveHeight = 5;
    const waveLength = 30; // Increased frequency (more lines)
    const time = Date.now() * 0.001; // Slower speed (0.002 -> 0.001)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i++) { // Increased number of lines (3 -> 5)
        ctx.beginPath();
        ctx.moveTo(0, waterLevel + i * 5);
        for (let x = 0; x < width; x++) {
            const y = waterLevel + i * 5 + Math.sin(x / waveLength + time * (i + 1) * 0.5) * waveHeight;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
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

    // Load Firework Logo
    const fireworkLogoImage = new Image();
    fireworkLogoImage.onload = assetLoaded;
    fireworkLogoImage.src = assets.fireworkLogo;
    // We don't need to store it globally, as it's loaded into the Firework class constructor

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

    if (!isLaunched) {
        isLaunched = true;
    }

    // Find the next krathong to launch
    const krathongToLaunch = krathongs.find(k => k.wish === '');
    if (krathongToLaunch) {
        krathongToLaunch.wish = wish;
        krathongCounter++;
        wishes.push({ id: krathongCounter, wish: wish, timestamp: new Date().toISOString() });
        
        // Reset position to start off-screen left
        krathongToLaunch.x = -krathongToLaunch.width;
        
        // Update counter
        const counterEl = document.getElementById('krathong-counter');
        if (counterEl) {
            counterEl.textContent = `ลอยแล้ว ${krathongCounter} ใบ`;
        }
        
        showToast();
        haptic();
    } else {
        // All krathongs are launched, find the oldest one to replace
        const oldestKrathong = krathongs.reduce((prev, current) => (prev.id < current.id) ? prev : current);
        oldestKrathong.wish = wish;
        oldestKrathong.id = krathongCounter++;
        
        // Reset position to start off-screen left
        oldestKrathong.x = -oldestKrathong.width;
        
        wishes.push({ id: oldestKrathong.id, wish: wish, timestamp: new Date().toISOString() });
        showToast();
        haptic();
    }
}

function resetGame() {
    isLaunched = false;
    krathongCounter = 0;
    wishes = [];
    
    // Reset krathong positions and wishes
    krathongs.forEach((k, index) => {
        k.id = index;
        k.wish = '';
        k.x = -k.width - (index * KRATHONG_SPACING);
    });
    
    // Reset tuktuk position
    tuktuk.x = -tuktuk.width;
    
    // Update counter
    const counterEl = document.getElementById('krathong-counter');
    if (counterEl) {
        counterEl.textContent = `ลอยแล้ว 0 ใบ`;
    }
    
    // Clear wish input
    const wishInput = document.getElementById('wish-input');
    if (wishInput) {
        wishInput.value = '';
    }
}

function toggleMusic() {
    const musicEl = document.getElementById('bg-music');
    const btnMusic = document.getElementById('btn-music');
    const btnMusicMobile = document.getElementById('btn-music-mobile');

    if (musicEl) {
        if (isMusicPlaying) {
            musicEl.pause();
            isMusicPlaying = false;
            if (btnMusic) btnMusic.textContent = 'เพลง: ปิด';
            if (btnMusicMobile) btnMusicMobile.textContent = 'เพลง: ปิด';
        } else {
            musicEl.play().catch(error => {
                console.error("Music playback failed:", error);
                // Inform user that music requires interaction
                alert("เบราว์เซอร์ของคุณอาจต้องการให้คุณคลิกที่หน้าจอเพื่อเปิดเพลง");
            });
            isMusicPlaying = true;
            if (btnMusic) btnMusic.textContent = 'เพลง: เปิด';
            if (btnMusicMobile) btnMusicMobile.textContent = 'เพลง: เปิด';
        }
    }
}

function exportCSV() {
    if (wishes.length === 0) {
        alert("ยังไม่มีคำอธิษฐานที่ถูกบันทึก");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Wish,Timestamp\n";
    wishes.forEach(w => {
        // Escape quotes and newlines in the wish text
        const wishText = `"${w.wish.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        csvContent += `${w.id},${wishText},${w.timestamp}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "krathong_wishes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Main function to run when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById(CANVAS_ID);
    if (canvas) {
        ctx = canvas.getContext('2d');
    }

    // Load assets and initialize game
    loadAssets();

    // Event Listeners for UI
    const btnLaunchHeader = document.getElementById('btn-launch-header');
    const btnLaunchMobile = document.getElementById('btn-launch-mobile');
    const btnReset = document.getElementById('btn-reset');
    const btnResetMobile = document.getElementById('btn-reset-mobile');
    const btnMusic = document.getElementById('btn-music');
    const btnMusicMobile = document.getElementById('btn-music-mobile');
    const btnExport = document.getElementById('btn-export');
    const btnExportMobile = document.getElementById('btn-export-mobile');
    const launchButton = document.getElementById('launch');
    const wishInputContainer = document.getElementById('wish-input-container');
    const wishInput = document.getElementById('wish-input');

    // Helper function to show wish input
    const showWishInput = () => {
        if (wishInputContainer) {
            wishInputContainer.style.display = 'flex';
            if (wishInput) {
                wishInput.focus();
            }
        }
    };

    // Helper function to handle launch button click
    const handleLaunchClick = () => {
        if (wishInput && wishInput.value.trim() !== '') {
            launch(wishInput.value.trim());
            wishInput.value = ''; // Clear input after launch
        } else {
            alert("กรุณาพิมพ์คำอธิษฐานก่อนปล่อยกระทง");
        }
    };

    if (btnLaunchHeader) btnLaunchHeader.onclick = showWishInput;
    if (btnLaunchMobile) btnLaunchMobile.onclick = showWishInput;
    if (btnReset) btnReset.onclick = resetGame;
    if (btnResetMobile) btnResetMobile.onclick = resetGame;
    if (btnMusic) btnMusic.onclick = toggleMusic;
    if (btnMusicMobile) btnMusicMobile.onclick = toggleMusic;
    if (btnExport) btnExport.onclick = exportCSV;
    if (btnExportMobile) btnExportMobile.onclick = exportCSV;
    if (launchButton) launchButton.onclick = handleLaunchClick;

    // Close wish input when clicking outside (simple way)
    document.addEventListener('click', (event) => {
        if (wishInputContainer && event.target !== wishInputContainer && !wishInputContainer.contains(event.target) && event.target !== btnLaunchHeader && event.target !== btnLaunchMobile) {
            if (wishInputContainer.style.display === 'flex') {
                // Only hide if the click was not on the launch buttons
                if (event.target.id !== 'btn-launch-header' && event.target.id !== 'btn-launch-mobile') {
                    wishInputContainer.style.display = 'none';
                }
            }
        }
    });
});
