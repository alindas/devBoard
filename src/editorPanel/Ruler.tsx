
import React, { useCallback, useEffect, useRef } from "react"

import { getChangeLine } from '.'
import { IRuler, TRulerInfo } from "./interface"

const MARK_LINE_COLOR = '#3a4659'
const MARK_NUMBER_COLOR = '#90a0ae'

const Ruler = (props: IRuler) => {
  const {
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    onClick,
    zoom,
    pageZoom,
  } = props;


  const {
    /** 尺子高度 */
    scaleHeight,

    /** 起始偏移 */
    startMarginZoom: startMargin,

    /** 间距 */
    lineMargin,

    /** 精度 */
    precision,

    /** 面板长度 */
    screenWidth,

    /** 面板高度 */
    screenHeight,

  } = props.setting;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  let originCanvasInfo = useRef<TRulerInfo|null>(null).current

  /** 绘制背景色和底线 */
  const drawBackGroundUnderLine = (tempCanvas,tempContext) =>{
    tempContext.fillStyle = '#0e1013'
    tempContext.fillRect(0, 0, tempCanvas.width, 200)

    tempContext.beginPath()
    tempContext.moveTo(0, scaleHeight)
    tempContext.lineTo(tempCanvas.width, scaleHeight)
    tempContext.strokeStyle = MARK_LINE_COLOR
    tempContext.stroke()
    tempContext.closePath()
  }

  /** 绘制刻度线 */
  const drawScale = (useCallback(() =>{
    if(originCanvasInfo === null) return

    const {
      context,
      originCanvasWidth,
      originCanvasHeight,
      dprOriginCanvasWidth,
      dprOriginCanvasHeight,
      dpr
    } = originCanvasInfo

    // console.log(originCanvasInfo.current);

    let tempCanvas = document.createElement('canvas')
    let tempContext = tempCanvas.getContext('2d')!

    tempCanvas.width = dprOriginCanvasWidth
    tempCanvas.height = dprOriginCanvasHeight
    tempContext.scale(dpr,dpr)

    drawBackGroundUnderLine(tempCanvas,tempContext)

    /** 当前能绘制刻度尺的总数 */
    const scaleTotal = originCanvasWidth / lineMargin
    const [_zoom_, tolerance] = getChangeLine(zoom)
    const _zoom = 100 / _zoom_
    const _lineMargin = lineMargin * (100 + tolerance) / 100 / dpr;
    // console.log('_lineMargin', _lineMargin);

    for(let i = 0; i < scaleTotal; i++){
      tempContext.beginPath()
      tempContext.strokeStyle = MARK_LINE_COLOR
      tempContext.font = '12px SimSun, Songti SC'
      tempContext.fillStyle = MARK_NUMBER_COLOR
      tempContext.textAlign = 'center'
      tempContext.lineWidth = 1

      const drawXval = startMargin * 1 / dpr + i * _lineMargin
      if (i % 10 === 0) {
        tempContext.fillText(String(i * precision * _zoom), drawXval + 15, scaleHeight - 5)
        tempContext.moveTo(drawXval, scaleHeight)
        tempContext.lineTo(drawXval, 0)

      } else if (i % 5 === 0) {
        tempContext.fillText(String(i * precision  * _zoom), drawXval + 15, scaleHeight - 5)
        tempContext.moveTo(drawXval, scaleHeight)
        tempContext.lineTo(drawXval, scaleHeight - 5)

      } else {
        tempContext.moveTo(drawXval, scaleHeight)
        tempContext.lineTo(drawXval, scaleHeight - 4)

      }

      tempContext.stroke()
      tempContext.closePath()
    }

    context.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
    context.drawImage(tempCanvas, 0, 0, dprOriginCanvasWidth, dprOriginCanvasHeight, 0, 0, originCanvasWidth, originCanvasHeight)

  },[zoom]))

  useEffect(()=>{
    /** 初始化 */
    const drawScaleInit = () =>{

      if(!canvasRef.current) return
      // 取最长定长
      const _zoom = zoom < 110 ? 1.1 : pageZoom + 0.1;
      const width = (screenWidth > screenHeight ? screenWidth * _zoom : screenHeight * _zoom) + scaleHeight + startMargin;
      let canvas = canvasRef.current
      let context = canvas.getContext('2d')!
      const dpr = window.devicePixelRatio
      canvas.width = dpr * width;
      canvas.height = dpr * scaleHeight
      context.scale(dpr, dpr)

      // console.log(width);
      /** 设置当前值 */
      originCanvasInfo = {
        context,
        originCanvasWidth: width,
        originCanvasHeight: scaleHeight,
        dprOriginCanvasWidth: dpr * width,
        dprOriginCanvasHeight: dpr * scaleHeight,
        dpr
      }

    }
    drawScaleInit()
    drawScale()
  },[zoom])

  return (
    <canvas ref={canvasRef}
      height={scaleHeight}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onClick={onClick}
    ></canvas>
  )
}

export default Ruler
