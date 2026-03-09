const commands = {

help: () => `
Available Commands

about
experience
skills
projects
quantummail
system
github
contact
clear
`,

about: () => `
Mihir Bommisetty
Senior Full Stack Developer

Specializing in:

.NET
Golang
Angular
Secure System Design
`,

experience: () => `
Application Developer III
Pennsylvania Fish & Boat Commission

Software Developer – PACSES

Software Engineer – Aptean
`,

skills: () => `
Languages
C#
Golang
JavaScript
Python

Frameworks
.NET
Angular

Cloud
Azure
AWS
`,

projects: () => `
Projects

1 QuantumMail
2 Tesla Trip Efficiency Optimizer
3 Tesla Vision Simulator
`,

quantummail: () => `
QuantumMail Architecture

Sender Device
   ↓
AES Encryption
   ↓
RSA Wrapped Key
   ↓
Encrypted Storage
   ↓
Device Authentication
   ↓
Client Decryption
`,

encrypt: () => `
Simulating Encryption Flow

Sender Device
    ↓
AES Encryption
    ↓
RSA Key Wrapping
    ↓
Secure Storage
    ↓
Device Verification
    ↓
Client Decryption
`,
   
system: () => `
Developer Experience     ███████████ 7+ Years
Backend Engineering      ███████████ Expert
Architecture             ██████████ Advanced
Security                 ██████████ Strong
`,

github: () => `
github.com/munnamihir
`,

contact: () => `
Email
mihirbommisettys@gmail.com
`,

github: async () => {
return await loadGithub();
},
   
clear: () => {
output.innerHTML="";
return "";
}

};
