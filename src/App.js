import './App.css';
import React, {useLayoutEffect, useState, useEffect, useRef } from "react";
import rough from 'roughjs/bundled/rough.esm';
import { getStroke } from 'perfect-freehand';

const generator = rough.generator();

//add new shapes/tools here
function createAnElement(id, x1, y1, x2, y2, tool){
  switch (tool){
    case "line":
    case "rectangle":
    case "circle":
       const center = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const radius = Math.sqrt(Math.pow(x1 - center.x, 2) + Math.pow(y1 - center.y, 2));
       const roughElement = tool === "line"
    ? generator.line(x1, y1, x2, y2)
    : tool === "rectangle"
      ? generator.rectangle(x1, y1, x2 - x1, y2 - y1)
      : tool === "circle"
        ? generator.circle(center.x, center.y, radius) : (() => { throw new Error("Invalid elementType. Supported types: 'line', 'rectangle', 'circle'") })();

return {id, x1, y1, x2, y2, tool, roughElement};
case "pencil":
  return {id, tool, points: [{x: x1, y: y1}]};
case "text":
  return {id, tool, x1, y1, x2, y2, text: ""};
  default:
    throw  new Error("Invalid elementType");
}
};

function nearPoint(x, y, x1, y1, name){
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
}
//checking if mouse cursor is on the line of painted element
const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null;
};
//checking if mouse cursor is inside an element
function isWithinElement(x, y, element) {
  const { tool, x1, x2, y1, y2 } = element;
  if (tool === "rectangle") {
    const topLeft = nearPoint(x, y, x1, y1, "tl")
    const topRight = nearPoint(x, y, x2, y1, "tr")
    const btmLeft = nearPoint(x, y, x1, y2, "bl")
    const btmRight = nearPoint(x, y, x2, y2, "br")
    const inside =  x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
    return topLeft || topRight || btmLeft || btmRight || inside;
  } else if (tool === "line") {
    // Calculate the distance from the point (x, y) to the line defined by (x1, y1) and (x2, y2)
    const distanceToPoint = Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / distance({ x: x1, y: y1 }, { x: x2, y: y2 });
    const start = nearPoint(x, y, x1, y1, "start")
    const end = nearPoint(x, y, x2, y2, "end")
    const inside = distanceToPoint < 1 ? "inside" : null;
    return start || end || inside;
  } else if (tool === "circle") {
    // Check if the distance from the center of the circle to the point (x, y) is less than the circle's radius
    const center = {x: (x1 + x2) / 2, y: (y1 + y2) / 2 }; // Atwia: 5138008
    const distanceToPoint = distance(center, { x, y });
    const radius = distance({ x: x1, y: y1 }, center); // Use the distance from the center to one of the circle's points as the radius
    return distanceToPoint < radius - (radius/2) ? "inside" : null;
  } else if (tool === "pencil") {
  const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) return false;
        return onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null;
      });
      return betweenAnyPoint ? "inside" : null;
  } 
  else if(tool === "text"){
    return x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
  }
  else {
    throw new Error("Invalid elementType. Supported types: 'line', 'rectangle', 'circle'");
  }
}

const distance = (a, b) => Math.sqrt(Math.pow(a.x-b.x, 2) + Math.pow(a.y - b.y, 2));

function getElementAtPosition(x, y, elements){
return elements.map(element => ({...element, position: isWithinElement(x, y, element)})).find(element => element.position !== null)
}

function adjustElementCoordinates(element){
const {tool, x1, y1, x2, y2} = element;
if(tool === "rectangle"){
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return {x1: minX, y1: minY, x2: maxX, y2: maxY}
}
else{
  if(x1 < x2 || (x1 === x2 && y1 < y2)){
    return {x1, y1, x2, y2}
  }else{
    return {x1: x2, y1: y2, x2: x1, y2: y1}
  }
}
}

function cursosForPosition(position){
switch(position){
  case "tl":
  case "br":
  case "start":
  case "end":
    return "nwse-resize";
  case "tr":
  case "bl":
    return "nesw-resize";
  default:
    return "move";
}
}

//resizing
function resizedCoordinates(clientX, clientY, position, coordinates){
const {x1, y1, x2, y2} = coordinates
switch(position){
  case "tl":
  case "start":
    return {x1: clientX, y1: clientY, x2, y2};
  case "tr":
    return {x1, y1: clientY, x2: clientX, y2};
  case "bl":
    return {x1: clientX, y1, x2, y2: clientY};
  case "br":
  case "end":
    return {x1, y1, x2: clientX, y2: clientY};
    default:
      return null;
}
}

//history of actions for redo/undo
const useHistory = initialState => {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([initialState]); 

  const setState = (action, overwrite = false) =>{
const newState = typeof action === "function" ? action(history[index]) : action;
if(overwrite){
const historyCopy = [...history];
historyCopy[index] = newState;
setHistory(historyCopy);
}else{
  const updatedState = [...history].slice(0, index + 1);
setHistory(prevState => [...updatedState, newState]);
setIndex(prevState => prevState + 1);
}}

const undo = () => index > 0 && setIndex(prevState => prevState - 1)
const redo = () => index < history.length -1 && setIndex(prevState => prevState + 1)

  return [history[index], setState, undo, redo];
}

//getting svg path from pencil drawn element
const getSvgPathFromStroke = stroke => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};
//drawing chosen element
function drawElement(roughCanvas, context, element){
  switch (element.tool){
    case "line":
    case "rectangle":
    case "circle":
      roughCanvas.draw(element.roughElement)
      break;
    case "pencil":
      const stroke = getSvgPathFromStroke(getStroke(element.points));
      context.fill(new Path2D(stroke));
      break;
      case "text":
        context.textBaseline = 'top';
        context.font = '24px sans-serif';
        context.fillText(element.text, element.x1, element.y1);
        break;
    default: throw new Error("Invalid elementType1");
  }
}

const adjustmentRequired = tool => ["line", "rectangle", "circle"].includes(tool);

const usePressedKeys = () => {
  const [pressedKeys, setPressedKeys] = useState(new Set());

  useEffect(() => {
    const handleKeyDown = event => {
      setPressedKeys(prevKeys => new Set(prevKeys).add(event.key));
    };

    const handleKeyUp = event => {
      setPressedKeys(prevKeys => {
        const updatedKeys = new Set(prevKeys);
        updatedKeys.delete(event.key);
        return updatedKeys;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return pressedKeys;
};

const App = () => {

  const [elements, setElements, undo, redo] = useHistory([]);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("line");
  const [selectedElement, setSelectedElement] = useState(null);
  const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
  const [startPanMousePosition, setStartPanMousePosition] = React.useState({ x: 0, y: 0 });
  const [scale, setScale] = React.useState(1);
  const [scaleOffset, setScaleOffset] = React.useState({ x: 0, y: 0 });
  const pressedKeys = usePressedKeys();
  const textAreaRef = useRef(null);
  const [image, setImage] = useState(null);

useLayoutEffect(() => {
  const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
context.clearRect(0, 0, canvas.width, canvas.height);

const scaleWidth = canvas.width * scale;
const scaleHeight = canvas.height * scale;
const scaleOffsetX = (scaleWidth - canvas.width) /2;
const scaleOffsetY = (scaleHeight - canvas.height) /2;
setScaleOffset({x: scaleOffsetX, y: scaleOffsetY})
context.save();
context.translate(panOffset.x * scale - scaleOffsetX, panOffset.y * scale - scaleOffsetY);
context.scale(scale, scale);
const roughCanvas = rough.canvas(canvas);
if (image) {
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
}
elements.forEach(element => {
  if (action === "writing" && selectedElement.id === element.id) return;
  drawElement(roughCanvas, context, element);
});
context.restore();
}, [elements, action, selectedElement, panOffset, scale, image])
  

useEffect(() => {
  const undoRedoFunction = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "x") {
      redo();
    } else if ((event.metaKey || event.ctrlKey) && event.key === "z") {
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  };
  document.addEventListener("keydown", undoRedoFunction);
  return () => {
    document.removeEventListener("keydown", undoRedoFunction);
  };
}, [undo, redo]);

useEffect(() => {
  const panOrZoomFunction = event => {
    if (pressedKeys.has("Meta") || pressedKeys.has("Control")) onZoom(event.deltaY * -0.01);
    else setPanOffset(prev => ({ x: prev.x - event.deltaX, y: prev.y - event.deltaY }));
  };

  document.addEventListener("wheel", panOrZoomFunction);
  return () => {
    document.removeEventListener("wheel", panOrZoomFunction);
  };
}, [pressedKeys]);

useEffect(() => {
  const textArea = textAreaRef.current;
  if(action === "writing"){
    setTimeout(function(){textArea.focus();}, 50);
    textArea.value = selectedElement.text;
  }
}, [action, selectedElement])

function updateElement(id, x1, y1, x2, y2, tool, options) {
   const elementsCopy = [...elements];
   switch (tool){
    case "line":
    case "rectangle":
    case "circle":
  elementsCopy[id] = createAnElement(id, x1, y1, x2, y2, tool);
      break;
    case "pencil":
       elementsCopy[id].points = [...elementsCopy[id].points, {x: x2, y: y2}]
      break;
      case "text":
        const textWidth = document
          .getElementById("canvas")
          .getContext("2d")
          .measureText(options.text).width;
        const textHeight = 24;
        elementsCopy[id] = {
          ...createAnElement(id, x1, y1, x1 + textWidth, y1 + textHeight, tool),
          text: options.text,
        };
        break;
    default: throw new Error("Invalid elementType1");
  }
   setElements(elementsCopy, true);
}

function getMouseCoordinates(event){
  const clientX = (event.clientX - panOffset.x * scale + scaleOffset.x) / scale;
  const clientY = (event.clientY - panOffset.y * scale + scaleOffset.y) / scale;
  return { clientX, clientY };
}

const handleMouseDown = (event) => {
  if (action === "writing") return;
  const { clientX, clientY } = getMouseCoordinates(event);

  if (event.button === 1 || pressedKeys.has(" ")) {
    setAction("panning");
    setStartPanMousePosition({ x: clientX, y: clientY });
    return;
  }

  if (tool === "move") {
    const element = getElementAtPosition(clientX, clientY, elements);
    if (element) {
      if(element.tool === "pencil"){
const xOffset = element.points.map(point => clientX - point.x);
const yOffset = element.points.map(point => clientY - point.y);
setSelectedElement({...element, xOffset, yOffset});
      }else{
      const offsetX = clientX - element.x1;
      const offsetY = clientY - element.y1;
      setSelectedElement({ ...element, offsetX, offsetY });
      }
      setElements(prevState => prevState);

      if(element.position === "inside"){
        setAction("moving");
      }else{
        setAction("resizing");
      }
      
    } 
  } else {
    const id = elements.length;
    const element = createAnElement(id, clientX, clientY, clientX, clientY, tool);
    setElements((prevState) => [...prevState, element]);
    setSelectedElement(element);
    setAction(tool === "text" ? "writing" : "drawing");
  }
};

const handleMouseMove = (event) => {
  const {clientX, clientY} = getMouseCoordinates(event);

  if (action === "panning") {
    const deltaX = clientX - startPanMousePosition.x;
    const deltaY = clientY - startPanMousePosition.y;
    setPanOffset({
      x: panOffset.x + deltaX,
      y: panOffset.y + deltaY,
    });
    return;
  }

if(tool === "move"){
  const element = getElementAtPosition(clientX, clientY, elements);
  event.target.style.cursor = element ? cursosForPosition(element.position) : "default";
}

  if (action === "drawing"){
  const index = elements.length -1;
  const {x1, y1} = elements[index];
  updateElement(index, x1, y1, clientX, clientY, tool);

} else if(action === "moving"){
  if(selectedElement.tool === "pencil"){
const newPoints = selectedElement.points.map((_ , index) =>({
  x: clientX - selectedElement.xOffset[index],
  y: clientY - selectedElement.yOffset[index]
}))
const elementsCopy = [...elements];
elementsCopy[selectedElement.id] = {
...elementsCopy[selectedElement.id],
points: newPoints
}
setElements(elementsCopy, true);
  }else{
const {id, x1, y1, x2, y2, tool, offsetX, offsetY} = selectedElement;
  const width = x2 - x1;
  const height = y2 - y1;
  const nexX1 = clientX - offsetX;
  const nexY1 = clientY - offsetY;
  const options = tool === "text" ? {text: selectedElement.text} : {};
   updateElement(id, nexX1, nexY1, nexX1 + width, nexY1 + height, tool, options);
  }
}
else if(action === "resizing"){
  const {id, tool, position, ...coordinates} = selectedElement;
  const {x1, y1, x2, y2} = resizedCoordinates(clientX, clientY, position, coordinates);
  updateElement(id, x1, y1, x2, y2, tool);
}
}


const handleMouseUp = event => {
 const {clientX, clientY} = getMouseCoordinates(event);
  if(selectedElement){
    if(selectedElement.tool === "text" && clientX - selectedElement.offsetX === selectedElement.x1 && clientY - selectedElement.offsetY === selectedElement.y1){
setAction("writing");
return;
    }
  const index = selectedElement.id;
  const {id, tool} = elements[index];
  if((action === "drawing" || action === "resizing") && adjustmentRequired(tool)){
    const {x1, y1, x2, y2} = adjustElementCoordinates(elements[index]);
    updateElement(id, x1, y1, x2, y2, tool);
  }
}
if(action === "writing") return;
  setAction("none");
  setSelectedElement(null);
};

const handleBlur = event => {
  const {id, x1, y1, tool} = selectedElement;
  setAction("none");
  setSelectedElement(null);
  updateElement(id, x1, y1, null, null, tool, {text: event.target.value})
}

const onZoom = increment => {
  setScale(prevState => Math.min(Math.max(prevState + increment, 0.1), 20));
};

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      setImage(img);
    };
  };
  reader.readAsDataURL(file);
};

return (
<div>
  <div style = {{position: "fixed", zIndex: 2, backgroundColor: "white", padding: 10, width: "100%"}}>
<input
type="radio"
id="line"
checked={tool === "line"}
onChange={() => setTool("line")}
/>
<label htmlFor="line">Line</label>
<input
type="radio"
id="rectangle"
checked={tool === "rectangle"}
onChange={() => setTool("rectangle")}
/>
<label htmlFor="rectangle">Rectangle</label>
<input
type="radio"
id="circle"
checked={tool === "circle"}
onChange={() => setTool("circle")}
/>
<label htmlFor="circle">Circle</label>
<input
type="radio"
id="pencil"
checked={tool === "pencil"}
onChange={() => setTool("pencil")}
/>
<label htmlFor="pencil">Pencil</label>
<input
type="radio"
id="text"
checked={tool === "text"}
onChange={() => setTool("text")}
/>
<label htmlFor="text">Text</label>
  <input
type="radio"
id="move"
checked={tool === "move"}
onChange={() => setTool("move")}
/>
<label htmlFor="move">Move</label>

<label htmlFor="image"><br />Choose a profile picture:</label>
<input name='image' type="file" accept="image/*" onChange={handleImageUpload}/>
</div>

<div style={{ position: "fixed", zIndex: 2, bottom: 0, padding: 10, backgroundColor: "white", width: "100%"}}>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <span>   </span>
        <button onClick={() => onZoom(-0.1)}>-</button>
        <span onClick={() => setScale(1)}>
        {" "}{new Intl.NumberFormat("en-GB", { style: "percent" }).format(scale)}{" "}
        </span>
        <button onClick={() => onZoom(0.1)}>+</button>
      </div>
      {action === "writing" ? <textarea ref={textAreaRef} onBlur={handleBlur}
          style={{
            position: "fixed",
            top: (selectedElement.y1 - 2) * scale + panOffset.y * scale - scaleOffset.y,
            left: selectedElement.x1 * scale + panOffset.x * scale - scaleOffset.x,
            font: `${24 * scale}px sans-serif`,
            margin: 0,
            padding: 0,
            border: 0,
            outline: 0,
            resize: "auto",
            overflow: "hidden",
            whiteSpace: "pre",
            background: "transparent",
            zIndex: 2,
          }}/> : null}
<canvas 
id="canvas" 
width={window.innerWidth} 
height={window.innerHeight}
onMouseDown={handleMouseDown}
onMouseMove={handleMouseMove}
onMouseUp={handleMouseUp}
style={{ position: "absolute", zIndex: 1}}
>Canvas</canvas>
</div>
)};

export default App;
