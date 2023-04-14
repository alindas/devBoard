import React, { useEffect, useState, useRef } from 'react'
import { ILine } from './interface';

export default function Line(props: ILine) {
  // console.log(props);
  const {
    startMargin,
    leftOffset,
    topOffset,
    transformX = 0,
    transformY = 0
  } = props.setting;

  const [pos, setPos] = useState(-100);

  const originInfo = useRef({
    unit: props.unit
  });
  useEffect(() => {
    // console.log(originInfo.current);
    setPos((props.left * originInfo.current.unit / props.unit) + startMargin);
  }, [props.unit])

  function onMouseDown() {
    window.onmousemove = function(e: MouseEvent) {
      setPos(props.type == 'h' ? e.clientX - transformX - leftOffset : e.clientY - transformY - topOffset);

    }

    window.onmouseup = function(e: MouseEvent) {
      props.onDragEnd(props.type == 'h' ? e.clientX - transformX - leftOffset - startMargin
        : e.clientY - transformY - topOffset - startMargin);
      window.onmousemove = null;
      window.onmouseup = null;
    }
  }

  return (
    <div className={`ruler-line ${props.disable && 'line-disable'}`}
      title="双击删除参考线"
      style={{left: pos + 'px', top: props.type == 'h' ? props.top + 'px' : ''}}
      onDoubleClick={props.onDoubleClick}
      onMouseDown={onMouseDown}
    >
      <div className="line-action" onMouseDown={e => e.stopPropagation()}>
        <span className="line-value">{Math.round((pos - startMargin) * props.unit)}</span>
      </div>
    </div>
  )
}
