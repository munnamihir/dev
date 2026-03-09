const canvas = document.createElement("canvas");
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const letters = "01MIHIROSSECURITYSYSTEM".split("");

const fontSize = 14;
const columns = canvas.width / fontSize;

const drops = [];

for(let i = 0; i < columns; i++){
drops[i] = 1;
}

function draw(){

ctx.fillStyle = "rgba(0,0,0,0.05)";
ctx.fillRect(0,0,canvas.width,canvas.height);

ctx.fillStyle = "#00ff9c";
ctx.font = fontSize + "px monospace";

for(let i = 0; i < drops.length; i++){

const text = letters[Math.floor(Math.random()*letters.length)];

ctx.fillText(text,i*fontSize,drops[i]*fontSize);

if(drops[i]*fontSize > canvas.height && Math.random()>0.975)
drops[i]=0;

drops[i]++;
}

}

setInterval(draw,33);
