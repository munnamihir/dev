const commands = {

help: () => `
Available commands

about
experience
projects
skills
quantummail
resume
github
contact
clear
`,

about: () => `
Hi I'm Mihir Bommisetty

Senior Full Stack Developer

Specializing in:

.NET
Golang
Angular
Cloud Architecture
Secure Systems

Currently building QuantumMail
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
Node

Infrastructure
Azure
AWS
Podman
CI/CD
`,

projects: () => `
Projects

1 QuantumMail
2 Tesla Trip Efficiency Optimizer
3 Tesla Vision Simulator
`,

quantummail: () => `
QuantumMail Architecture

Device registers public key
Message encrypted using AES-GCM
AES key wrapped with RSA
Encrypted payload stored server side
Recipient device decrypts message

Security

End-to-end encryption
Device-bound access
Envelope encryption
`,

resume: () => `
Download Resume

assets/Mihir_Bommisetty_Resume.pdf
`,

github: () => `
GitHub

https://github.com/munnamihir
`,

contact: () => `
Email
mihirbommisettys@gmail.com

Phone
+1 551-349-4114
`,

clear: () => {
  output.innerHTML = ""
  return ""
}

}
