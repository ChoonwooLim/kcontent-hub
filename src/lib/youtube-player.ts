/* YouTube IFrame Player 타입 정의 */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume(val: number): void;
  getVolume(): number;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  destroy(): void;
  // 자막(CC) 모듈 제어 — 공식 문서에는 없지만 IFrame 플레이어에서 널리 쓰이는 메서드
  loadModule(module: string): void;
  unloadModule(module: string): void;
}

declare global {
  interface Window {
    YT: {
      Player: new (id: string, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export {};
