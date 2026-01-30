import React, { useState } from 'react';
import PoolGame from './components/poolgame';

function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);

  const handleStartGame = () => {
    setIsGameStarted(true);
  };

  const handleBackToHome = () => {
    setIsGameStarted(false);
  };

  return (
    <div>
      {isGameStarted ? (
        <PoolGame onBackToHome={handleBackToHome} />
      ) : (
        <div className="pool-game-container pool-mode-selection">
          <h1 className="pool-title">🎱 8-Ball Pool Championship</h1>
          <p style={{ color: '#ccc', marginBottom: '2rem', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)' }}>
            Choose your game mode to start playing!
          </p>

          <div className="pool-mode-buttons">
            <button className="pool-mode-button pvp" onClick={handleStartGame}>
              👥 Player vs Player
              <p>Player 1 vs Player 2</p>
            </button>

            <button className="pool-mode-button pvc" onClick={handleStartGame}>
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
      )}
    </div>
  );
}

export default App;
