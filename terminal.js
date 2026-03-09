const input = document.getElementById("commandInput");
const output = document.getElementById("output");

function print(text){

const div = document.createElement("div");

div.className="output-line";

div.innerHTML=text;

output.appendChild(div);

}

function runCommand(cmd){

const command = cmd.trim().toLowerCase();

if(commands[command]){

print(commands[command]());

}

else{

print("Command not found. Type 'help'");

}

}

input.addEventListener("keydown",function(e){

if(e.key==="Enter"){

const value=input.value;

print(`<span class="prompt">mihir@system:~$</span> ${value}`);

runCommand(value);

input.value="";

}

});
