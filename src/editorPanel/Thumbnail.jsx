import React, { useEffect, useRef } from 'react'

let init_translateX = 0,
  init_translateY = 0,
  transformX = 0,
  transformY = 0;

export default function Thumbnail(props) {
  // console.log(props);

  const {
    width,
    height,
    visibility,
    domList,
    onMoveStart,
    onMove,
    onMoveEnd,
    bgColor
  } = props;

  const zoom = props.zoom < 10 ? 10 : props.zoom;

  const w = width ? width / zoom : 192;
  const h = height ? height / zoom : 108;

  const canvasRef = useRef(null);
  const selBoxRef = useRef(null);
  useEffect(() => {

    if (Array.isArray(domList) && visibility) {
      drawSnapshot(canvasRef.current, domList)

    }
  }, [domList, bgColor, visibility, width, height])

  // function onMouseDown(e) {
  //   let { clientX: startX, clientY: startY } = e;
  //   let zoom_width = width * zoom[0];
  //   let zoom_height = height * zoom[1];
  //   let max_x = width - zoom_width - init_translateX;
  //   let max_y = height - zoom_height - init_translateY;

  //   onMoveStart && onMoveStart();

  //   function onMouseMove(e) {
  //     // const xZoom = (e.clientX - startX) / zoom_width
  //     // const yZoom = (e.clientY - startY) / zoom_height
  //     // 判断边界情况
  //     let eX = e.clientX - startX;
  //     let eY = e.clientY - startY;
  //     transformX = eX > max_x ? max_x + init_translateX : eX > -init_translateX ? init_translateX + eX : 0;
  //     transformY = eY > max_y ? max_y + init_translateY : eY > -init_translateY ? init_translateY + eY : 0;
  //     selBoxRef.current.style.transform = `translate(${transformX}px,${transformY}px)`;

  //     // console.log(xZoom, yZoom);

  //     onMove && onMove({
  //       // transformX: transformX / zoom[0],
  //       // transformY: transformY / zoom[1],
  //       transformX,
  //       transformY,
  //     });

  //   }

  //   function onMouseUp() {
  //     // console.log('mouseup');
  //     init_translateX = transformX;
  //     init_translateY = transformY;
  //     document.removeEventListener('mousemove', onMouseMove);
  //     document.removeEventListener('mouseup', onMouseUp);
  //     onMoveEnd && onMoveEnd({
  //       // transformX: transformX / zoom[0],
  //       // transformY: transformY / zoom[1],
  //       transformX,
  //       transformY,
  //     });
  //   }

  //   document.addEventListener('mousemove', onMouseMove);

  //   document.addEventListener('mouseup', onMouseUp);

  // }

  function drawSnapshot(canvas, rectList) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#848585';
    rectList.forEach(rect => {
      ctx.fillRect(rect.left / zoom, rect.top / zoom, rect.width / zoom, rect.height / zoom);
    });
  }

  return (
    <div
      className={visibility ? "thumbnail thumbnail-show" : "thumbnail thumbnail-hide"}
      style={{
        width: w,
        height: h
      }}
    >

      <div className="select-box"
        ref={selBoxRef}
        style={{
          width: w,
          height: h
        }}
        // onMouseDown={onMouseDown}
      >
      </div>
      <canvas ref={canvasRef} width={w} height={h}></canvas>
    </div>
  )
}
