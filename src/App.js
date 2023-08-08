import './App.css';
import React, { createElement, useLayoutEffect, useState, useEffect } from "react";
import rough from 'roughjs/bundled/rough.esm';

const generator = rough.generator();


function createAnElement(id, x1, y1, x2, y2, tool){
  const center = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const radius = Math.sqrt(Math.pow(x1 - center.x, 2) + Math.pow(y1 - center.y, 2));
 const roughElement = tool === "line"
    ? generator.line(x1, y1, x2, y2)
    : tool === "rectangle"
      ? generator.rectangle(x1, y1, x2 - x1, y2 - y1)
      : tool === "circle"
        ? generator.circle(center.x, center.y, radius) : (() => { throw new Error("Invalid elementType. Supported types: 'line', 'rectangle', 'circle'") })();

return {id, x1, y1, x2, y2, tool, roughElement};
};

function nearPoint(x, y, x1, y1, name){
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
}

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
  } else {
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

const App = () => {

  const [elements, setElements, undo, redo] = useHistory([]);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("line");
  const [selectedElement, setSelectedElement] = useState(null);

useLayoutEffect(() => {
  const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
context.clearRect(0, 0, canvas.width, canvas.height);

const roughCanvas = rough.canvas(canvas);
elements.forEach(({roughElement}) => roughCanvas.draw(roughElement));
}, [elements]);


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

function updateElement(id, x1, y1, x2, y2, tool) {
  const updatedElement = createAnElement(id, x1, y1, x2, y2, tool);
  const elementsCopy = [...elements];
  elementsCopy[id] = updatedElement;
  setElements(elementsCopy, true);
}

const handleMouseDown = (event) => {
  const { clientX, clientY } = event;
  if (tool === "move") {
    const element = getElementAtPosition(clientX, clientY, elements);
    if (element) {
      const offsetX = clientX - element.x1;
      const offsetY = clientY - element.y1;
      setSelectedElement({ ...element, offsetX, offsetY });
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
    setAction("drawing");
  }
};

const handleMouseMove = (event) => {
  const {clientX, clientY} = event;

if(tool === "move"){
  const element = getElementAtPosition(clientX, clientY, elements);
  event.target.style.cursor = element ? cursosForPosition(element.position) : "default";
}

  if (action === "drawing"){
  const index = elements.length -1;
  const {x1, y1} = elements[index];
  updateElement(index, x1, y1, clientX, clientY, tool);

} else if(action === "moving"){
  const {id, x1, y1, x2, y2, tool, offsetX, offsetY} = selectedElement;
  const width = x2 - x1;
  const height = y2 - y1;
  const nexX1 = clientX - offsetX;
  const nexY1 = clientY - offsetY;

  updateElement(id, nexX1, nexY1, nexX1 + width, nexY1 + height, tool);
}
else if(action === "resizing"){
  const {id, tool, position, ...coordinates} = selectedElement;
  const {x1, y1, x2, y2} = resizedCoordinates(clientX, clientY, position, coordinates);
  updateElement(id, x1, y1, x2, y2, tool);
}
}


const handleMouseUp = () => {
  if(selectedElement){
  const index = selectedElement.id;
  const {id, tool} = elements[index];
  if(action === "drawing" || action === "resizing"){
    const {x1, y1, x2, y2} = adjustElementCoordinates(elements[index]);
    updateElement(id, x1, y1, x2, y2, tool);
  }
}
  setAction("none");
  setSelectedElement(null);
};

return (
<div>
  <div style = {{position: "fixed"}}>
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
<label htmlFor="pencil">Circle</label>
<input
type="radio"
id="pencil"
checked={tool === "pencil"}
onChange={() => setTool("pencil")}
/>
<label htmlFor="circle">Pencil</label>
  <input
type="radio"
id="move"
checked={tool === "move"}
onChange={() => setTool("move")}
/>
<label htmlFor="move">Move</label>
</div>
<div style={{ position: "fixed", zIndex: 2, bottom: 0, padding: 10 }}>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>
<canvas 
id="canvas" 
width={window.innerWidth} 
height={window.innerHeight}
onMouseDown={handleMouseDown}
onMouseMove={handleMouseMove}
onMouseUp={handleMouseUp}
>Canvas</canvas>
</div>
)};

export default App;
