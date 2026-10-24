# Chess King

A responsive, browser-based chess game with a built-in computer opponent and local pass-and-play. The app uses standard chess rules, a 10-minute clock with a 10-second increment, and no build step or third-party game dependencies.

## Run

Open `index.html` in a current browser, or serve this folder with any static web server.
Use the website's **Download Android app** button to download and install the Chess King APK on an Android device. The APK is built and published from GitHub Actions.

To run the browser version locally, open `index.html` in a current browser or serve this folder with any static web server. The source bundle is available as `Chess-King.zip`.

The Android wrapper loads a local copy of the game, so chess play works offline after installation. The website link opens when an internet connection is available.

## Play

Choose **Play with AI** to play White against the computer, or **Two players** to pass the board between players. Select a piece to see its legal moves, then select a highlighted square. Pawns reaching the opposite end can be promoted to a queen, rook, bishop, or knight. Use **Undo** to take back the last turn (or the last full turn against the computer), **Flip board** to change the view, or **New game** to restart.

The game includes check, checkmate, stalemate, castling, en passant, promotion, the 50-move rule, threefold repetition, insufficient material, and a 10+10 game clock.

## Tests

With Node.js installed, run `node --test tests/chess.test.js` to check the chess rules engine.
