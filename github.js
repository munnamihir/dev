async function loadGithub(){

const res = await fetch(
"https://api.github.com/users/munnamihir/repos"
);

const data = await res.json();

let list="GitHub Repositories\n\n";

data.slice(0,5).forEach(repo=>{

list+=repo.name+"\n";

});

return list;

}
