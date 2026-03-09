import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
1000
);

const renderer = new THREE.WebGLRenderer({alpha:true});

renderer.setSize(window.innerWidth,window.innerHeight);

document.body.appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(3,32,32);

const material = new THREE.MeshBasicMaterial({
wireframe:true,
color:0x00ff9c
});

const globe = new THREE.Mesh(geometry,material);

scene.add(globe);

camera.position.z = 8;

function animate(){

requestAnimationFrame(animate);

globe.rotation.y += 0.002;

renderer.render(scene,camera);

}

animate();
