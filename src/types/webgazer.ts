export interface GazeData {
  x: number;
  y: number;
}

export interface WebGazerParams {
  faceMeshSolutionPath: string;
  videoViewerWidth: number;
  videoViewerHeight: number;
  showVideoPreview: boolean;
  showGazeDot: boolean;
  showVideo: boolean;
  showFaceOverlay: boolean;
  showFaceFeedbackBox: boolean;
  saveDataAcrossSessions: boolean;
  [key: string]: unknown;
}

export interface WebGazerInstance {
  params: WebGazerParams;
  begin(onFail?: () => void): Promise<unknown>;
  end(): unknown;
  pause(): unknown;
  resume(): Promise<unknown>;
  setGazeListener(
    listener: (data: GazeData | null, elapsedTime: number) => void,
  ): unknown;
  clearGazeListener(): unknown;
  addMouseEventListeners(): unknown;
  removeMouseEventListeners(): unknown;
  showVideoPreview(val: boolean): unknown;
  showPredictionPoints(val: boolean): unknown;
  saveDataAcrossSessions(val: boolean): unknown;
  clearData(): Promise<void>;
  setVideoViewerSize(w: number, h: number): unknown;
  recordScreenPosition(x: number, y: number, eventType?: string): unknown;
  isReady(): boolean;
}

declare global {
  interface Window {
    webgazer: WebGazerInstance;
  }
}
