import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import Popover from '../popover';
import Slider from 'rc-slider';
import {
  MinusOutlined,
  PlusOutlined,
  WindowsOutlined,
  CaretUpOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from './asset/icons'

import IEditorPanel, { IDefaultSet, TOriginInfo } from './interface'
import './index.css';
import Ruler from './Ruler';
import Line from './Line';
import Thumbnail from './Thumbnail';
import debounce from './utils/debounce.js';
import throttle from './utils/throttle.js';
import { checkOffset } from './utils/checkOffset';
import { drawLine } from './utils/drawLine';

export function getChangeLine(val: number) {
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

// let Shaking: NodeJS.Timeout; // 辅助线显示防抖开关

export default function EditorPanel(props: Partial<IEditorPanel>) {

  const {
    enableDrag = true,
    enableLineHelper = false,
    screenWidth = DEFAULT_SET.screenWidth,
    screenHeight = DEFAULT_SET.screenHeight,
    screenBGColor = DEFAULT_SET.screenBGColor,
    screenBG,
    zoom: inheritZoom,
    makeCustomized,
    dragTarget
  } = props;

  const [zoom, setZoom] = useState(100); // 缩放大小，limit 18 to 200
  const [inputZoom, setInputZoom] = useState(100);
  // const [thumbnailZoom, setThumbnailZoom] = useState([1, 1]);
  const [showThumbnail, changeShowThumbnail] = useState(true); // 缩略图开关
  const [showLine, changeShowLine] = useState(true); // 是否显示参考线
  const [refreshTrigger, changeRefreshTrigger] = useState(0); // 参考线刷新扳机

  // indicator 控制尺子参考线显示
  const [hIndicator, setHIndicator] = useState(false);
  const [vIndicator, setVIndicator] = useState(false);

  // 储存尺子参考线
  const [hLines, setHLines] = useState<number[]>([]);
  const [vLines, setVLines] = useState<number[]>([]);

  const wpRef = useRef<HTMLDivElement>(null); // editor 最外层 dom
  const canvasRef = useRef<HTMLDivElement>(null); // canvas 最外层 dom
  const pageRef = useRef<HTMLDivElement>(null); // page 层 dom
  const hWpRuler = useRef<HTMLDivElement>(null); // 水平刻度 dom
  const hRuler = useRef<HTMLDivElement>(null); // 水平刻度辅助线 dom
  const hRulerValue = useRef<HTMLSpanElement>(null); // 水平辅助线 value
  const vWpRuler = useRef<HTMLDivElement>(null);
  const vRuler = useRef<HTMLDivElement>(null);
  const vRulerValue = useRef<HTMLSpanElement>(null);
  const lineHelperRef = useRef<HTMLCanvasElement>(null); // 对齐辅助线 canvas

  // 基本面板信息
  let defaultSetting = useRef<IDefaultSet>({
    ...DEFAULT_SET,
    scaleHeight: props.scaleHeight??DEFAULT_SET.scaleHeight,
    screenWidth,
    screenHeight,
  }).current;

  // 用于自身功能逻辑访问
  const originInfo = useRef<TOriginInfo>({

    firstMounted: true,

    clientReact: {left: 0, top: 0, width: 0, height: 0},

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

  }).current;

  // 初始化
  useLayoutEffect(() => {
    originInfo.dynamicTuning = debounce(() => selectZoom(-1), 300);
    // 溢出滚动调整
    const scrollTrimming: any = debounce((e: { shiftKey: any; ctrlKey: any; }) => {
      if (e.shiftKey || e.ctrlKey) {
        updateSize();
      }
    }, 300);
    document.addEventListener('wheel', scrollTrimming, { passive: false });
    document.addEventListener('mousewheel', scrollTrimming, { passive: false }); // 兼容低版本 -webkit 浏览器
    document.addEventListener('DOMMouseScroll', scrollTrimming, { passive: false }); // 兼容低版本 -ff 浏览器

    // 使用 resizeObserver 监听面板宽高的动态变化
    const performanceFn: any = debounce(() => {
      updateSize();
      selectZoom(-1);
    }, 300);
    const resizeObserver = new ResizeObserver(performanceFn);
    resizeObserver.observe(wpRef.current!);

    return () => {
      document.removeEventListener('wheel', scrollTrimming);
      document.removeEventListener('mousewheel', scrollTrimming);
      document.removeEventListener('DOMMouseScroll', scrollTrimming);
      resizeObserver.disconnect();
      // resizeObserver.unobserve(wpRef.current);
    }
  }, [])

  // 内容拖入拖出到画布
  useEffect(() => {
    updateSize();

    wpRef.current!.onmousedown = () => {
      originInfo.selfClick = true;
    }

    function handleDragEnd(e: MouseEvent) {
      // 如果是在自身区域的点击或者指定是否开启响应则退出
      if (originInfo.selfClick || !originInfo.enableDrag ||
        e.clientX < originInfo.clientReact.left ||
        e.clientX > (originInfo.clientReact.left + originInfo.clientReact.width) ||
        e.clientY < originInfo.clientReact.top ||
        e.clientY > (originInfo.clientReact.top + originInfo.clientReact.height)
      ) {
        originInfo.selfClick = false;
        return;
      }
      const dropPos = {
        left: Math.round((e.clientX - originInfo.transformX - originInfo.leftOffset - defaultSetting.startMarginZoom) * originInfo.unit),
        top: Math.round((e.clientY - originInfo.transformY - originInfo.topOffset - defaultSetting.startMarginZoom) * originInfo.unit),
        acLeft: e.clientX,
        acTop: e.clientY,
        unit: originInfo.unit,
      }
      // console.log(dropPos);
      props.onDragEnd?.(dropPos, true);
    }

    document.addEventListener('mouseup', handleDragEnd, true);

    return () => {
      document.removeEventListener('mouseup', handleDragEnd, true);

    }

  }, [])

  // 响应拖拽动作的辅助线条, 鼠标移动过程中接近辅助线时响应
  useEffect(() => {
    const ctx = lineHelperRef.current!.getContext('2d')!;
    let end = false;

    const checkPos: any = throttle((e: MouseEvent) => {
      const { leftOffset: ol, topOffset: ot, zoomPageWidth: ow, zoomPageHeight: oh } = originInfo;
      // console.log(ow, oh, e.clientX, e.clientY);
      const { startMarginZoom, screenWidth, screenHeight } = defaultSetting;
      const minOt = ot + startMarginZoom;
      const minOl = ol + startMarginZoom;

      if (!originInfo.enableLineHelper ||
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
      } = originInfo;


      // console.log('e');
      const offset = 2 * unit;
      const offsetX = 50 * unit;
      const offsetY = 18 * unit;
      ctx.font = `900 ${Math.ceil(18 * unit)}px serif`;

      let ex: number, ey: number, ew = 0, eh = 0, left = -1, top = -1;
      ctx.clearRect(0, 0, screenWidth, screenHeight);
      if (typeof dragTarget === 'undefined' || dragTarget == null) { // 从资产库拖入
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
      for (let strH of Object.keys(hLines)) {
        const h = +strH;
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

      for (let strV of Object.keys(vLines)) {
        const v = +strV;
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
      const hc = Math.round(screenWidth / 2); // 水平中心
      const vc = Math.round(screenHeight / 2); // 垂直中心

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

      Array.isArray(domList) && domList.forEach((dom: { top: number; left: number; width: number; height: number; }) => {
        let Hit = false;
        if (checkOffset(Math.round(dom.top - ey), offset)) { // 上贴上
          top = dom.top;
          Hit = true;
          drawLine(ctx, ex, top, dom.left + dom.width, top);
          ctx.fillText(''+Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey - offsetY);

        }
        if (checkOffset(Math.round(dom.top + dom.height - ey), offset)) { // 上贴下
          top = dom.top + dom.height;
          Hit = true;
          drawLine(ctx, ex, top, dom.left + dom.width, top);
          ctx.fillText(''+Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey - offsetY);

        }
        if (checkOffset(Math.round(dom.left - ex), offset)) { // 左贴左
          left = dom.left;
          Hit = true;
          drawLine(ctx, left, ey, left, dom.top + dom.height);
          ctx.fillText(''+Math.round(ey - dom.top - dom.height), ex - offsetX, (ey + dom.top + dom.height) / 2);

        }
        if (checkOffset(Math.round(dom.left + dom.width - ex), offset)) { // 左贴右
          left = dom.left + dom.width;
          Hit = true;
          drawLine(ctx, left, ey, left, dom.top + dom.height);
          ctx.fillText(''+Math.round(ey - dom.top - dom.height), ex - offsetX, (ey + dom.top + dom.height) / 2);

        }

        if (checkOffset(Math.round(dom.left - ex - ew), offset)) { // 右贴左
          left = dom.left - ew;
          Hit = true;
          drawLine(ctx, dom.left, ey, dom.left, dom.top + dom.height);
          ctx.fillText(''+Math.round(ey - dom.top - dom.height), ex + ew + offsetY, (ey + dom.top + dom.height) / 2);

        }
        if (checkOffset(Math.round(dom.left + dom.width - ex - ew), offset)) { // 右贴右
          left = dom.left - dom.width + ew;
          Hit = true;
          drawLine(ctx, dom.left + dom.width, ey, dom.left + dom.width, dom.top + dom.height);
          ctx.fillText(''+Math.round(ey - dom.top - dom.height), ex + ew + offsetY, (ey + dom.top + dom.height) / 2);

        }
        if (checkOffset(Math.round(dom.top - ey - eh), offset)) { // 下贴上
          top = dom.top - eh;
          Hit = true;
          drawLine(ctx, ex, dom.top, dom.left + dom.width, dom.top);
          ctx.fillText(''+Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey + eh + offsetY);

        }
        if (checkOffset(Math.round(dom.top + dom.height - ey - eh), offset)) { // 下贴下
          top = dom.top - dom.height + eh;
          Hit = true;
          drawLine(ctx, ex, dom.top + dom.height, dom.left + dom.width, dom.top + dom.height);
          ctx.fillText(''+Math.round(ex - dom.left - dom.width), (ex + dom.left + dom.width) / 2, ey + eh + offsetY);

        }

        if (Hit) {
          ctx.fillStyle = '#89d9611A';
          ctx.fillRect(dom.left, dom.top, dom.width, dom.height);

        }

      })
      if (left != -1 || top != -1) {

        end = false;
        props.onChasingLine?.({
          left: Math.round(left),
          top: Math.round(top)
        });

      } else if (left == -1 && top == -1) {
        if (!end) {
          props.onChasingLine?.({
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

    function handleTranslate(e: WheelEvent, type: string) {
      let wheelDelta = type === 'moz' ? -e.detail * 20 : e['wheelDelta'];
      if (e.shiftKey) {
        originInfo.transformX += wheelDelta;
        if (originInfo.transformX > 0) {
          originInfo.transformX = 0;
          // return;
        } else if (wheelDelta < 0) {
          let distance_added = - originInfo.transformX + originInfo.clientReact.width - 2 * defaultSetting.startMarginZoom - defaultSetting.scaleHeight;
          // console.log(distance_added, originInfo.zoomPageHeight);
          // 如果超出画布则不再继续
          if (distance_added > originInfo.zoomPageWidth) {
            let distance = -originInfo.transformX + wheelDelta + originInfo.clientReact.width - 2 * defaultSetting.startMarginZoom - defaultSetting.scaleHeight;

            if (distance > originInfo.zoomPageWidth) {
              originInfo.transformX -= wheelDelta;
              // return;

            }
          }
        }

      } else {
        originInfo.transformY += wheelDelta;
        // console.log(originInfo.transformY);
        if (originInfo.transformY > 0) {
          originInfo.transformY = 0;
          // return;
        } else if (wheelDelta < 0) {
          let distance_added = - originInfo.transformY + originInfo.clientReact.height - 2 * defaultSetting.startMarginZoom - defaultSetting.scaleHeight;
          // console.log(distance_added, originInfo.zoomPageHeight);
          // 如果超出画布则不再继续
          if (distance_added > originInfo.zoomPageHeight) {
            let distance = -originInfo.transformY + wheelDelta + originInfo.clientReact.height - 2 * defaultSetting.startMarginZoom - defaultSetting.scaleHeight;

            if (distance > originInfo.zoomPageHeight) {
              originInfo.transformY -= wheelDelta;
              // return;

            }
          }

        }

      }

      transformDoc();
      changeRefreshTrigger(Date.now());

    }

    function handleWheel(e: any) {

      // 缩放
      if (e.ctrlKey) {
        e.preventDefault();
        const zoom = originInfo.zoom;

        if (e['wheelDelta'] > 0) { // 放大
        zoom + 50 <= 200 && changeZoom(zoom + 50);

        } else {
          zoom > 18 && changeZoom(zoom - 50);

        }

      } else { // 移动
        handleTranslate(e, 'webkit');
      }
      // console.log(e);
    }

    function handleMOZWheel(e: any) {

      // 缩放
      if (e.ctrlKey) {
        e.preventDefault();
        const zoom = originInfo.zoom;

        if (e.detail < 0) { // 放大
          zoom + 50 <= 200 && changeZoom(zoom + 50);

        } else {
          zoom - 50 > 18 && changeZoom(zoom - 50);

        }

      } else { // 移动
        handleTranslate(e, 'moz');
      }
    }


    wpRef.current!.addEventListener('wheel', handleWheel, { passive: false });
    wpRef.current!.addEventListener('mousewheel', handleWheel, { passive: false });
    wpRef.current!.addEventListener('DOMMouseScroll', handleMOZWheel, { passive: false });

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
    const screenWidth = props.screenWidth??DEFAULT_SET.screenWidth;
    const screenHeight = props.screenHeight??DEFAULT_SET.screenHeight;
    const scaleHeight = props.scaleHeight??DEFAULT_SET.scaleHeight;
    const startMargin = props.startMargin??DEFAULT_SET.startMargin;
    defaultSetting = {
      ...DEFAULT_SET,
      scaleHeightZoom,
      startMarginZoom,
      screenWidth,
      screenHeight,
      scaleHeight,
      startMargin
    }

    if (Number.isNaN(inheritZoom) || inheritZoom === -1) {
      originInfo.dynamicTuning?.();

    } else {
      inheritZoom !== zoom && selectZoom(inheritZoom!);
    }
  }, [screenWidth, screenHeight, inheritZoom])

  useEffect(() => {
    originInfo.enableDrag = enableDrag;
  }, [enableDrag])

  // 动态更新组件布局信息
  useEffect(() => {
    originInfo.dragTarget = dragTarget;
    // console.log(props.dragTarget);
  }, [makeCustomized])

  // 根据开关切换辅助线的显隐
  useEffect(() => {
    originInfo.enableLineHelper = enableLineHelper;
    originInfo.domList = makeCustomized;
    if (!enableLineHelper) {
      originInfo.dragTarget = null;
      originInfo.originalDragTarget = null;
      props.onChasingLine?.({
        left: -1,
        top: -1
      });
    } else {
      originInfo.originalDragTarget = dragTarget;
    }

  }, [enableLineHelper])

  function updateSize() {
    if (wpRef.current == null) return;
    if (zoom >= 18 || zoom <= 200) {
      defaultSetting.scaleHeightZoom = defaultSetting.scaleHeight * window.devicePixelRatio;
      defaultSetting.startMarginZoom = defaultSetting.startMargin * window.devicePixelRatio;

    }

    const offsetXY = wpRef.current.getBoundingClientRect();
    originInfo.clientReact = offsetXY;
    originInfo.leftOffset = Math.ceil(offsetXY.left) + defaultSetting.scaleHeightZoom; // 起始位置离视口左边距
    originInfo.topOffset = Math.ceil(offsetXY.top) + defaultSetting.scaleHeightZoom; // 起始位置离视口上边距
    originInfo.ratio = defaultSetting.precision / defaultSetting.lineMargin; // 设备像素比

  }

  // 刻度线，页面位置调整
  function transformDoc() {
    pageRef.current!.style.transform =
      `scale(${1 / originInfo.unit}) translate(${originInfo.transformX * originInfo.unit}px,${originInfo.transformY * originInfo.unit}px)`;
    hWpRuler.current!.style.transform = `translateX(${originInfo.transformX}px`;
    vWpRuler.current!.style.transform = `rotate(90deg) translateX(${originInfo.transformY}px`;
  }

  // 进入刻度尺
  function handleMouseEnter(e: { clientX: number; clientY: number; }, type = 'h') {
    // console.log(defaultSetting);
    switch (type) {
      case 'h': {
        setHIndicator(true);
        Promise.resolve().then(() => {
          // const leftOffset = e.clientX - originInfo.transformX - originInfo.leftOffset;
          hRuler.current!.setAttribute('style', `left: ${e.clientX - originInfo.leftOffset}px; transform: translateY(${defaultSetting.scaleHeight}px)`);
          // hRulerValue.current!.innerHTML = Math.round((leftOffset - defaultSetting.startMarginZoom) * originInfo.unit)+'';
        });
        break;
      }

      case 'v': {
        setVIndicator(true);
        Promise.resolve().then(() => {
          vRuler.current!.setAttribute('style', `left: ${e.clientY - originInfo.topOffset}px; transform: translateY(-100%)`);

        });
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  // 离开刻度尺
  function handleMouseLeave(e: any, type = 'h') {
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
  function handleMouseMove(e: { clientX: number; clientY: number; }, type = 'h') {
    switch (type) {
      case 'h': {
        if (hIndicator) {
          const leftOffset = e.clientX - originInfo.transformX - originInfo.leftOffset;
          hRuler.current!.setAttribute('style', `left: ${leftOffset}px; transform: translateY(${defaultSetting.scaleHeightZoom}px)`);
          hRulerValue.current!.innerHTML = Math.round((leftOffset - defaultSetting.startMarginZoom) * originInfo.unit)+'';

        }
        break;

      }

      case 'v': {
        if (vIndicator) {
          const topOffset = e.clientY - originInfo.transformY - originInfo.topOffset;
          vRuler.current!.setAttribute('style', `left: ${topOffset}px; transform: translateY(-100%)`);
          vRulerValue.current!.innerHTML = Math.round((topOffset - defaultSetting.startMarginZoom) * originInfo.unit)+'';

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
  function handleRulerClick(e: { clientX: number; clientY: number; }, type = 'h') {
    // console.log('x', e.clientX);
    // console.log('y', e.clientY);
    // console.log(defaultSetting);
    switch (type) {
      case 'h': {
        const realPos = e.clientX - originInfo.transformX - originInfo.leftOffset - defaultSetting.startMarginZoom;
        const lines = hLines.filter(item => item != realPos);
        lines.push(realPos);
        originInfo.hLines[Math.round(realPos * originInfo.unit)] = 1;

        setHLines(lines);
        // setHIndicator(false);
        break;

      }

      case 'v': {
        const realPos = e.clientY - originInfo.transformY - originInfo.topOffset - defaultSetting.startMarginZoom;
        const lines = vLines.filter(item => item != realPos);
        lines.push(realPos);
        originInfo.vLines[Math.round(realPos * originInfo.unit)] = 1;

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
  function handleLineDBClick(val: number, type: string) {
    switch (type) {
      case 'h': {
        const lines = hLines.filter(item => item != val);
        delete originInfo.hLines[Math.round(val * originInfo.unit)];
        setHLines(lines);
        break;

      }

      case 'v': {
        const lines = vLines.filter(item => item != val);
        delete originInfo.vLines[Math.round(val * originInfo.unit)];
        setVLines(lines);
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  // 移动参考线
  function handleLineDragEnd(pre: number, suf: number, type: string) {
    switch (type) {
      case 'h': {
        const lines = hLines.filter(item => item != pre);
        delete originInfo.hLines[Math.round(pre * originInfo.unit)];
        originInfo.hLines[Math.round(suf * originInfo.unit)] = 1;
        lines.push(suf);
        setHLines(lines);
        break;

      }

      case 'v': {
        const lines = vLines.filter(item => item != pre);
        delete originInfo.vLines[Math.round(pre * originInfo.unit)];
        originInfo.vLines[Math.round(suf * originInfo.unit)] = 1;
        lines.push(suf);
        setVLines(lines);
        break;

      }

      default: {
        throw new Error('Illegal parameter');
      }
    }
  }

  function changeZoom(value: number) {
    const val = value < originInfo.minScale ? originInfo.minScale :
      value > originInfo.maxScale ? originInfo.maxScale : value;
    const [_zoom_, tolerance] = getChangeLine(val)

    const _zoom = 100 / _zoom_
    const _lineMargin = defaultSetting.lineMargin * (100 + tolerance) / 100;
    // console.log('_zoom', _zoom, '_lm', _lineMargin);

    let unit = defaultSetting.precision * _zoom / _lineMargin;
    // console.log('or', originInfo.unit);

    // page 页面缩放
    const pageScaleZoom = 1 / unit;

    // 缩略图缩放
    // const thumbnail_zoom_width = (wpRef.clientWidth - defaultSetting.startMarginZoom - defaultSetting.scaleHeightZoom)
    //   / (defaultSetting.screenWidth * pageScaleZoom);

    // const thumbnail_zoom_height = (wpRef.clientHeight - defaultSetting.startMarginZoom - defaultSetting.scaleHeightZoom)
    //   / (defaultSetting.screenHeight * pageScaleZoom);

    // const thumbnail_zoom_width = (wpRef.clientWidth - defaultSetting.startMarginZoom - defaultSetting.scaleHeightZoom)
    //   / (defaultSetting.screenWidth * val / 100);

    // const thumbnail_zoom_height = (wpRef.clientHeight - defaultSetting.startMarginZoom - defaultSetting.scaleHeightZoom)
    //   / (defaultSetting.screenHeight * val / 100);

    // console.log('thumbnail_zoom', thumbnail_zoom_width, thumbnail_zoom_height);

    // 便于在 mousewheel 回调中拿到最新值
    originInfo.zoom = val;

    let transform_ratio = originInfo.unit / unit;
    originInfo.zoomPageHeight = defaultSetting.screenHeight * pageScaleZoom;
    originInfo.zoomPageWidth = defaultSetting.screenWidth * pageScaleZoom;
    // console.log(originInfo.transformX);
    originInfo.transformX *= transform_ratio;
    originInfo.transformY *= transform_ratio;
    originInfo.unit = unit;
    // console.log(originInfo.transformX);

    transformDoc();

    setZoom(val);
    setInputZoom(val);
    // setThumbnailZoom([thumbnail_zoom_width > 1 ? 1 : thumbnail_zoom_width, thumbnail_zoom_height > 1 ? 1 : thumbnail_zoom_height]);

    props.onChangeZoom?.({
      zoom: value,
      unit: originInfo.unit
    });

  }

  function selectZoom(val: number) {
    if (wpRef.current == null) return;
    if (val !== -1) {
      changeZoom(val);
    } else { // 自适应调整
      // console.log('default', defaultSetting);
      let widthRatio = (wpRef.current.clientWidth - defaultSetting.startMarginZoom - defaultSetting.scaleHeightZoom) / defaultSetting.screenWidth;
      let heightRatio = (wpRef.current.clientHeight - defaultSetting.startMarginZoom - defaultSetting.scaleHeightZoom) / defaultSetting.screenHeight;
      // console.log('ratio', widthRatio, heightRatio);
      let side = widthRatio > heightRatio ? heightRatio : widthRatio;
      changeZoom(Math.round((side * 100 - 3)));
    }
  }

  // function handleThumbnailMove(val) {
  //   // console.log(originInfo.unit);
  //   pageRef.style.transform =
  //     `scale(${1 / originInfo.unit}) translate(-${(val.transformX) * 10}px,-${val.transformY * 10 * originInfo.unit}px)`;
  //   hWpRuler.style.transform = `translateX(-${val.transformX * 10 / originInfo.unit}px`;
  //   vWpRuler.style.transform = `rotate(90deg) translateX(-${val.transformY * 10}px`;
  // }

  // function handleThumbnailMoveEnd(val) {
  //   pageRef.style.transition = '.2s all linear';
  //   // pageRef.style.transformOrigin = `${val.transformX * 10}px ${val.transformY * 10}px`;
  //   originInfo.transformX = val.transformX * 10 / originInfo.unit;
  //   originInfo.transformY = val.transformY * 10;
  //   setHLines([...hLines]);
  //   setVLines([...vLines]);
  // }

  const hLineNodes = useMemo(() =>
    hLines.map(item => <Line key={item}
      type="h"
      setting={{
        startMargin: defaultSetting.startMarginZoom,
        leftOffset: originInfo.leftOffset,
        topOffset: originInfo.topOffset,
        transformX: originInfo.transformX,
      }}
      unit={originInfo.unit}
      left={item}
      disable={!showLine}
      top={defaultSetting.scaleHeightZoom}
      onDoubleClick={() => handleLineDBClick(item, 'h')}
      onDragEnd={(v: any) => handleLineDragEnd(item, v, 'h')}
    />)
    , [hLines, zoom, showLine, refreshTrigger]);

  const vLineNodes = useMemo(() =>
    vLines.map(item => <Line key={item}
      type="v"
      setting={{
        startMargin: defaultSetting.startMarginZoom,
        leftOffset: originInfo.leftOffset,
        topOffset: originInfo.topOffset,
        transformY: originInfo.transformY,
      }}
      unit={originInfo.unit}
      left={item}
      disable={!showLine}
      onDoubleClick={() => handleLineDBClick(item, 'v')}
      onDragEnd={(v: any) => handleLineDragEnd(item, v, 'v')}
    />)
    , [vLines, zoom, showLine, refreshTrigger]);

  const scaleLevel = (
    <ul className="scale-value-list" onClick={(e) => selectZoom(e.target['value'])}>
      <li value={200}>200%</li>
      <li value={150}>150%</li>
      <li value={100}>100%</li>
      <li value={50}>50%</li>
      <li value={-1}>自适应</li>
    </ul>
  );

  const sliderNode = useMemo(() => <div className="zoom-slider">
    <MinusOutlined className="zoom-icon zoom-out" onClick={() => changeZoom(zoom - 17)} />
    <Slider value={zoom} onChange={v => changeZoom(v as number)} max={originInfo.maxScale} min={originInfo.minScale} step={17} />
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
                height: defaultSetting.scaleHeightZoom,
                left: defaultSetting.scaleHeightZoom + 'px'
              }}
            >
              <Ruler
                setting={defaultSetting}
                zoom={zoom}
                pageZoom={1 / originInfo.unit}
                onMouseEnter={(e: any) => handleMouseEnter(e, 'h')}
                onMouseLeave={(e: any) => handleMouseLeave(e, 'h')}
                onMouseMove={(e: any) => handleMouseMove(e, 'h')}
                onClick={(e: any) => handleRulerClick(e, 'h')}
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
              style={{ height: defaultSetting.scaleHeightZoom }}>
              <Ruler
                setting={defaultSetting}
                zoom={zoom}
                pageZoom={1 / originInfo.unit}
                onMouseEnter={(e: any) => handleMouseEnter(e, 'v')}
                onMouseLeave={(e: any) => handleMouseLeave(e, 'v')}
                onMouseMove={(e: any) => handleMouseMove(e, 'v')}
                onClick={(e: any) => handleRulerClick(e, 'v')}
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
              width: defaultSetting.scaleHeightZoom,
              height: defaultSetting.scaleHeightZoom
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
              top: (defaultSetting.scaleHeightZoom + defaultSetting.startMarginZoom) + 'px',
              left: (defaultSetting.scaleHeightZoom + defaultSetting.startMarginZoom) + 'px',
              backgroundColor: screenBGColor,
              backgroundImage: screenBG ? `url(${screenBG})` : '',
            }}
          // onMoveStart={() => pageRef.style.transition = 'none'}
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
          // onMoveStart={() => pageRef.style.transition = 'none'}
          // onMove={handleThumbnailMove}
          // onMoveEnd={handleThumbnailMoveEnd}
          bgColor={screenBGColor}
        />

        <div className="edit-slider" id='edit-slider'>
          <div className="scale-level-input-wp">
            <input type="number"
              className="scale-input"
              max={originInfo.maxScale}
              min={originInfo.minScale}
              step={1}
              value={inputZoom}
              onChange={(e) => setInputZoom(parseFloat(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && changeZoom(e.target['value'])}
            />
            <Popover
              content={scaleLevel}
            >
              <span className="percent">%<CaretUpOutlined /></span>
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
