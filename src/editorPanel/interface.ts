
export type dropPos = {
  left: number,
  top: number,
  acLeft: number,
  acTop: number,
  unit: number
}

export default interface IEditorPanel {
  enableDrag: boolean,
  enableLineHelper: boolean,
  scaleHeight: number,
  startMargin: number,
  screenWidth: number,
  screenHeight: number,
  screenBGColor: string,
  screenBG: string,
  zoom: number,
  makeCustomized: [],
  dragTarget: [],
  children: React.ReactNode,
  onDragEnd: (pos: dropPos, trigger: boolean) => void,
  onChasingLine: (pos: { left: number, top: number }) => void,
  onChangeZoom: (v: {zoom: number, unit: number }) => void
}

export interface IDefaultSet extends Partial<IEditorPanel> {
  scaleHeightZoom: number,
  startMarginZoom: number,
  lineMargin: number,
  precision: number,
  zoomMode: string,
  hc?: number,
  vc?: number
}

export type TOriginInfo = {
  firstMounted: boolean,
  clientReact?: DOMRect,
  leftOffset: number, /** 面板距离客户端左侧距离 */
  topOffset: number,
  ratio: number,
  unit: number,
  maxScale: number,
  minScale: number,
  selfClick: boolean,
  enableDrag: boolean,
  transformX: number, // 缩略图水平移动距离
  transformY: number,
  zoom: number,
  zoomPageWidth: number,
  zoomPageHeight: number,
  dynamicTuning: Function | null,
  enableLineHelper: boolean,
  vLines: {[k: string]: 1}, // 方便拖拽组件时对齐
  hLines: {[k: string]: 1},
  domList?: any,
  dragTarget?: any,
  originalDragTarget?: any
}

export interface IRuler {
  setting: IDefaultSet,
  zoom: number,
  pageZoom: number,
  onMouseEnter: (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void,
  onMouseLeave: (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void,
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void,
  onClick: (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void,
}

export type TRulerInfo = {
  context: CanvasRenderingContext2D,
  originCanvasWidth: number,
  originCanvasHeight: number,
  dprOriginCanvasWidth: number,
  dprOriginCanvasHeight: number,
  dpr: number
}


export type LineSet = {
  startMargin: number,
  leftOffset: number,
  topOffset: number,
  transformX?: number,
  transformY?: number
}

export interface ILine {
  type: 'h' | 'v',
  setting: LineSet,
  unit: number,
  left: any,
  disable: boolean,
  top?: number,
  onDoubleClick: () => void,
  onDragEnd: (v: any) => void,
}
