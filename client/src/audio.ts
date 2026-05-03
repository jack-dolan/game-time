function tryPlay(url: string): void {
  new Audio(url).play().catch(() => {});
}

export function playLetsGoGambling(): void {
  tryPlay('/audio/lets-go-gambling.mp3');
}

export function playWin(): void {
  tryPlay('/audio/lets-go-gambling-win.mp3');
}

export function playDangit(): void {
  tryPlay('/audio/aw-dangit.mp3');
}
