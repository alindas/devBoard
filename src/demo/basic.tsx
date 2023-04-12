import React, { useState } from 'react'
import EditorPanel from "../editorPanel";
import './demo.css'

const CPListData = [
  {
    width: 50,
    height: 100,
    backgroundColor: '#85407d',
  },
  {
    width: 150,
    height: 50,
    backgroundColor: '#738540',
  },
  {
    width: 200,
    height: 200,
    backgroundColor: '#40854c',
  },
]

function CPList(props) {

  const onChoose = (t) => {
    props.onSelect(t);
    let layer = document.createElement('div');
    layer.setAttribute('style', `position: absolute; z-index: 999;width: ${t.width}px;height: ${t.height}px;background-color: ${t.backgroundColor}`)
    document.body.appendChild(layer);

    document.onmousemove = e => {
      layer.style.left = e.clientX + 'px';
      layer.style.top = e.clientY + 'px';
    }

    document.onmouseup = () => {
      document.onmousemove = null;
      document.onmouseup = null;
      document.body.removeChild(layer);
      props.onPutDown();
    }
  }

  return (
    <div className='cp-list'>
      <ul>
        {CPListData.map((o,i) => (
          <li
            key={i}
            onMouseDown={() => onChoose(o)}
            style={{backgroundColor: o.backgroundColor}}
          >{o.width + '*' + o.height}</li>
        ))}
      </ul>
    </div>
  )
}

function Composer(props) {
  console.log('composer', props);
  return (
    <div className='composer-wp'>
      {
        props.domList.map((o, i) => (
          <div key={i} style={{...o}}/>
        ))
      }
    </div>
  )
}

let currentDom
let domList = []

export default function Basic() {
  const [drag, setDrag] = useState(false);

  const onSelect = (t) => {
    console.log('select', t);
    currentDom = { ...t };
    setDrag(true);
  }

  const onDragEnd = (pos) => {
    console.log('onDragEnd', pos);
    domList = [...domList, {
      ...currentDom,
      left: pos.left,
      top: pos.top
    }]

  }

  return (
    <div className='demo-wp'>
      <CPList onSelect={onSelect} onPutDown={() => setDrag(false)}></CPList>
      <EditorPanel
        enableLineHelper={drag}
        makeCustomized={domList}
        onDragEnd={onDragEnd}
      >
        <Composer domList={domList}/>
      </EditorPanel>
    </div>
  )
}
