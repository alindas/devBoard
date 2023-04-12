import React, { useState } from 'react'
import makeClass from '../_util/makeClass'
import './index.css'

export default function Popover(props) {
  const [show, setShow] = useState(false);

  function showContent(e) {
    setShow(!show);
    e.preventDefault();
    e.stopPropagation();
    if (!show) {
      window.onclick = () => {
        setShow(false);
        window.onclick = null;
      }
    } else {
      window.onclick = null;
    }
  }

  return (
    <div className='popover' onClick={showContent}>
      <div className={makeClass('popover-inner' , show ? '' : 'popover-inner-hidden')}>{props.content}</div>
      <div className='popover-content'>{props.children}</div>
    </div>
  )
}
