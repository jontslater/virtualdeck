// public/script.js
const buttonsDiv = document.getElementById("buttons");
const visualContainer = document.getElementById("visual-container");

fetch("../config.json")
  .then(res => res.json())
  .then(data => {
    data.buttons.forEach(button => {
      const btn = document.createElement("button");
      btn.innerText = button.label;
      btn.onclick = () => handleTrigger(button);
      buttonsDiv.appendChild(btn);
    });
  });

function handleTrigger(button) {
  if (button.type === "audio") {
    const audio = new Audio(button.src);
    audio.play();
  } else if (button.type === "visual") {
    showVisual(button.src);
  }
}

function showVisual(src) {
  visualContainer.innerHTML = ""; // Clear previous
  const img = document.createElement("img");
  img.src = src;
  visualContainer.appendChild(img);

  setTimeout(() => {
    visualContainer.innerHTML = "";
  }, 4000);
} 
