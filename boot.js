const bootLines = [
"████████████████████████████",
"MIHIR CONSOLE",
"",
"Initializing system...",
"Loading developer modules...",
"Loading distributed microservices...",
"Initializing encryption layer...",
"Loading QuantumMail engine...",
"",
"ACCESS GRANTED",
"",
"Press ENTER to continue"
];

const bootText = document.getElementById("bootText");

const audio = new Audio(
"https://assets.mixkit.co/sfx/preview/mixkit-interface-system-boot-2577.mp3"
);

audio.play();

let index = 0;

function showBootLine(){

if(index < bootLines.length){

bootText.innerHTML += bootLines[index] + "\n";

index++;

setTimeout(showBootLine,600);

}

}

showBootLine();

document.addEventListener("keydown",function(e){

if(e.key === "Enter"){

document.getElementById("bootScreen").style.display="none";

document.getElementById("terminalContainer").classList.remove("hidden");

}

});
