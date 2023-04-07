import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { Popover, Slider } from 'antd';
import {
  MinusOutlined,
  PlusOutlined,
  WindowsOutlined,
  CaretUpOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';

import './index.css';
import Ruler from './Ruler.jsx';
import Line from './Line.jsx';
import Thumbnail from './Thumbnail';
import debounce from './utils/debounce.js';
import throttle from './utils/throttle.js';
import { checkOffset } from './utils/checkOffset';
import { drawLine } from './utils/drawLine';

export function getChangeLine(val) {
  if (val < 20) {
    return [20, 0]

  } else if (val >= 20 && val < 40) {
    return [20, (val - 20) * 5]

  } else if (val >= 40 && val < 80) {
    return [40, (val - 40) * 2.5]

  } else if (val >= 80 && val < 100) {
    return [80, (val - 80) * 1.25]

  } else if (val >= 100 && val < 125) {
    return [100, val - 100]

  } else if (val >= 125) {
    return [125, (val - 125) * 1.333334]

  } else {
    return [200, 0]
  }
}

const DEFAULT_SET = {
  /** 尺子高度 */
  scaleHeight: 20,

  /** 起始偏移 */
  startMargin: 40,

  /** 尺子高度，缩放后 */
  scaleHeightZoom: 20,

  /** 起始偏移，缩放后 */
  startMarginZoom: 40,

  /** 间距, 设备像素，刻度尺的当前像素长度 */
  lineMargin: 10,

  /** 精度，逻辑像素，对应实际的长度 */
  precision: 10,

  /** 屏幕画布宽度 */
  screenWidth: 1920,

  /** 屏幕画布高度 */
  screenHeight: 1080,

  /** 屏幕背景色 */
  screenBGColor: '#0d2a42',

  /** 屏幕背景图片 */
  screenBG: '',

  /** 屏幕缩放模式 */
  zoomMode: '',
}

export default function EditorPanel(props) {

  const {
    enableDrag = true,
    enableLineHelper = false,
    screenWidth,
    screenHeight,
    screenBGColor,
    screenBG,
    zoom: inheritZoom,
    makeCustomized,
    dragTarget
  } = props;

  const [zoom, setZoom] = useState(100); // 缩放大小，limit 18 to 200
  const [inputZoom, setInputZoom] = useState(100);
  // const [thumbnailZoom, setThumbnailZoom] = useState([1, 1]);
  const [showScaleLevel, changeShowScaleLevel] = useState(false); // 缩放大小开关
  const [showThumbnail, changeShowThumbnail] = useState(true); // 缩略图开关
  const [showLine, changeShowLine] = useState(true); // 是否显示参考线
  const [refreshTrigger, changeRefreshTrigger] = useState(0); // 参考线刷新扳机

  // indicator 控制尺子参考线显示
  const [hIndicator, setHIndicator] = useState(false);
  const [vIndicator, setVIndicator] = useState(false);

  // 储存尺子参考线
  const [hLines, setHLines] = useState([]);
  const [vLines, setVLines] = useState([]);

  const wpRef = useRef(null); // editor 最外层 dom
  const canvasRef = useRef(null); // canvas 最外层 dom
  const pageRef = useRef(null); // page 层 dom
  const hWpRuler = useRef(null); // 水平刻度 dom
  const hRuler = useRef(null); // 水平刻度辅助线 dom
  const hRulerValue = useRef(null); // 水平辅助线 value
  const vWpRuler = useRef(null);
  const vRuler = useRef(null);
  const vRulerValue = useRef(null);
  const lineHelperRef = useRef(null); // 对齐辅助线 canvas

  // 可通过外部传入的数据
  const defaultSetting = useRef({
    ...DEFAULT_SET,
    ...props,
  });

  // 用于自身调整值
  const originInfo = useRef({

    firstMounted: true,

    clientReact: {},

    leftOffset: 0, /** 面板距离客户端左侧距离 */
    topOffset: 0,

    ratio: 1,
    unit: 1,
    maxScale: 200,
    minScale: 18,
    selfClick: false,
    enableDrag: true,

    transformX: 0, // 缩略图水平移动距离
    transformY: 0,

    zoom: 100,
    zoomPageWidth: DEFAULT_SET.screenWidth,
    zoomPageHeight: DEFAULT_SET.screenHeight,

    dynamicTuning: null,
    enableLineHelper: false,

    vLines: {}, // 方便拖拽组件时对齐
    hLines: {},

  });

  // 初始化
  useLayoutEffect(() => {
    originInfo.current.dynamicTuning = debounce(() => selectZoom(-1), 300);
    // 溢出滚动调整
    const scrollTrimming = debounce((e) => {
      if (e.shiftKey || e.ctrlKey) {
        updateSize();
      }
    }, 300);
    document.addEventListener('mousewheel', scrollTrimming, { passive: false });
    document.addEventListener('DOMMouseScroll', scrollTrimming, { passive: false });

    // 使用 resizeObserver 监听面板宽高的动态变化
    const Performance = debounce(() => {
      updateSize();
      selectZoom(-1);
    }, 300);
    const resizeObserver = new ResizeObserver(Performance);
    resizeObserver.observe(wpRef.current);

    return () => {
      document.removeEventListener('mousewheel', scrollTrimming);
      document.removeEventListener('DOMMouseScroll', scrollTrimming);
      resizeObserver.disconnect();
      // resizeObserver.unobserve(wpRef.current);
    }
  }, [])

  // 内容拖入拖出到画布
  useEffect(() => {
    updateSize();

    wpRef.current.onmousedown = () => {
      originInfo.current.selfClick = true;
    }

    function handleDragEnd(e) {
      // 如果是在自身区域的点击或者指定是否开启响应则退出
      if (originInfo.current.selfClick || !originInfo.current.enableDrag ||
        e.clientX < originInfo.current.clientReact.left ||
        e.clientX > (originInfo.current.clientReact.left + originInfo.current.clientReact.width) ||
        e.clientY < originInfo.current.clientReact.top ||
        e.clientY > (originInfo.current.clientReact.top + originInfo.current.clientReact.height)
      ) {
        originInfo.current.selfClick = false;
        return;
      }
      const dropPos = {
        left: Math.round((e.clientX - originInfo.current.transformX - originInfo.current.leftOffset - defaultSetting.current.startMarginZoom) * originInfo.current.unit),
        top: Math.round((e.clientY - originInfo.current.transformY - originInfo.current.topOffset - defaultSetting.current.startMarginZoom) * originInfo.current.unit),
        acLeft: e.clientX,
        acTop: e.clientY,
        unit: originInfo.current.unit,
      }
      // console.log(dropPos);
      props.onDragEnd && props.onDragEnd(dropPos, true);
    }

    document.addEventListener('mouseup', handleDragEnd, true);

    return () => {
      document.removeEventListener('mouseup', handleDragEnd, true);

    }

  }, [])

  // 响应拖拽动作的辅助线条, 鼠标移动过程中接近辅助线时响应
  useEffect(() => {
    const ctx = lineHelperRef.current.getContext('2d');
    let end = false;

    const checkPos = throttle((e) => {
      const { leftOffset: ol, topOffset: ot, zoomPageWidth: ow, zoomPageHeight: oh } = originInfo.current;
      // console.log(ow, oh, e.clientX, e.clientY);
      const { startMarginZoom, screenWidth, screenHeight } = defaultSetting.current;
      const minOt = ot + startMarginZoom;
      const minOl = ol + startMarginZoom;

      if (!originInfo.current.enableLineHelper ||
        e.clientX < minOl ||
        e.clientY < minOt ||
        e.clientX > minOl + ow ||
        e.clientY > minOt + oh
      ) {
        ctx.clearRect(0, 0, screenWidth, screenHeight);
        return;
      }

      const {
        transformX,
        transformY,
        leftOffset,
        topOffset,
        domList,
        dragTarget,
        originalDragTarget,
        vLines,
        hLines,
        unit,
      } = originInfo.current;

      const { hc, vc } = defaultSetting.current;

      // console.log('e');
      const offset = 2 * unit;
      const offsetX = 50 * unit;
      const offsetY = 18 * unit;
      ctx.font = `900 ${Math.ceil(18 * unit)}px serif`;

      let ex, ey, ew = 0, eh = 0, left = -1, top = -1;
      ctx.clearRect(0, 0, screenWidth, screenHeight);
      if (dragTarget == null) { // 从资产库拖入
        ex = Math.round((e.clientX - transformX - leftOffset - startMarginZoom) * unit);
        ey = Math.round((e.clientY - transformY - topOffset - startMarginZoom) * unit);

      } else { // 拖拽改动开发面板里面的组件
        ex = Math.round(dragTarget.left);
        ey = Math.round(dragTarget.top);
        ew = Math.round(dragTarget.width);
        eh = Math.round(dragTarget.height);
        if (typeof originalDragTarget !== 'undefined' && originalDragTarget !== null) {
          ctx.fillStyle = '#BCC7D41A';
          ctx.fillRect(originalDragTarget.left, originalDragTarget.top, originalDragTarget.width, originalDragTarget.height);

        }
      }

      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4 * unit;
      ctx.setLineDash([]);

      // console.log('exu', ex);
      // console.log('exy', ey);
      if (checkOffset(ex, offset)) { // 贴左边线
        left = 0;
        drawLine(ctx, 0, 0, 0, screenHeight);

      }
      if (checkOffset(ex + ew - screenWidth, offset)) { // 贴右边线
        left = screenWidth - ew;
        drawLine(ctx, screenWidth, 0, screenWidth, screenHeight);

      }
      if (checkOffset(ey, offset)) { // 贴顶
        top = 0;
        drawLine(ctx, 0, 0, screenWidth, 0);

      }
      if (checkOffset(ey + eh - screenHeight, offset)) { // 贴底线
        top = screenHeight - eh;
        drawLine(ctx, 0, screenHeight, screenWidth, screenHeight);

      }

      // 与刻度尺对齐检查
      for (let h of Object.keys(hLines)) {
        if (checkOffset(ex - h, offset)) { // 贴左
          left = h;
          drawLine(ctx, h, 0, h, screenHeight);
          continue;
        }
        if (checkOffset(ex + ew / 2 - h, offset)) { // 贴中
          left = h - ew / 2;
          drawLine(ctx, h, 0, h, screenHeight);
          continue;
        }
        if (checkOffset(ex + ew - h, offset)) { // 贴右
          left = h - ew;
          drawLine(ctx, h, 0, h, screenHeight);
        }
      }

      for (let v of Object.keys(vLines)) {
        if (checkOffset(ey - v, offset)) { // 贴上
          top = v;
          drawLine(ctx, 0, v, screenWidth, v);
          continue;

        }
        if (checkOffset(ey + eh / 2 - v, offset)) { // 贴中
          top = v - eh / 2;
          drawLine(ctx, 0, v, screenWidth, v);
          continue;
        }
        if (checkOffset(ey + eh - v, offset)) { // 贴下
          top = v - eh;
          drawLine(ctx, 0, v, screenWidth, v);
        }
      }

      ctx.lineWidth = unit;

      if (checkOffset(ex - hc, offset)) { // 左边贴垂直中线
        left = screenWidth / 2;
        drawLine(ctx, hc, 0, hc, screenHeight);

      }
      if (checkOffset(ex + ew / 2 - hc, offset)) { // 中间贴垂直中线
        left = (screenWidth - ew) / 2;
        drawLine(ctx, hc, 0, hc, screenHeight);

      }
      if (checkOffset(ex + ew - hc, offset)) { // 右边贴垂直中线
        left = screenWidth / 2 - ew;
        drawLine(ctx, hc, 0, hc, screenHeight);

      }
      if (checkOffset(ey - vc, offset)) { // 顶部贴水平中线
        top = screenHeight / 2;
        drawLine(ctx, 0, vc, screenWidth, vc);

      }
      if (checkOffset(ey + eh / 2 - vc, offset)) { // 中间贴水平中线
        top = (screenHeight - eh) / 2;
        drawLine(ctx, 0, vc, screenWidth, vc);

      }
      if (checkOffset(ey + eh - vc, offset)) { // 底部贴水平中线
        top = screenHeight / 2 - eh;
        drawLine(ctx, 0, vc, screenWidth, vc);

      }

      // 和其他的组件进行对齐检查
      ctx.setLineDash([5 * unit]);

      domList.forEach(dom => {
        let Hit = false;
        if (checkOffset(Math.round(dom.top - ey), offset)) { // 上贴上
          top = dom.top;
          Hit = true;
          drawLine(ctx, ex, top, dom.left + dom.width, top);
          ctx.fillText(Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey - offsetY);

        }
        if (checkOffset(Math.round(dom.top + dom.height - ey), offset)) { // 上贴下
          top = dom.top + dom.height;
          Hit = true;
          drawLine(ctx, ex, top, dom.left + dom.width, top);
          ctx.fillText(Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey - offsetY);

        }
        if (checkOffset(Math.round(dom.left - ex), offset)) { // 左贴左
          left = dom.left;
          Hit = true;
          drawLine(ctx, left, ey, left, dom.top + dom.height);
          ctx.fillText(Math.round(ey - dom.top - dom.height), ex - offsetX, (ey + dom.top + dom.height) / 2);

        }
        if (checkOffset(Math.round(dom.left + dom.width - ex), offset)) { // 左贴右
          left = dom.left + dom.width;
          Hit = true;
          drawLine(ctx, left, ey, left, dom.top + dom.height);
          ctx.fillText(Math.round(ey - dom.top - dom.height), ex - offsetX, (ey + dom.top + dom.height) / 2);

        }

        if (checkOffset(Math.round(dom.left - ex - ew), offset)) { // 右贴左
          left = dom.left - ew;
          Hit = true;
          drawLine(ctx, dom.left, ey, dom.left, dom.top + dom.height);
          ctx.fillText(Math.round(ey - dom.top - dom.height), ex + ew + offsetY, (ey + dom.top + dom.height) / 2);

        }
        if (checkOffset(Math.round(dom.left + dom.width - ex - ew), offset)) { // 右贴右
          left = dom.left - dom.width + ew;
          Hit = true;
          drawLine(ctx, dom.left + dom.width, ey, dom.left + dom.width, dom.top + dom.height);
          ctx.fillText(Math.round(ey - dom.top - dom.height), ex + ew + offsetY, (ey + dom.top + dom.height) / 2);

        }
        if (checkOffset(Math.round(dom.top - ey - eh), offset)) { // 下贴上
          top = dom.top - eh;
          Hit = true;
          drawLine(ctx, ex, dom.top, dom.left + dom.width, dom.top);
          ctx.fillText(Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey + eh + offsetY);

        }
        if (checkOffset(Math.round(dom.top + dom.height - ey - eh), offset)) { // 下贴下
          top = dom.top - dom.height + eh;
          Hit = true;
          drawLine(ctx, ex, dom.top + dom.height, dom.left + dom.width, dom.top + dom.height);
          ctx.fillText(Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey + eh + offsetY);

        }

        if (Hit) {
          ctx.fillStyle = '#89d9611A';
          ctx.fillRect(dom.left, dom.top, dom.width, dom.height);

        }

      })

      if (left != -1 || top != -1) {

        end = false;
        props.onChasingLine && props.onChasingLine({
          left: Math.round(left),
          top: Math.round(top)
        });

      } else if (left == -1 && top == -1) {
        if (!end) {
          props.onChasingLine && props.onChasingLine({
            left: left,
            top: top
          });
          end = true;

        } else { // 绘制距离左边和顶部线条
          ctx.strokeStyle = '#9C9C9C';
          drawLine(ctx, 0, ey, ex, ey);
          drawLine(ctx, ex, 0, ex, ey);
          ctx.fillStyle = '#9C9C9C';
          ctx.fillText(`(${ex}  ${ey})`, ex - offsetX, ey - offsetY);
        }
      }

    }, 100);

    document.addEventListener('mousemove', checkPos);

    return () => {
      document.removeEventListener('mousemove', checkPos);

    }


  }, [])

  // 监听 ctrl + 滑轮、ctrl + 鼠标左键对画布进行缩放和移动
  useEffect(() => {

    function handleTranslate(e, type) {
      let wheelDelta = type === 'moz' ? -e.detail * 20 : e.wheelDelta;
      if (e.shiftKey) {
        originInfo.current.transformX += wheelDelta;
        if (originInfo.current.transformX > 0) {
          originInfo.current.transformX = 0;
          // return;
        } else if (wheelDelta < 0) {
          let distance_added = - originInfo.current.transformX + originInfo.current.clientReact.width - 2 * defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeight;
          // console.log(distance_added, originInfo.current.zoomPageHeight);
          // 如果超出画布则不再继续
          if (distance_added > originInfo.current.zoomPageWidth) {
            let distance = -originInfo.current.transformX + wheelDelta + originInfo.current.clientReact.width - 2 * defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeight;

            if (distance > originInfo.current.zoomPageWidth) {
              originInfo.current.transformX -= wheelDelta;
              // return;

            }
          }
        }

      } else {
        originInfo.current.transformY += wheelDelta;
        // console.log(originInfo.current.transformY);
        if (originInfo.current.transformY > 0) {
          originInfo.current.transformY = 0;
          // return;
        } else if (wheelDelta < 0) {
          let distance_added = - originInfo.current.transformY + originInfo.current.clientReact.height - 2 * defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeight;
          // console.log(distance_added, originInfo.current.zoomPageHeight);
          // 如果超出画布则不再继续
          if (distance_added > originInfo.current.zoomPageHeight) {
            let distance = -originInfo.current.transformY + wheelDelta + originInfo.current.clientReact.height - 2 * defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeight;

            if (distance > originInfo.current.zoomPageHeight) {
              originInfo.current.transformY -= wheelDelta;
              // return;

            }
          }

        }

      }

      transformDoc();
      changeRefreshTrigger(Date.now());

    }

    function handleWheel(e) {

      // 缩放
      if (e.ctrlKey) {
        e.preventDefault();
        const zoom = parseInt(originInfo.current.zoom);

        if (e.wheelDelta > 0) { // 放大
        zoom + 50 <= 200 && changeZoom(zoom + 50);

        } else {
          zoom > 18 && changeZoom(zoom - 50);

        }

      } else { // 移动
        handleTranslate(e, 'c');
      }
      // console.log(e);
    }

    function handleMOZWheel(e) {

      // 缩放
      if (e.ctrlKey) {
        e.preventDefault();
        const zoom = parseInt(originInfo.current.zoom);

        if (e.detail < 0) { // 放大
          zoom + 50 <= 200 && changeZoom(zoom + 50);

        } else {
          zoom - 50 > 18 && changeZoom(zoom - 50);

        }

      } else { // 移动
        handleTranslate(e, 'moz');
      }
    }


    wpRef.current.addEventListener('mousewheel', handleWheel, { passive: false });
    wpRef.current.addEventListener('DOMMouseScroll', handleMOZWheel, { passive: false });

    return () => {
      // wpRef.current.removeEventListener('mousewheel', handleWheel);
      // wpRef.current.removeEventListener('DOMMouseScroll', handleMOZWheel);
    }

  }, [])

  // 动态调整屏幕尺寸
  useEffect(() => {
    // console.log(props);
    const scaleHeightZoom = (props.scaleHeight ?? DEFAULT_SET.scaleHeight) * window.devicePixelRatio;
    const startMarginZoom = (props.startMargin ?? DEFAULT_SET.startMargin) * window.devicePixelRatio;
    defaultSetting.current = {
      ...DEFAULT_SET,
      scaleHeightZoom,
      startMarginZoom,
      hc: Math.round(screenWidth / 2), // 水平中心
      vc: Math.round(screenHeight / 2), // 垂直中心
      ...props,
    }
    if (isNaN(inheritZoom) || inheritZoom === -1) {
      originInfo.current.dynamicTuning();

    } else {
      inheritZoom !== zoom && selectZoom(inheritZoom);
    }
  }, [screenWidth, screenHeight, inheritZoom])

  useEffect(() => {
    originInfo.current.enableDrag = enableDrag;
  }, [enableDrag])

  // 动态更新组件布局信息
  useEffect(() => {
    originInfo.current.dragTarget = dragTarget;
    // console.log(props.dragTarget);
  }, [makeCustomized])

  // 根据开关切换辅助线的显隐
  useEffect(() => {
    originInfo.current.enableLineHelper = enableLineHelper;
    originInfo.current.domList = makeCustomized;
    if (!enableLineHelper) {
      originInfo.current.dragTarget = null;
      originInfo.current.originalDragTarget = null;
      props.onChasingLine && props.onChasingLine({
        left: -1,
        top: -1
      });
    } else {
      originInfo.current.originalDragTarget = dragTarget;
    }

  }, [enableLineHelper])

  // 控制第一次挂载
  // useEffect(() => {
  //   // originInfo.current.firstMounted = false;
  // }, [])

  function updateSize() {
    if (wpRef.current == null) return;
    if (zoom >= 18 || zoom <= 200) {
      defaultSetting.current.scaleHeightZoom = defaultSetting.current.scaleHeight * window.devicePixelRatio;
      defaultSetting.current.startMarginZoom = defaultSetting.current.startMargin * window.devicePixelRatio;

    }

    const offsetXY = wpRef.current.getBoundingClientRect();
    originInfo.current.clientReact = offsetXY;
    originInfo.current.leftOffset = Math.ceil(offsetXY.left) + defaultSetting.current.scaleHeightZoom; // 起始位置离视口左边距
    originInfo.current.topOffset = Math.ceil(offsetXY.top) + defaultSetting.current.scaleHeightZoom; // 起始位置离视口上边距
    originInfo.current.ratio = defaultSetting.current.precision / defaultSetting.current.lineMargin; // 设备像素比

  }

  // 刻度线，页面位置调整
  function transformDoc() {
    pageRef.current.style.transform =
      `scale(${1 / originInfo.current.unit}) translate(${originInfo.current.transformX * originInfo.current.unit}px,${originInfo.current.transformY * originInfo.current.unit}px)`;
    hWpRuler.current.style.transform = `translateX(${originInfo.current.transformX}px`;
    vWpRuler.current.style.transform = `rotate(90deg) translateX(${originInfo.current.transformY}px`;
  }

  // 进入刻度尺
  function handleMouseEnter(e, type = 'h') {
    // console.log(defaultSetting.current);
    switch (type) {
      case 'h': {
        setHIndicator(true);
        Promise.resolve().then(() => {
          hRuler.current.setAttribute('style', `left: ${e.clientX - originInfo.current.leftOffset}px; transform: translateY(${defaultSetting.current.scaleHeight}px)`);

        }, 50);
        break;

      }

      case 'v': {
        setVIndicator(true);
        Promise.resolve().then(() => {
          vRuler.current.setAttribute('style', `left: ${e.clientY - originInfo.current.topOffset}px; transform: translateY(-100%)`);

        });
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  // 离开刻度尺
  function handleMouseLeave(e, type = 'h') {
    switch (type) {
      case 'h': {
        setHIndicator(false);
        break;

      }

      case 'v': {
        setVIndicator(false);
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  // 在刻度尺上移动
  function handleMouseMove(e, type = 'h') {
    switch (type) {
      case 'h': {
        if (hIndicator) {
          const leftOffset = e.clientX - originInfo.current.transformX - originInfo.current.leftOffset;
          hRuler.current.setAttribute('style', `left: ${leftOffset}px; transform: translateY(${defaultSetting.current.scaleHeightZoom}px)`);
          hRulerValue.current.innerHTML = Math.round((leftOffset - defaultSetting.current.startMarginZoom) * originInfo.current.unit);

        } else {
          setHIndicator(true);
        }
        break;

      }

      case 'v': {
        if (vIndicator) {
          const topOffset = e.clientY - originInfo.current.transformY - originInfo.current.topOffset;
          vRuler.current.setAttribute('style', `left: ${topOffset}px; transform: translateY(-100%)`);
          vRulerValue.current.innerHTML = Math.round((topOffset - defaultSetting.current.startMarginZoom) * originInfo.current.unit);

        } else {
          setVIndicator(true);
        }
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }

  }

  // 创建参考线
  function handleRulerClick(e, type = 'h') {
    // console.log('x', e.clientX);
    // console.log('y', e.clientY);
    // console.log(defaultSetting.current);
    switch (type) {
      case 'h': {
        const realPos = e.clientX - originInfo.current.transformX - originInfo.current.leftOffset - defaultSetting.current.startMarginZoom;
        const lines = hLines.filter(item => item != realPos);
        lines.push(realPos);
        originInfo.current.hLines[Math.round(realPos * originInfo.current.unit)] = 1;

        setHLines(lines);
        setHIndicator(false);
        break;

      }

      case 'v': {
        const realPos = e.clientY - originInfo.current.transformY - originInfo.current.topOffset - defaultSetting.current.startMarginZoom;
        const lines = vLines.filter(item => item != realPos);
        lines.push(realPos);
        // originInfo.current.vLines.push(Math.round(realPos * originInfo.current.unit));
        originInfo.current.vLines[Math.round(realPos * originInfo.current.unit)] = 1;

        setVLines(lines);
        setVIndicator(false);
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  // 双击删除参考线
  function handleLineDBClick(val, type) {
    switch (type) {
      case 'h': {
        const lines = hLines.filter(item => item != val);
        delete originInfo.current.hLines[Math.round(val * originInfo.current.unit)];
        setHLines(lines);
        break;

      }

      case 'v': {
        const lines = vLines.filter(item => item != val);
        delete originInfo.current.vLines[Math.round(val * originInfo.current.unit)];
        setVLines(lines);
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  // 移动参考线
  function handleLineDragEnd(pre, suf, type) {
    switch (type) {
      case 'h': {
        const lines = hLines.filter(item => item != pre);
        delete originInfo.current.hLines[Math.round(pre * originInfo.current.unit)];
        originInfo.current.hLines[Math.round(suf * originInfo.current.unit)] = 1;
        lines.push(suf);
        setHLines(lines);
        break;

      }

      case 'v': {
        const lines = vLines.filter(item => item != pre);
        delete originInfo.current.vLines[Math.round(pre * originInfo.current.unit)];
        originInfo.current.vLines[Math.round(suf * originInfo.current.unit)] = 1;
        lines.push(suf);
        setVLines(lines);
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  function changeZoom(value) {
    const val = value < originInfo.current.minScale ? originInfo.current.minScale :
      value > originInfo.current.maxScale ? originInfo.current.maxScale : value;
    const [_zoom_, tolerance] = getChangeLine(val)

    const _zoom = 100 / _zoom_
    const _lineMargin = defaultSetting.current.lineMargin * (100 + tolerance) / 100;
    // console.log('_zoom', _zoom, '_lm', _lineMargin);

    let unit = defaultSetting.current.precision * _zoom / _lineMargin;
    // console.log('or', originInfo.current.unit);

    // page 页面缩放
    const pageScaleZoom = 1 / unit;

    // 缩略图缩放
    // const thumbnail_zoom_width = (wpRef.current.clientWidth - defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeightZoom)
    //   / (defaultSetting.current.screenWidth * pageScaleZoom);

    // const thumbnail_zoom_height = (wpRef.current.clientHeight - defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeightZoom)
    //   / (defaultSetting.current.screenHeight * pageScaleZoom);

    // const thumbnail_zoom_width = (wpRef.current.clientWidth - defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeightZoom)
    //   / (defaultSetting.current.screenWidth * val / 100);

    // const thumbnail_zoom_height = (wpRef.current.clientHeight - defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeightZoom)
    //   / (defaultSetting.current.screenHeight * val / 100);

    // console.log('thumbnail_zoom', thumbnail_zoom_width, thumbnail_zoom_height);

    // 便于在 mousewheel 回调中拿到最新值
    originInfo.current.zoom = val;

    let transform_ratio = originInfo.current.unit / unit;
    originInfo.current.zoomPageHeight = defaultSetting.current.screenHeight * pageScaleZoom;
    originInfo.current.zoomPageWidth = defaultSetting.current.screenWidth * pageScaleZoom;
    // console.log(originInfo.current.transformX);
    originInfo.current.transformX *= transform_ratio;
    originInfo.current.transformY *= transform_ratio;
    originInfo.current.unit = unit;
    // console.log(originInfo.current.transformX);

    transformDoc();

    setZoom(val);
    setInputZoom(val);
    // setThumbnailZoom([thumbnail_zoom_width > 1 ? 1 : thumbnail_zoom_width, thumbnail_zoom_height > 1 ? 1 : thumbnail_zoom_height]);

    props.onChangeZoom && props.onChangeZoom({
      zoom: value,
      unit: originInfo.current.unit
    });

  }

  function selectZoom(val) {
    if (wpRef.current == null) return;
    if (val !== -1) {
      changeZoom(val);
    } else { // 自适应调整
      // console.log('default', defaultSetting.current);
      let widthRatio = (wpRef.current.clientWidth - defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeightZoom) / defaultSetting.current.screenWidth;
      let heightRatio = (wpRef.current.clientHeight - defaultSetting.current.startMarginZoom - defaultSetting.current.scaleHeightZoom) / defaultSetting.current.screenHeight;
      // console.log('ratio', widthRatio, heightRatio);
      let side = widthRatio > heightRatio ? heightRatio : widthRatio;
      changeZoom(Math.round((side * 100 - 3)));
    }
    changeShowScaleLevel(false);
  }

  // function handleThumbnailMove(val) {
  //   // console.log(originInfo.current.unit);
  //   pageRef.current.style.transform =
  //     `scale(${1 / originInfo.current.unit}) translate(-${(val.transformX) * 10}px,-${val.transformY * 10 * originInfo.current.unit}px)`;
  //   hWpRuler.current.style.transform = `translateX(-${val.transformX * 10 / originInfo.current.unit}px`;
  //   vWpRuler.current.style.transform = `rotate(90deg) translateX(-${val.transformY * 10}px`;
  // }

  // function handleThumbnailMoveEnd(val) {
  //   pageRef.current.style.transition = '.2s all linear';
  //   // pageRef.current.style.transformOrigin = `${val.transformX * 10}px ${val.transformY * 10}px`;
  //   originInfo.current.transformX = val.transformX * 10 / originInfo.current.unit;
  //   originInfo.current.transformY = val.transformY * 10;
  //   setHLines([...hLines]);
  //   setVLines([...vLines]);
  // }

  const hLineNodes = useMemo(() =>
    hLines.map(item => <Line key={item}
      type="h"
      setting={{
        startMargin: defaultSetting.current.startMarginZoom,
        leftOffset: originInfo.current.leftOffset,
        topOffset: originInfo.current.topOffset,
        transformX: originInfo.current.transformX,
      }}
      unit={originInfo.current.unit}
      left={item}
      disable={!showLine}
      top={defaultSetting.current.scaleHeightZoom}
      onDoubleClick={() => handleLineDBClick(item, 'h')}
      onDragEnd={(v) => handleLineDragEnd(item, v, 'h')}
    />)
    , [hLines, zoom, showLine, refreshTrigger]);

  const vLineNodes = useMemo(() =>
    vLines.map(item => <Line key={item}
      type="v"
      setting={{
        startMargin: defaultSetting.current.startMarginZoom,
        leftOffset: originInfo.current.leftOffset,
        topOffset: originInfo.current.topOffset,
        transformY: originInfo.current.transformY,
      }}
      unit={originInfo.current.unit}
      left={item}
      disable={!showLine}
      onDoubleClick={() => handleLineDBClick(item, 'v')}
      onDragEnd={(v) => handleLineDragEnd(item, v, 'v')}
    />)
    , [vLines, zoom, showLine, refreshTrigger]);

  const scaleLevel = (
    <ul className="scale-value-list" onClick={(e) => selectZoom(e.target.value)}>
      <li value={200}>200%</li>
      <li value={150}>150%</li>
      <li value={100}>100%</li>
      <li value={50}>50%</li>
      <li value={-1}>自适应</li>
    </ul>
  );

  const sliderNode = useMemo(() => <div className="zoom-slider">
    <MinusOutlined className="zoom-icon zoom-out" onClick={() => changeZoom(zoom - 17)} />
    <Slider value={zoom} onChange={changeZoom} max={originInfo.current.maxScale} min={originInfo.current.minScale} step={17} />
    <PlusOutlined className="zoom-icon zoom-in" onClick={() => changeZoom(zoom + 17)} />
  </div>, [zoom]);

  return (
    <div className="editor-panel-wp" ref={wpRef}>
      <div className="editor-panel-main">
        <div className="canvas-wp" id='canvas-wp' ref={canvasRef}>
          <div className="ruler">
            <div className="ruler-wp horizontal"
              id='rulerT'
              ref={hWpRuler}
              style={{
                height: defaultSetting.current.scaleHeightZoom,
                left: defaultSetting.current.scaleHeightZoom + 'px'
              }}
            >
              <Ruler
                defaultSetting={defaultSetting.current}
                zoom={zoom}
                pageZoom={1 / originInfo.current.unit}
                onMouseEnter={(e) => handleMouseEnter(e, 'h')}
                onMouseLeave={(e) => handleMouseLeave(e, 'h')}
                onMouseMove={(e) => handleMouseMove(e, 'h')}
                onClick={(e) => handleRulerClick(e, 'h')}
              />
              <div className="lines-wp">
                {hLineNodes}
              </div>
              {
                hIndicator &&
                <div className="indicator-line" ref={hRuler}>
                  <div className="line-action">
                    <span ref={hRulerValue}></span>
                  </div>
                </div>
              }
            </div>
            <div className="ruler-wp vertical"
              id='rulerL'
              ref={vWpRuler}
              style={{ height: defaultSetting.current.scaleHeightZoom }}>
              <Ruler
                defaultSetting={defaultSetting.current}
                zoom={zoom}
                pageZoom={1 / originInfo.current.unit}
                onMouseEnter={(e) => handleMouseEnter(e, 'v')}
                onMouseLeave={(e) => handleMouseLeave(e, 'v')}
                onMouseMove={(e) => handleMouseMove(e, 'v')}
                onClick={(e) => handleRulerClick(e, 'v')}
              />
              <div className="lines-wp">
                {vLineNodes}
              </div>
              {
                vIndicator &&
                <div className="indicator-line" ref={vRuler}>
                  <div className="line-action">
                    <span ref={vRulerValue}></span>
                  </div>
                </div>
              }
            </div>
            <div className="viewer-toggle" style={{
              width: defaultSetting.current.scaleHeightZoom,
              height: defaultSetting.current.scaleHeightZoom
            }}
              title={showLine ? '隐藏辅助线' : '显示辅助线'}
              onClick={() => changeShowLine(!showLine)}
            >
              {showLine ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            </div>
          </div>
          <div className="page" id='page' ref={pageRef}
            style={{
              width: isNaN(screenWidth) ? 0 : screenWidth,
              height: isNaN(screenHeight) ? 0 : screenHeight,
              top: (defaultSetting.current.scaleHeightZoom + defaultSetting.current.startMarginZoom) + 'px',
              left: (defaultSetting.current.scaleHeightZoom + defaultSetting.current.startMarginZoom) + 'px',
              backgroundColor: screenBGColor,
              backgroundImage: screenBG ? `url(${screenBG})` : '',
            }}
          // onMoveStart={() => pageRef.current.style.transition = 'none'}
          // onMove={handleThumbnailMove}
          // onMoveEnd={handleThumbnailMoveEnd}
          >
            {props.children}
            <canvas ref={lineHelperRef}
              width={isNaN(screenWidth) ? 0 : screenWidth}
              height={isNaN(screenHeight) ? 0 : screenHeight}
              className="drag-helper-canvas"
              style={enableLineHelper ? {} : { display: 'none' }}
            ></canvas>
          </div>
        </div>

        <Thumbnail
          domList={makeCustomized}
          visibility={showThumbnail}
          width={screenWidth}
          height={screenHeight}
          zoom={screenWidth / 1920 * 10}
          // onMoveStart={() => pageRef.current.style.transition = 'none'}
          // onMove={handleThumbnailMove}
          // onMoveEnd={handleThumbnailMoveEnd}
          bgColor={screenBGColor}
        />

        <div className="edit-slider" id='edit-slider'>
          <div className="scale-leval-input-wp">
            <input type="number"
              className="scale-input"
              max={originInfo.current.maxScale}
              min={originInfo.current.minScale}
              step={1}
              value={inputZoom}
              onChange={(e) => setInputZoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && changeZoom(e.target.value)}
            />
            <Popover
              overlayClassName="zoom-selected-wp"
              content={scaleLevel}
              trigger="click"
              visible={showScaleLevel}
              onVisibleChange={changeShowScaleLevel}
            >
              <span className="percent" onClick={() => changeShowScaleLevel(!showScaleLevel)}>%<CaretUpOutlined /></span>
            </Popover>
          </div>
          {sliderNode}
          <div className="toggle-thumbnail" onClick={() => changeShowThumbnail(!showThumbnail)}>
            <WindowsOutlined />
          </div>
        </div>
      </div>
    </div>
  )
}
