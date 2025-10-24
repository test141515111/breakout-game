// ========================================
// Spark Break - 本物のBallz系ゲーム
// ========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲーム設定
const CONFIG = {
    canvasWidth: 600,
    canvasHeight: 800,
    ballRadius: 6,
    ballSpeed: 12,
    blockSize: 10, // 小さなブロック
    blockGap: 0, // 隙間なし
    blocksPerRow: 60, // 600 / 10 = 60個
    maxRows: 48, // 上半分480px / 10 = 48行
    launchDelay: 50, // ボール発射間隔（ms）
};

// ゲーム状態
let gameState = {
    level: 1,
    score: 0,
    ballCount: 1, // 最初は1個だけ
    isPlaying: false,
    isAiming: false,
    isShooting: false,
    balls: [],
    blocks: [],
    particles: [],
    fallingBalls: [], // 降ってくるボール
    angle: Math.PI / 4,
    launchPosition: { x: CONFIG.canvasWidth / 2, y: 750 }, // 受け皿エリア内
    ballsReturned: 0,
    comboCount: 0,
};

// ========================================
// パーティクルクラス
// ========================================

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // 重力
        this.life -= 0.02;
    }

    draw() {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ========================================
// 降ってくるボールクラス
// ========================================

class FallingBall {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = 2;
        this.collected = false;
    }

    update() {
        this.y += this.vy;
        this.vy += 0.2; // 加速

        // 受け皿エリア到達で回収
        if (this.y >= 480) {
            this.collected = true;
            gameState.ballCount++;
        }
    }

    draw() {
        if (this.collected) return;

        // 黄色く光るボール
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 光のエフェクト
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fill();
    }
}

// ========================================
// ユーティリティ関数
// ========================================

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function calculateAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

// ========================================
// ボールクラス
// ========================================

class Ball {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = CONFIG.ballRadius;
        this.active = true;
    }

    update() {
        if (!this.active) return;

        this.x += this.vx;
        this.y += this.vy;

        // 壁との衝突判定（左右）
        if (this.x - this.radius <= 0 || this.x + this.radius >= CONFIG.canvasWidth) {
            this.vx *= -1;
            this.x = Math.max(this.radius, Math.min(CONFIG.canvasWidth - this.radius, this.x));
        }

        // 天井との衝突判定
        if (this.y - this.radius <= 0) {
            this.vy *= -1;
            this.y = this.radius;
        }

        // 受け皿エリア到達（ボール回収）
        if (this.y >= 480) {
            this.active = false;
            gameState.ballsReturned++;
            gameState.launchPosition.x = this.x;
        }

        // ブロックとの衝突判定
        this.checkBlockCollision();
    }

    checkBlockCollision() {
        gameState.blocks.forEach(block => {
            if (block.hp <= 0) return;

            if (this.isCollidingWith(block)) {
                if (block.type === 'wall') {
                    // 壁ブロックは破壊不可
                    this.reflectFrom(block);
                } else if (block.type === 'ballplus') {
                    // Ball+1ブロック
                    block.hp = 0;
                    gameState.score += 100;
                    gameState.comboCount++;

                    // ボールを降らせる（1個追加）
                    setTimeout(() => {
                        gameState.fallingBalls.push(
                            new FallingBall(block.x + CONFIG.blockSize / 2, block.y + CONFIG.blockSize / 2)
                        );
                    }, 100);

                    this.reflectFrom(block);
                } else {
                    // 通常ブロック（HPを減らす）
                    block.hp -= 1;
                    gameState.score += 10;
                    if (block.hp > 0) {
                        gameState.comboCount++;
                    }

                    this.reflectFrom(block);
                }
            }
        });
    }

    isCollidingWith(block) {
        const closestX = Math.max(block.x, Math.min(this.x, block.x + CONFIG.blockSize));
        const closestY = Math.max(block.y, Math.min(this.y, block.y + CONFIG.blockSize));

        const distX = this.x - closestX;
        const distY = this.y - closestY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        return distance < this.radius;
    }

    reflectFrom(block) {
        const closestX = Math.max(block.x, Math.min(this.x, block.x + CONFIG.blockSize));
        const closestY = Math.max(block.y, Math.min(this.y, block.y + CONFIG.blockSize));

        const distX = this.x - closestX;
        const distY = this.y - closestY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        // 反射方向を計算
        if (Math.abs(distX) > Math.abs(distY)) {
            this.vx *= -1;
        } else {
            this.vy *= -1;
        }

        // 重なりを解消
        if (distance > 0) {
            const overlap = this.radius - distance;
            this.x += (distX / distance) * overlap;
            this.y += (distY / distance) * overlap;
        }
    }

    draw() {
        if (!this.active) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 輝きエフェクト
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fill();
    }
}

// ========================================
// ブロッククラス
// ========================================

class Block {
    constructor(x, y, type, hp = 1) {
        this.x = x;
        this.y = y;
        this.type = type; // 'wall', 'normal', 'ballplus'
        this.hp = hp;
        this.maxHp = hp;
    }

    draw() {
        if (this.hp <= 0) return;

        let color;
        if (this.type === 'wall') {
            // 壁ブロック（濃い青/紫）
            color = '#1a1a5e';
        } else if (this.type === 'ballplus') {
            // Ball+1ブロック（オレンジ）
            color = '#ff9900';
        } else {
            // 通常ブロック（緑、HPに応じて色が変わる）
            const intensity = 100 + Math.floor((this.hp / this.maxHp) * 155);
            color = `rgb(0, ${intensity}, 0)`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, CONFIG.blockSize, CONFIG.blockSize);

        // グリッド線（境界線）を描画
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(this.x, this.y, CONFIG.blockSize, CONFIG.blockSize);
    }

    moveDown() {
        this.y += CONFIG.blockSize;
    }
}

// ========================================
// ゲーム初期化
// ========================================

function initGame() {
    gameState = {
        level: 1,
        score: 0,
        ballCount: 1, // 最初は1個だけ
        isPlaying: false,
        isAiming: false,
        isShooting: false,
        balls: [],
        blocks: [],
        particles: [],
        fallingBalls: [],
        angle: Math.PI / 4,
        launchPosition: { x: CONFIG.canvasWidth / 2, y: 750 },
        ballsReturned: 0,
        comboCount: 0,
    };

    generateLevel1();
    updateUI();
}

function generateLevel1() {
    // ブロックは画面中央やや下から配置（動画の通り）
    const blockSize = CONFIG.blockSize;
    const cols = CONFIG.blocksPerRow; // 60
    const startRow = 16; // y=160px から開始
    const rows = 24; // 24行分（160px〜400px）

    gameState.blocks = [];

    // 下半分に通常ブロック（緑）を配置
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * blockSize;
            const y = (startRow + row) * blockSize; // 240px以降
            const hp = Math.floor(Math.random() * 3) + 1; // HP 1〜3
            gameState.blocks.push(new Block(x, y, 'normal', hp));
        }
    }

    // T字型の壁ブロック配置（動画の通り）
    // 横壁（上部）
    for (let col = 5; col < 55; col++) {
        const index = 6 * cols + col;
        const x = col * blockSize;
        const y = (startRow + 6) * blockSize;
        gameState.blocks[index] = new Block(x, y, 'wall', 999999);
    }

    // 左縦壁
    for (let row = 7; row < 18; row++) {
        const index = row * cols + 5;
        const x = 5 * blockSize;
        const y = (startRow + row) * blockSize;
        gameState.blocks[index] = new Block(x, y, 'wall', 999999);
    }

    // 中央縦壁
    for (let row = 7; row < 18; row++) {
        const index = row * cols + 30;
        const x = 30 * blockSize;
        const y = (startRow + row) * blockSize;
        gameState.blocks[index] = new Block(x, y, 'wall', 999999);
    }

    // 右縦壁
    for (let row = 7; row < 18; row++) {
        const index = row * cols + 54;
        const x = 54 * blockSize;
        const y = (startRow + row) * blockSize;
        gameState.blocks[index] = new Block(x, y, 'wall', 999999);
    }

    // Ball+1ブロックをランダムに配置
    const ballPlusCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < ballPlusCount; i++) {
        const col = Math.floor(Math.random() * (cols - 20)) + 10;
        const row = Math.floor(Math.random() * (rows - 10)) + 5;
        const index = row * cols + col;
        if (gameState.blocks[index] && gameState.blocks[index].type === 'normal') {
            const x = col * blockSize;
            const y = (startRow + row) * blockSize;
            gameState.blocks[index] = new Block(x, y, 'ballplus', 1);
        }
    }
}

// generateBlocks() は不要 - 新しいブロックは追加しない

function moveBlocksDown() {
    // 残っているブロックを下に移動
    gameState.blocks.forEach(block => {
        block.moveDown();
    });

    // ゲームオーバー判定（ブロックが受け皿エリアに到達）
    const hasReachedBottom = gameState.blocks.some(
        block => block.hp > 0 && block.y >= 480
    );

    if (hasReachedBottom) {
        gameOver();
        return;
    }

    // 全てのブロックを破壊したらクリア
    const remainingBlocks = gameState.blocks.filter(b => {
        if (b.type === 'wall') return true;
        if (b.type === 'ballplus' && b.hp > 0) return true;
        return false;
    });

    if (remainingBlocks.length === 0) {
        // 全ブロック破壊！
        alert('ステージクリア！スコア: ' + gameState.score);
        initGame();
        return;
    }

    gameState.level++;
    updateUI();
}

// ========================================
// 発射処理
// ========================================

function launchBalls() {
    gameState.isShooting = true;
    gameState.isAiming = false;
    gameState.ballsReturned = 0;
    gameState.comboCount = 0;

    const vx = Math.cos(gameState.angle) * CONFIG.ballSpeed;
    const vy = Math.sin(gameState.angle) * CONFIG.ballSpeed;

    let ballsLaunched = 0;

    const launchInterval = setInterval(() => {
        if (ballsLaunched >= gameState.ballCount) {
            clearInterval(launchInterval);
            return;
        }

        gameState.balls.push(
            new Ball(
                gameState.launchPosition.x,
                gameState.launchPosition.y,
                vx,
                vy
            )
        );

        ballsLaunched++;
    }, CONFIG.launchDelay);
}

function checkAllBallsReturned() {
    if (gameState.isShooting && gameState.ballsReturned >= gameState.ballCount) {
        gameState.isShooting = false;
        gameState.balls = [];
        moveBlocksDown();

        // 破壊されたブロックを削除
        gameState.blocks = gameState.blocks.filter(b => b.type === 'wall' || b.hp > 0);
    }
}

// ========================================
// 描画処理
// ========================================

function draw() {
    // 上半分：濃い青（空きエリア）
    ctx.fillStyle = '#1a1a4e';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, 480);

    // 下半分：少し明るい青（受け皿エリア）
    ctx.fillStyle = '#2a2a5e';
    ctx.fillRect(0, 480, CONFIG.canvasWidth, CONFIG.canvasHeight - 480);

    // ブロック描画
    gameState.blocks.forEach(block => block.draw());

    // ボール描画
    gameState.balls.forEach(ball => ball.draw());

    // 降ってくるボール描画
    gameState.fallingBalls.forEach(ball => ball.draw());

    // パーティクル描画
    gameState.particles.forEach(particle => particle.draw());

    // 発射位置を描画
    if (!gameState.isShooting) {
        ctx.beginPath();
        ctx.arc(gameState.launchPosition.x, gameState.launchPosition.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();
    }

    // エイム線を描画
    if (gameState.isAiming && !gameState.isShooting) {
        const lineLength = 100;
        const endX = gameState.launchPosition.x + Math.cos(gameState.angle) * lineLength;
        const endY = gameState.launchPosition.y + Math.sin(gameState.angle) * lineLength;

        ctx.beginPath();
        ctx.moveTo(gameState.launchPosition.x, gameState.launchPosition.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        const degrees = Math.round((gameState.angle * 180) / Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${degrees}°`, gameState.launchPosition.x, gameState.launchPosition.y - 30);
    }

    // 左下にボール数表示
    const iconY = 700;
    const iconSize = 30;

    ctx.beginPath();
    ctx.arc(30, iconY, iconSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`×${gameState.ballCount}`, 55, iconY + 8);

    // コンボ表示
    if (gameState.comboCount > 5) {
        ctx.save();
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffff00';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.strokeText('SPARK BREAK!!', CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2);
        ctx.fillText('SPARK BREAK!!', CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2);
        ctx.restore();
    }
}

function update() {
    if (!gameState.isPlaying) return;

    gameState.balls.forEach(ball => ball.update());
    gameState.fallingBalls.forEach(ball => ball.update());
    gameState.particles.forEach(particle => particle.update());

    // 削除処理
    gameState.fallingBalls = gameState.fallingBalls.filter(b => !b.collected);
    gameState.particles = gameState.particles.filter(p => p.life > 0);

    checkAllBallsReturned();
    updateUI();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ========================================
// UI更新
// ========================================

function updateUI() {
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('ballCount').textContent = gameState.ballCount;
    document.getElementById('score').textContent = gameState.score;
}

function gameOver() {
    gameState.isPlaying = false;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').classList.remove('hidden');
}

// ========================================
// イベントリスナー
// ========================================

canvas.addEventListener('mousedown', (e) => {
    if (!gameState.isPlaying || gameState.isShooting) return;

    const pos = getMousePos(canvas, e);
    gameState.isAiming = true;
    gameState.angle = calculateAngle(
        gameState.launchPosition.x,
        gameState.launchPosition.y,
        pos.x,
        pos.y
    );

    // 角度制限（上方向のみ）
    if (gameState.angle < -Math.PI || gameState.angle > 0) {
        gameState.angle = Math.max(-Math.PI + 0.1, Math.min(-0.1, gameState.angle));
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!gameState.isPlaying || !gameState.isAiming || gameState.isShooting) return;

    const pos = getMousePos(canvas, e);
    gameState.angle = calculateAngle(
        gameState.launchPosition.x,
        gameState.launchPosition.y,
        pos.x,
        pos.y
    );

    // 角度制限（上方向のみ）
    if (gameState.angle < -Math.PI || gameState.angle > 0) {
        gameState.angle = Math.max(-Math.PI + 0.1, Math.min(-0.1, gameState.angle));
    }
});

canvas.addEventListener('mouseup', () => {
    if (!gameState.isPlaying || !gameState.isAiming || gameState.isShooting) return;

    launchBalls();
});

// ボタンイベント
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startScreen').classList.add('hidden');
    initGame();
    gameState.isPlaying = true;
    gameLoop();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOver').classList.add('hidden');
    initGame();
    gameState.isPlaying = true;
});

document.getElementById('retryBtn').addEventListener('click', () => {
    document.getElementById('gameOver').classList.add('hidden');
    initGame();
    gameState.isPlaying = true;
});

// ========================================
// ゲーム開始
// ========================================

// 描画ループを開始（スタート画面表示のため）
gameLoop();
