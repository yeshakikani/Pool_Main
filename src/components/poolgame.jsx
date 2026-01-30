import React, { useEffect, useRef, useState } from 'react';
import '../styles/PoolGame.css';

const BALL_COLORS = {
  0: { base: '#F8F8F8', shade: '#E0E0E0' },
  1: { base: '#FFD700', shade: '#DAA520' },
  2: { base: '#0047AB', shade: '#003380' },
  3: { base: '#DC143C', shade: '#B01030' },
  4: { base: '#9B30FF', shade: '#7B20D0' },
  5: { base: '#FF8C00', shade: '#D67300' },
  6: { base: '#228B22', shade: '#1A6B1A' },
  7: { base: '#8B0000', shade: '#6B0000' },
  8: { base: '#1C1C1C', shade: '#000000' },
  9: { base: '#FFD700', shade: '#DAA520' },
  10: { base: '#0047AB', shade: '#003380' },
  11: { base: '#DC143C', shade: '#B01030' },
  12: { base: '#9B30FF', shade: '#7B20D0' },
  13: { base: '#FF8C00', shade: '#D67300' },
  14: { base: '#228B22', shade: '#1A6B1A' },
  15: { base: '#8B0000', shade: '#6B0000' }
};


const PoolGame = () => {
  const canvasRef = useRef(null);
  const [gameMode, setGameMode] = useState(null); // null, 'pvp', 'pvc'
  const [gameState, setGameState] = useState({
    currentPlayer: 1,
    player1Balls: [],
    player2Balls: [],
    player1Type: null,
    player2Type: null,
    winner: null,
    message: 'Player 1: Break the rack!',
    aiThinking: false,
    pocketedBalls: []
  });
  const TABLE_BORDER = 25;


  useEffect(() => {
    if (!gameMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Responsive canvas + DPR handling. Keep logical coordinates equal to CSS pixels.
    const DPR = window.devicePixelRatio || 1;

    const setCanvasSize = () => {
      const parent = canvas.parentElement;
      let cssWidth = 1000;
      if (parent) {
        const parentWidth = parent.clientWidth - 30;
        if (parentWidth < 1000) cssWidth = Math.max(parentWidth, 300);
      }

      if (window.innerWidth < 480) {
        cssWidth = Math.max(window.innerWidth - 20, 300);
      } else if (window.innerWidth < 768) {
        cssWidth = Math.max(window.innerWidth - 30, 320);
      }

      // Make sure it fits vertically (avoid cropping on tablets)
      const availableHeight = Math.max(window.innerHeight - 220, 300);
      const maxWidthFromHeight = Math.floor((availableHeight * 1000) / 500);
      if (maxWidthFromHeight && cssWidth > maxWidthFromHeight) cssWidth = maxWidthFromHeight;

      const cssHeight = Math.floor((cssWidth * 500) / 1000);

      // Set CSS size (display) and backing store size (pixels)
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      canvas.width = Math.floor(cssWidth * DPR);
      canvas.height = Math.floor(cssHeight * DPR);

      // Return logical table size in CSS pixels
      return { width: cssWidth, height: cssHeight };
    };

    let { width: TABLE_WIDTH, height: TABLE_HEIGHT } = setCanvasSize();
    let ctx = canvas.getContext('2d');
    // Scale drawing so 1 unit = 1 CSS pixel (handles DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    let SCALE_X = TABLE_WIDTH / 1000;
    let SCALE_Y = TABLE_HEIGHT / 500;
    let BALL_RADIUS = 14 * SCALE_X;
    let POCKET_RADIUS = 28 * SCALE_X;
    let TABLE_MARGIN = 45 * SCALE_X;
    const FRICTION = 0.987;
    const CUSHION_BOUNCE = 0.75;

    let balls = [];
    let pockets = [];
    let cueBall = null;
    let ballsMoving = false;
    let aimAngle = 0;
    let power = 0;
    let isDragging = false;
    let mouseX = 0;
    let mouseY = 0;
    let currentPlayerState = 1;
    let player1BallsState = [];
    let player2BallsState = [];
    let player1TypeState = null;
    let player2TypeState = null;
    let messageState = 'Player 1: Break the rack!';
    let shotTaken = false;
    let ballPocketed = false;
    let foul = false;
    let aiThinking = false;
    let aiThinkTimer = 0;
    let gameOver = false;

    const triggerGameOver = () => {
      if (gameOver) return;
      gameOver = true;
      ballsMoving = false;
      // Freeze all balls immediately
      balls.forEach(b => {
        b.vx = 0;
        b.vy = 0;
      });

      messageState = 'GAME OVER';
      setGameState(prev => ({ ...prev, message: messageState }));
    };

    const restartGame = () => {   //29 jan
      gameOver = false;
      ballsMoving = false;

      currentPlayerState = 1;
      player1BallsState = [];
      player2BallsState = [];
      player1TypeState = null;
      player2TypeState = null;
      messageState = 'Player 1: Break the rack!';

      initPockets();
      initBalls();

      setGameState({
        currentPlayer: 1,
        player1Balls: [],
        player2Balls: [],
        player1Type: null,
        player2Type: null,
        winner: null,
        message: messageState,
        aiThinking: false,
        pocketedBalls: []
      });
    };


    const initPockets = () => {
      const cornerOffset = TABLE_MARGIN;
      const sideOffsetX = TABLE_WIDTH / 2;
      const sideOffsetY = TABLE_MARGIN;

      pockets = [
        { x: cornerOffset, y: cornerOffset },
        { x: sideOffsetX, y: sideOffsetY },
        { x: TABLE_WIDTH - cornerOffset, y: cornerOffset },
        { x: cornerOffset, y: TABLE_HEIGHT - cornerOffset },
        { x: sideOffsetX, y: TABLE_HEIGHT - sideOffsetY },
        { x: TABLE_WIDTH - cornerOffset, y: TABLE_HEIGHT - cornerOffset }
      ];
    };

    class Ball {
      constructor(x, y, number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.number = number;
        this.pocketed = false;
        this.radius = BALL_RADIUS;
        this.pocketScale = 1;
      }

      update() {
        if (this.pocketed) {
          this.pocketScale *= 0.92;
          return;
        }

        this.x += this.vx;
        this.y += this.vy;

        this.vx *= FRICTION;
        this.vy *= FRICTION;

        if (Math.abs(this.vx) < 0.03) this.vx = 0;
        if (Math.abs(this.vy) < 0.03) this.vy = 0;

        // Check Pockets FIRST
        let approachingPocket = false;

        pockets.forEach(pocket => {
          const dx = this.x - pocket.x;
          const dy = this.y - pocket.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // If really close, it's pocketed
          // Increased range slightly for easier potting
          if (dist < POCKET_RADIUS) {
            this.pocketed = true;
            ballPocketed = true;
            this.vx = 0;
            this.vy = 0;

            if (this.number === 0) {
              triggerGameOver();
            } else if (this.number === 8) {
              handleEightBall();
            } else {
              handleBallPocketed(this.number);
            }
          }

          // If fairly close to a pocket (within 1.5x radius), disable cushion collision
          // This allows the ball to travel "through" the wall into the hole
          if (dist < POCKET_RADIUS * 1.5) {
            approachingPocket = true;
          }
        });

        // If we just fell in, stop here
        if (this.pocketed) return;

        // Cushion Collision (only if not near a pocket)
        if (!approachingPocket) {
          const SAFE_GAP = 6; // outline ke andar ka gap
          const margin = TABLE_MARGIN + SAFE_GAP;

          if (this.x - this.radius < margin) {
            this.x = margin + this.radius;
            this.vx *= -CUSHION_BOUNCE;
          }
          if (this.x + this.radius > TABLE_WIDTH - margin) {
            this.x = TABLE_WIDTH - margin - this.radius;
            this.vx *= -CUSHION_BOUNCE;
          }
          if (this.y - this.radius < margin) {
            this.y = margin + this.radius;
            this.vy *= -CUSHION_BOUNCE;
          }
          if (this.y + this.radius > TABLE_HEIGHT - margin) {
            this.y = TABLE_HEIGHT - margin - this.radius;
            this.vy *= -CUSHION_BOUNCE;
          }
        }
      }

      draw(ctx) {
        if (this.pocketed && this.pocketScale < 0.1) return;

        const scale = this.pocketed ? this.pocketScale : 1;
        const r = this.radius * scale;

        ctx.save();
        ctx.globalAlpha = 0.4 * scale;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(this.x + 4, this.y + 4, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const gradient = ctx.createRadialGradient(
          this.x - r * 0.3, this.y - r * 0.3, r * 0.1,
          this.x, this.y, r
        );

        const colors = BALL_COLORS[this.number];
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.3, colors.base);
        gradient.addColorStop(1, colors.shade);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (this.number > 8 && this.number !== 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(this.x, this.y, r * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }

        if (this.number !== 0) {
          ctx.fillStyle = (this.number > 8 || this.number === 8) ? '#000000' : '#FFFFFF';
          ctx.font = `bold ${Math.floor(r * 0.8)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.number, this.x, this.y);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x - r * 0.35, this.y - r * 0.35, r * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const handleBallPocketed = (ballNum) => {
      const isStripe = ballNum > 8;

      if (currentPlayerState === 1) {
        if (player1TypeState === null) {
          player1TypeState = isStripe ? 'stripe' : 'solid';
          player2TypeState = isStripe ? 'solid' : 'stripe';
        }
        if ((player1TypeState === 'stripe' && isStripe) || (player1TypeState === 'solid' && !isStripe)) {
          player1BallsState.push(ballNum);
        } else {
          player2BallsState.push(ballNum);
        }
      } else {
        if (player2TypeState === null) {
          player2TypeState = isStripe ? 'stripe' : 'solid';
          player1TypeState = isStripe ? 'solid' : 'stripe';
        }
        if ((player2TypeState === 'stripe' && isStripe) || (player2TypeState === 'solid' && !isStripe)) {
          player2BallsState.push(ballNum);
        } else {
          player1BallsState.push(ballNum);
        }
      }
      // Sync state for live score updates
      setGameState(prev => ({
        ...prev,
        player1Balls: [...player1BallsState],
        player2Balls: [...player2BallsState],
        player1Type: player1TypeState,
        player2Type: player2TypeState,
        pocketedBalls: [...(prev.pocketedBalls || []), ballNum]
      }));
    };

    const handleEightBall = () => {
      const currentBalls = currentPlayerState === 1 ? player1BallsState : player2BallsState;
      const requiredBalls = 7;

      if (currentBalls.length === requiredBalls) {
        messageState = `Player ${currentPlayerState} wins!`;
        setGameState(prev => ({ ...prev, winner: currentPlayerState, message: messageState }));
      } else {
        messageState = `Player ${currentPlayerState} loses! 8-ball pocketed early.`;
        setGameState(prev => ({ ...prev, winner: currentPlayerState === 1 ? 2 : 1, message: messageState, pocketedBalls: [...(prev.pocketedBalls || []), 8] }));
      }
    };

    const initBalls = () => {
      balls = [];

      cueBall = new Ball(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, 0);
      balls.push(cueBall);

      const startX = TABLE_WIDTH * 0.72;
      const startY = TABLE_HEIGHT / 2;
      const spacing = BALL_RADIUS * 2 + 1;

      const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
      let ballIndex = 0;

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col <= row; col++) {
          const x = startX + row * spacing * 0.866;
          const y = startY + (col - row / 2) * spacing;
          balls.push(new Ball(x, y, rackOrder[ballIndex++]));
        }
      }
    };

    const checkBallCollisions = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];

          if (b1.pocketed || b2.pocketed) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < b1.radius + b2.radius) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const vx1 = b1.vx * cos + b1.vy * sin;
            const vy1 = b1.vy * cos - b1.vx * sin;
            const vx2 = b2.vx * cos + b2.vy * sin;
            const vy2 = b2.vy * cos - b2.vx * sin;

            const vx1Final = vx2;
            const vx2Final = vx1;

            b1.vx = vx1Final * cos - vy1 * sin;
            b1.vy = vy1 * cos + vx1Final * sin;
            b2.vx = vx2Final * cos - vy2 * sin;
            b2.vy = vy2 * cos + vx2Final * sin;

            const overlap = (b1.radius + b2.radius - dist) / 2;
            b1.x -= overlap * cos;
            b1.y -= overlap * sin;
            b2.x += overlap * cos;
            b2.y += overlap * sin;
          }
        }
      }
    };

    // AI Player Logic
    const aiTakeShot = () => {
      if (!cueBall || cueBall.pocketed) return;

      let bestAngle = 0;
      let bestScore = -1;
      const myType = player2TypeState;

      // Find target balls
      const targetBalls = balls.filter(b => {
        if (b.pocketed || b.number === 0) return false;
        if (!myType) return b.number !== 8;
        if (myType === 'solid') return b.number > 0 && b.number < 8;
        return b.number > 8;
      });

      // If no target balls, aim for 8-ball
      if (targetBalls.length === 0) {
        const eightBall = balls.find(b => b.number === 8 && !b.pocketed);
        if (eightBall) targetBalls.push(eightBall);
      }

      // Try different angles
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        let score = 0;

        targetBalls.forEach(ball => {
          const dx = ball.x - cueBall.x;
          const dy = ball.y - cueBall.y;
          const angleToBall = Math.atan2(dy, dx);
          const angleDiff = Math.abs(angleToBall - angle);

          if (angleDiff < 0.3) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            score += 100 / (dist + 1);

            // Bonus for closer to pockets
            pockets.forEach(pocket => {
              const pdx = ball.x - pocket.x;
              const pdy = ball.y - pocket.y;
              const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
              score += 50 / (pdist + 1);
            });
          }
        });

        if (score > bestScore) {
          bestScore = score;
          bestAngle = angle;
        }
      }

      aimAngle = bestAngle;
      const aiPower = 40 + Math.random() * 30;
      const speed = aiPower / 4;

      cueBall.vx = Math.cos(aimAngle) * speed;
      cueBall.vy = Math.sin(aimAngle) * speed;
      ballsMoving = true;
      shotTaken = true;
      aiThinking = false;
      setGameState(prev => ({ ...prev, aiThinking: false }));
    };

    const drawGameOverOverlay = () => {
      const t = Date.now();
      const pulse = (Math.sin(t / 400) + 1) / 2; // 0..1
      const overlayAlpha = 0.6 + 0.1 * pulse;

      // Restart button  // 29 jan
      const btnW = 180;
      const btnH = 50;
      const btnX = TABLE_WIDTH / 2 - btnW / 2;
      const btnY = TABLE_HEIGHT / 2 + 60;

      ctx.fillStyle = '#28a745';
      ctx.fillRect(btnX, btnY, btnW, btnH);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnW, btnH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('RESTART', TABLE_WIDTH / 2, btnY + 33);





      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      const fontSize = Math.floor(72 * (1 + 0.06 * pulse));
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 30 * pulse;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.globalAlpha = 1;
      ctx.fillText('GAME OVER', TABLE_WIDTH / 2, TABLE_HEIGHT / 2);

      ctx.restore();
    };

    const drawTable = () => {
      // 1. Draw Outer Frame (Wood)
      // Rounded Rectangle for the whole table
      ctx.beginPath();
      ctx.roundRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT, 20);
      const woodGrad = ctx.createLinearGradient(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      woodGrad.addColorStop(0, '#5D2906');   // Dark Wood
      woodGrad.addColorStop(0.5, '#8B4513'); // Mid Wood
      woodGrad.addColorStop(1, '#5D2906');   // Dark Wood
      ctx.fillStyle = woodGrad;
      ctx.fill();

      // Wood Grain Effect
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = '#3E1C02';
      ctx.lineWidth = 2;
      for (let i = 0; i < TABLE_WIDTH; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + Math.random() * 20, TABLE_HEIGHT);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Playable Area (Felt) - slightly inset
      const railWidth = 35; // The wood rail thickness
      const cushionWidth = 15; // The rubber cushion
      const playX = railWidth + cushionWidth;
      const playY = railWidth + cushionWidth;
      const playW = TABLE_WIDTH - (playX * 2);
      const playH = TABLE_HEIGHT - (playY * 2);

      // Rails (Top of wood, lighter for 3D effect)
      ctx.beginPath();
      ctx.roundRect(5, 5, TABLE_WIDTH - 10, TABLE_HEIGHT - 10, 15);
      const railGrad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
      railGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
      railGrad.addColorStop(0.1, 'rgba(255,255,255,0.0)');
      railGrad.addColorStop(0.9, 'rgba(0,0,0,0.0)');
      railGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = railGrad;
      ctx.fill();

      // Diamond Sights (Markers)
      ctx.fillStyle = '#E0E0E0';
      const drawDiamond = (cx, cy) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 3);
        ctx.lineTo(cx + 3, cy);
        ctx.lineTo(cx, cy + 3);
        ctx.lineTo(cx - 3, cy);
        ctx.fill();
      };
      // Horizontal diamonds
      for (let i = 1; i < 8; i++) {
        if (i === 4) continue; // Skip middle
        drawDiamond(railWidth + cushionWidth + (playW / 8) * i, railWidth / 2); // Top
        drawDiamond(railWidth + cushionWidth + (playW / 8) * i, TABLE_HEIGHT - railWidth / 2); // Bottom
      }
      // Vertical diamonds
      for (let i = 1; i < 4; i++) {
        drawDiamond(railWidth / 2, railWidth + cushionWidth + (playH / 4) * i); // Left
        drawDiamond(TABLE_WIDTH - railWidth / 2, railWidth + cushionWidth + (playH / 4) * i); // Right
      }

      // 3. Cushions (Rubber bumper) - Darker/Teal Green or Blue
      ctx.fillStyle = '#003366'; // Dark blue bumper foundation (for user's blue theme)
      // Top Cushion
      ctx.beginPath();
      ctx.moveTo(railWidth, railWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth, railWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth - cushionWidth, railWidth + cushionWidth);
      ctx.lineTo(railWidth + cushionWidth, railWidth + cushionWidth);
      ctx.fill();
      // Bottom Cushion
      ctx.beginPath();
      ctx.moveTo(railWidth, TABLE_HEIGHT - railWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth, TABLE_HEIGHT - railWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth - cushionWidth, TABLE_HEIGHT - railWidth - cushionWidth);
      ctx.lineTo(railWidth + cushionWidth, TABLE_HEIGHT - railWidth - cushionWidth);
      ctx.fill();
      // Left Cushion
      ctx.beginPath();
      ctx.moveTo(railWidth, railWidth);
      ctx.lineTo(railWidth, TABLE_HEIGHT - railWidth);
      ctx.lineTo(railWidth + cushionWidth, TABLE_HEIGHT - railWidth - cushionWidth);
      ctx.lineTo(railWidth + cushionWidth, railWidth + cushionWidth);
      ctx.fill();
      // Right Cushion
      ctx.beginPath();
      ctx.moveTo(TABLE_WIDTH - railWidth, railWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth, TABLE_HEIGHT - railWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth - cushionWidth, TABLE_HEIGHT - railWidth - cushionWidth);
      ctx.lineTo(TABLE_WIDTH - railWidth - cushionWidth, railWidth + cushionWidth);
      ctx.fill();

      // 4. The Felt (Green - Traditional Pool Table)
      // Base
      ctx.fillStyle = '#0D7C4D'; // Classic Pool Table Green
      ctx.fillRect(playX, playY, playW, playH);

      // Vignette / Shadow on felt edges
      const feltGrad = ctx.createRadialGradient(
        TABLE_WIDTH / 2, TABLE_HEIGHT / 2, playW / 4,
        TABLE_WIDTH / 2, TABLE_HEIGHT / 2, playW / 1.2
      );
      feltGrad.addColorStop(0, 'rgba(13, 124, 77, 0)');
      feltGrad.addColorStop(1, 'rgba(0, 50, 30, 0.4)');
      ctx.fillStyle = feltGrad;
      ctx.fillRect(playX, playY, playW, playH);

      // Textured noise for felt
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 300; i++) {
        ctx.fillRect(
          playX + Math.random() * playW,
          playY + Math.random() * playH,
          1, 1
        );
      }
      ctx.restore();

      // 5. Pockets (Holes)
      pockets.forEach(pocket => {
        // Shadow/Depth of hole
        const holeGrad = ctx.createRadialGradient(
          pocket.x, pocket.y, POCKET_RADIUS * 0.5,
          pocket.x, pocket.y, POCKET_RADIUS
        );
        holeGrad.addColorStop(0, '#000000');
        holeGrad.addColorStop(1, '#222');

        ctx.fillStyle = holeGrad;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Pocket Rim (Metal/Chrome Corner pieces) - simplified as rings or corner plates
        // Only draw standard ring for now
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 6. Corner Plates (Chrome/Gold)
      const drawCornerPlate = (x, y, rotation) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI / 2); // Quarter circle arc
        ctx.lineTo(0, 0); // back to corner
        ctx.fillStyle = 'linear-gradient(45deg, #ccc, #fff, #999)';
        // Canvas gradient needs object
        const plateGrad = ctx.createLinearGradient(0, 0, 40, 40);
        plateGrad.addColorStop(0, '#D3D3D3');
        plateGrad.addColorStop(0.5, '#FFFFFF');
        plateGrad.addColorStop(1, '#A9A9A9');
        ctx.fillStyle = plateGrad;
        ctx.fill();

        // Screw details
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(15, 10, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(10, 15, 2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
      }

      // We can draw corner plates over the wood at the 4 corners
      // Top Left
      drawCornerPlate(0, 0, 0);
      // Top Right
      drawCornerPlate(TABLE_WIDTH, 0, Math.PI / 2);
      // Bottom Right
      drawCornerPlate(TABLE_WIDTH, TABLE_HEIGHT, Math.PI);
      // Bottom Left
      drawCornerPlate(0, TABLE_HEIGHT, -Math.PI / 2);

      // 7. Head String Line (Kitchen)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      // Usually 1/4 from the right if breaking from right, or left if logic says so.
      // Logic uses startX = 0.72 which is right side. So head string is left side (0.25).
      ctx.moveTo(playX + playW * 0.25, playY);
      ctx.lineTo(playX + playW * 0.25, playY + playH);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawCue = () => {
      if (ballsMoving || !cueBall || cueBall.pocketed) return;

      const cueLength = 350;
      let cueDistance = 50 + power * 1.5;

      // If it's AI's turn and power is 0, use a default power display
      if (gameMode === 'pvc' && currentPlayerState === 2) {
        cueDistance = 50 + 30 * 1.5; // Show AI's power visually
      }

      const tipX = cueBall.x - Math.cos(aimAngle) * cueDistance;
      const tipY = cueBall.y - Math.sin(aimAngle) * cueDistance;
      const endX = tipX - Math.cos(aimAngle) * cueLength;
      const endY = tipY - Math.sin(aimAngle) * cueLength;

      ctx.save();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(endX + 3, endY + 3);
      ctx.lineTo(tipX + 3, tipY + 3);
      ctx.stroke();

      const cueGradient = ctx.createLinearGradient(endX, endY, tipX, tipY);
      cueGradient.addColorStop(0, '#8B4513');
      cueGradient.addColorStop(0.3, '#A0522D');
      cueGradient.addColorStop(0.7, '#D2691E');
      cueGradient.addColorStop(0.85, '#F5DEB3');
      cueGradient.addColorStop(1, '#FFFFFF');

      ctx.strokeStyle = cueGradient;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const offset = (i - 2) * 2;
        ctx.beginPath();
        ctx.moveTo(endX + offset, endY + offset);
        ctx.lineTo(tipX + offset, tipY + offset);
        ctx.stroke();
      }

      ctx.fillStyle = '#4169E1';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (power === 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 5;

        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);

        let lineEndX = cueBall.x;
        let lineEndY = cueBall.y;
        let hitBall = null;

        for (let i = 1; i < balls.length; i++) {
          const ball = balls[i];
          if (ball.pocketed) continue;

          const dx = ball.x - cueBall.x;
          const dy = ball.y - cueBall.y;
          const angle = Math.atan2(dy, dx);
          const angleDiff = Math.abs(angle - aimAngle);

          if (angleDiff < 0.2) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 300) {
              hitBall = ball;
              lineEndX = ball.x - Math.cos(aimAngle) * (BALL_RADIUS * 2);
              lineEndY = ball.y - Math.sin(aimAngle) * (BALL_RADIUS * 2);
              break;
            }
          }
        }

        if (!hitBall) {
          lineEndX = cueBall.x + Math.cos(aimAngle) * 250;
          lineEndY = cueBall.y + Math.sin(aimAngle) * 250;
        }

        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        if (hitBall) {
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(hitBall.x + Math.cos(aimAngle) * 150, hitBall.y + Math.sin(aimAngle) * 150);
          ctx.stroke();
        }

        ctx.restore();
      }
    };

    const drawPowerMeter = () => {
      if (ballsMoving || !cueBall || cueBall.pocketed) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      const meterX = 25;
      const meterY = TABLE_HEIGHT / 2 - 120;
      const meterWidth = 18;
      const meterHeight = 240;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(meterX - 2, meterY - 2, meterWidth + 4, meterHeight + 4);

      ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

      const powerHeight = (power / 100) * meterHeight;
      const gradient = ctx.createLinearGradient(meterX, meterY + meterHeight, meterX, meterY);
      gradient.addColorStop(0, '#00FF00');
      gradient.addColorStop(0.4, '#FFFF00');
      gradient.addColorStop(0.7, '#FFA500');
      gradient.addColorStop(1, '#FF0000');

      ctx.fillStyle = gradient;
      ctx.fillRect(meterX, meterY + meterHeight - powerHeight, meterWidth, powerHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(meterX + 2, meterY + meterHeight - powerHeight, 8, powerHeight);

      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const y = meterY + (meterHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(meterX, y);
        ctx.lineTo(meterX + meterWidth, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fillText('POWER', meterX + meterWidth / 2, meterY - 15);
      ctx.fillText(`${Math.floor(power)}%`, meterX + meterWidth / 2, meterY + meterHeight + 20);
      ctx.shadowBlur = 0;
    };



    const gameLoop = () => {
      ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      drawTable();

      if (!gameOver) {
        balls.forEach(ball => ball.update());
        checkBallCollisions();
        balls.forEach(ball => ball.draw(ctx));

        drawCue();
        drawPowerMeter();

        ballsMoving = balls.some(ball => !ball.pocketed && (Math.abs(ball.vx) > 0.01 || Math.abs(ball.vy) > 0.01));
      } else {
        // Freeze state: draw balls but do not update physics
        balls.forEach(ball => ball.draw(ctx));
        drawGameOverOverlay();
      }

      if (!ballsMoving && shotTaken) {
        shotTaken = false;

        if (foul || !ballPocketed) {
          currentPlayerState = currentPlayerState === 1 ? 2 : 1;
          messageState = foul ? `Foul! Player ${currentPlayerState}'s turn` :
            (gameMode === 'pvc' && currentPlayerState === 2 ? "AI's turn" : `Player ${currentPlayerState}'s turn`);
        } else {
          messageState = gameMode === 'pvc' && currentPlayerState === 2 ?
            'Good shot! AI continues' : `Good shot! Player ${currentPlayerState} continues`;
        }

        foul = false;
        ballPocketed = false;

        setGameState(prev => ({
          ...prev,
          currentPlayer: currentPlayerState,
          player1Balls: [...player1BallsState],
          player2Balls: [...player2BallsState],
          player1Type: player1TypeState,
          player2Type: player2TypeState,
          winner: null,
          message: messageState
        }));

        // AI turn
        if (gameMode === 'pvc' && currentPlayerState === 2 && !gameState.winner) {
          aiThinking = true;
          setGameState(prev => ({ ...prev, aiThinking: true }));
          aiThinkTimer = 0;
        }
      }

      // AI thinking delay
      if (aiThinking && !ballsMoving && !gameOver) {
        aiThinkTimer++;
        if (aiThinkTimer > 90) {
          aiTakeShot();
        }
      }

      // Keep animating so overlay can pulse when game over
      requestAnimationFrame(gameLoop);
    };

    const clientToLogical = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (TABLE_WIDTH / rect.width);
      const y = (clientY - rect.top) * (TABLE_HEIGHT / rect.height);
      return { x, y };
    };

    const handleMouseMove = (e) => {
      if (gameOver) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      const p = clientToLogical(e.clientX, e.clientY);
      mouseX = p.x;
      mouseY = p.y;

      if (!ballsMoving && cueBall && !cueBall.pocketed && !isDragging) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
      }

      if (isDragging) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        const angleToMouse = Math.atan2(dy, dx);
        const angleDiff = angleToMouse - aimAngle;

        const distAlongLine = Math.cos(angleDiff) * Math.sqrt(dx * dx + dy * dy);
        power = Math.min(100, Math.max(0, (150 - distAlongLine) / 1.5));
      }
    };

    const handleMouseDown = (e) => {

      if (gameOver) {  //29 jan
        const p = clientToLogical(e.clientX, e.clientY);
        handleRestartClick(p.x, p.y);
        return;
      }



      if (gameOver) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      if (!ballsMoving && cueBall && !cueBall.pocketed) {
        const p = clientToLogical(e.clientX, e.clientY);
        mouseX = p.x;
        mouseY = p.y;

        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
        isDragging = true;
      }
    };

    const handleMouseUp = () => {
      if (gameOver) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      if (isDragging && power > 5 && !ballsMoving && cueBall && !cueBall.pocketed) {
        const speed = power / 4;
        cueBall.vx = Math.cos(aimAngle) * speed;
        cueBall.vy = Math.sin(aimAngle) * speed;
        ballsMoving = true;
        shotTaken = true;
      }
      isDragging = false;
      power = 0;
    };

    // Touch support
    const handleTouchMove = (e) => {
      if (gameOver) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      if (!e.touches || e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      const p = clientToLogical(touch.clientX, touch.clientY);
      mouseX = p.x;
      mouseY = p.y;

      if (!ballsMoving && cueBall && !cueBall.pocketed && !isDragging) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
      }

      if (isDragging) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        const angleToMouse = Math.atan2(dy, dx);
        const angleDiff = angleToMouse - aimAngle;
        const distAlongLine = Math.cos(angleDiff) * Math.sqrt(dx * dx + dy * dy);
        power = Math.min(100, Math.max(0, (150 - distAlongLine) / 1.5));
      }
    };

    const handleTouchStart = (e) => {

      if (gameOver) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      if (!e.touches || e.touches.length === 0) return;
      e.preventDefault();
      const touch = e.touches[0];
      const p = clientToLogical(touch.clientX, touch.clientY);
      mouseX = p.x;
      mouseY = p.y;

      if (!ballsMoving && cueBall && !cueBall.pocketed) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
        isDragging = true;
      }
    };

    const handleRestartClick = (x, y) => {   //29 jan
      const btnW = 180;
      const btnH = 50;
      const btnX = TABLE_WIDTH / 2 - btnW / 2;
      const btnY = TABLE_HEIGHT / 2 + 60;

      if (
        x >= btnX &&
        x <= btnX + btnW &&
        y >= btnY &&
        y <= btnY + btnH
      ) {
        restartGame();
      }
    };


    const handleTouchEnd = (e) => {
      if (gameOver) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      if (isDragging && power > 5 && !ballsMoving && cueBall && !cueBall.pocketed) {
        const speed = power / 4;
        cueBall.vx = Math.cos(aimAngle) * speed;
        cueBall.vy = Math.sin(aimAngle) * speed;
        ballsMoving = true;
        shotTaken = true;
      }
      isDragging = false;
      power = 0;
    };

    // Resize handler: scale positions so gameplay remains consistent
    const onResize = () => {
      const oldW = TABLE_WIDTH;
      const oldH = TABLE_HEIGHT;
      const newSize = setCanvasSize();
      const newW = newSize.width;
      const newH = newSize.height;
      if (!oldW || !oldH) return;
      const scaleX = newW / oldW;
      const scaleY = newH / oldH;

      // update table sizes and scale-dependent values
      TABLE_WIDTH = newW;
      TABLE_HEIGHT = newH;
      SCALE_X = TABLE_WIDTH / 1000;
      SCALE_Y = TABLE_HEIGHT / 500;
      BALL_RADIUS = 14 * SCALE_X;
      POCKET_RADIUS = 22 * SCALE_X;
      TABLE_MARGIN = 45 * SCALE_X;

      // scale balls positions and velocities
      balls.forEach(b => {
        b.x *= scaleX;
        b.y *= scaleY;
        b.vx *= scaleX;
        b.vy *= scaleY;
        b.radius = BALL_RADIUS;
      });

      // recompute pockets
      initPockets();

      // update context transform for DPR
      ctx = canvas.getContext('2d');
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('resize', onResize);

    initPockets();
    initBalls();
    gameLoop();

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', onResize);
    };
  }, [gameMode]);
  if (!gameMode) {
    return (
      <div className="pool-game-container pool-mode-selection">
        <h1 className="pool-title">🎱 8-Ball Pool Championship</h1>
        <p style={{ color: '#ccc', marginBottom: '2rem', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)' }}>
          Choose your game mode to start playing!
        </p>

        <div className="pool-mode-buttons">
          <button className="pool-mode-button pvp" onClick={() => setGameMode('pvp')}>
            👥 Player vs Player
            <p>Player 1 vs Player 2</p>
          </button>

          <button className="pool-mode-button pvc" onClick={() => setGameMode('pvc')}>
            🤖 Player vs AI
            <p>You vs Computer</p>
          </button>
        </div>

        <div className="pool-how-to-play">
          <h3>🎮 How to Play</h3>
          <ul>
            <li>Move mouse to aim</li>
            <li>Click & drag to power</li>
            <li>Release to shoot</li>
            <li>Pocket balls then 8-ball</li>
          </ul>
        </div>
      </div>
    );
  }

  // --- UI Helpers ---
  const getRemainingBalls = (playerIdx) => {
    // If game not started or types not assigned, show empty or all?
    // Let's show all if unassigned, or specific sets.

    // Determine the set of balls this player SHOULD pocket
    let targetGroup = null; // 'solid', 'stripe', or null

    if (playerIdx === 1) targetGroup = gameState.player1Type;
    else targetGroup = gameState.player2Type;

    const solids = [1, 2, 3, 4, 5, 6, 7];
    const stripes = [9, 10, 11, 12, 13, 14, 15];
    const eightBall = [8];

    // Get balls pocketed by this player (that count for them)
    const pocketed = playerIdx === 1 ? gameState.player1Balls : gameState.player2Balls;

    let targets = [];
    if (!targetGroup) {
      // Open table: Show no specific targets or maybe '?'
      return [];
    } else if (targetGroup === 'solid') {
      targets = solids;
    } else {
      targets = stripes;
    }

    // Filter out pocketed balls
    const remaining = targets.filter(b => !pocketed.includes(b));

    // If all targets pocketed, aim for 8
    if (remaining.length === 0 && pocketed.length === 7) {
      return [8];
    }

    return remaining;
  };

  const getBallStyle = (num) => {
    const colorObj = BALL_COLORS[num];
    if (!colorObj) return {};

    const isStripe = num > 8;
    const style = {};

    if (num === 8) {
      style.background = '#000';
      style.color = '#fff';
    } else if (isStripe) {
      style.background = `linear-gradient(to bottom, #fff 20%, ${colorObj.base} 20%, ${colorObj.base} 80%, #fff 80%)`;
    } else {
      style.background = colorObj.base;
    }
    return style;
  };

  return (
    <div className="pool-game-container">
      <div className="pool-header">
        <button
          onClick={() => {
            setGameMode(null);
            setGameState({
              currentPlayer: 1,
              player1Balls: [],
              player2Balls: [],
              player1Type: null,
              player2Type: null,
              winner: null,
              message: 'Player 1: Break the rack!',
              aiThinking: false,
              pocketedBalls: []
            });
          }}
        >
          ← Back to Menu
        </button>
        <h1 className="pool-title">
          🎱 {gameMode === 'pvp' ? 'Player vs Player' : 'Player vs AI'}
        </h1>
      </div>

      {/* NEW TOP BAR UI */}
      <div className="pool-top-bar">
        {/* Player 1 Left */}
        <div className={`pool-player-dash left ${gameState.currentPlayer === 1 ? 'active' : ''}`}>
          <div className="pool-avatar-frame">
            <div className="pool-avatar-img" style={{ background: '#1a73e8' }}>👤</div>
            {gameState.winner === 1 && <div className="pool-winner-badge">🏆</div>}
          </div>

          <div className="pool-player-info-container">
            <div className="pool-player-name-box">
              {/* Star removed or added based on rank? Just static for now */}
              <span className="pool-star-badge" style={{ left: '-12px' }}></span>
              Player 1
              {gameState.player1Type && <span style={{ fontSize: '0.7em', opacity: 0.8 }}>({gameState.player1Type})</span>}
            </div>

            <div className="pool-target-balls">
              {getRemainingBalls(1).map(num => (
                <div key={num} className={`ui-ball ${num > 8 ? 'stripe' : 'solid'}`} style={getBallStyle(num)}>
                  {/* For stripes, we want the number to be legible. */}
                  <div className="ui-ball-number">{num}</div>
                </div>
              ))}
              {gameState.player1Type === null && <span style={{ color: 'white', fontSize: '0.8rem' }}>Open Table</span>}
            </div>
          </div>
        </div>

        {/* Center Status */}
        <div className="pool-status-center">
          <div className="status-vs-badge">VS</div>
          <div className="status-message">{gameState.message}</div>
          {gameState.aiThinking && <div style={{ color: 'orange', fontSize: '0.8rem', marginTop: '5px' }}>Thinking...</div>}
        </div>

        {/* Player 2 Right */}
        <div className={`pool-player-dash right ${gameState.currentPlayer === 2 ? 'active' : ''}`}>
          <div className="pool-avatar-frame">
            <div className="pool-avatar-img" style={{ background: gameMode === 'pvc' ? '#e81a1a' : '#2563eb' }}>
              {gameMode === 'pvc' ? '🤖' : '👤'}
            </div>
            {gameState.winner === 2 && <div className="pool-winner-badge">🏆</div>}
          </div>

          <div className="pool-player-info-container">
            <div className="pool-player-name-box">
              <span className="pool-star-badge" style={{ right: '-12px', left: 'auto' }}></span>
              {gameMode === 'pvc' ? 'Computer' : 'Player 2'}
              {gameState.player2Type && <span style={{ fontSize: '0.7em', opacity: 0.8 }}>({gameState.player2Type})</span>}
            </div>

            <div className="pool-target-balls">
              {getRemainingBalls(2).map(num => (
                <div key={num} className={`ui-ball ${num > 8 ? 'stripe' : 'solid'}`} style={getBallStyle(num)}>
                  <div className="ui-ball-number">{num}</div>
                </div>
              ))}
              {gameState.player2Type === null && <span style={{ color: 'white', fontSize: '0.8rem' }}>Open Table</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="pool-table-wrapper" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="pool-canvas"
        />

        {/* Glass U-Tube Structure */}
        <div className="pool-glass-tube-container">
          <div className="tube-curve-top"></div>
          <div className="glass-tube">
            <div className="tube-balls-stack">
              {(gameState.pocketedBalls || []).map((num, idx) => (
                <div key={`pocketed-tube-${idx}`} className="tube-ball" style={getBallStyle(num)}>
                  <div className="tube-ball-number">{num}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {gameState.winner && (
        <div className="pool-winner-announcement">
          <h2>
            🏆 {gameState.winner === 1 ? 'Player 1' : (gameMode === 'pvc' && gameState.winner === 2 ? 'Computer' : 'Player 2')} Wins! 🏆
          </h2>
        </div>
      )}

      <div className="pool-controls-info">
        <h3>📖 Controls:</h3>
        <ul className="pool-controls-list">
          <li>
            <span>▸</span>
            <span><strong>Aim:</strong> Move mouse to rotate cue stick</span>
          </li>
          <li>
            <span>▸</span>
            <span><strong>Power:</strong> Click and pull back to charge</span>
          </li>
          <li>
            <span>▸</span>
            <span><strong>Shoot:</strong> Release to take shot</span>
          </li>
          {gameMode === 'pvc' && (
            <li>
              <span>🤖</span>
              <span>AI will automatically take its turn</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PoolGame;