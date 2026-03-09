let history = [];
let historyIndex = 0;

input.addEventListener("keydown",function(e){

if(e.key==="Enter"){

const value=input.value;

history.push(value);
historyIndex=history.length;

print(`<span class="prompt">mihir@system:~$</span> ${value}`);

runCommand(value);

input.value="";
}

if(e.key==="ArrowUp"){

historyIndex--;

if(historyIndex>=0)
input.value=history[historyIndex];
}

if(e.key==="ArrowDown"){

historyIndex++;

if(historyIndex<history.length)
input.value=history[historyIndex];
}

  if(e.key==="Tab"){

  e.preventDefault();
  
  const value=input.value.toLowerCase();
  
  const match = Object.keys(commands)
  .find(cmd=>cmd.startsWith(value));
  
  if(match)
  input.value = match;
  
  }
});
