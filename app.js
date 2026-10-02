const $ = (id) => document.getElementById(id);
const audio = $("audio"), svg = $("ridgeSvg"), emptyState = $("emptyState");
let audioContext, analyser, source, dataArray, audioUrl, decodedBuffer, isPlaying = false, animation;
let settings = { density:42, amplitude:.68, overlap:1.6, weight:1.2 };

function makeMockRidges() {
  const rows = settings.density, width = 1200, height = 680, rowGap = height / (rows + 3);
  let output = "";
  for (let r=0; r<rows; r++) {
    const y = height - 18 - r * rowGap * (settings.overlap / 2.5), seed = r * .71;
    let d = `M 0 ${y}`;
    for (let x=0; x<=width; x+=10) {
      const wave = Math.sin(x*.015 + seed) * 10 + Math.sin(x*.039 + seed*1.7) * 5 + Math.sin(x*.006 - seed) * 9;
      d += ` L ${x} ${y - (wave + 25 + Math.sin(x*.002+r)*7) * settings.amplitude}`;
    }
    output += `<path d="${d}" fill="none" stroke="rgba(247,246,240,${Math.max(.13, .72-r/rows*.62)})" stroke-width="${settings.weight}" />`;
  }
  svg.innerHTML = output;
}

function drawFromAudio() {
  if (!analyser || !isPlaying) return;
  analyser.getByteFrequencyData(dataArray);
  const rows = settings.density, width = 1200, height = 680, rowGap = height / (rows + 3);
  let output = "";
  for (let r=0; r<rows; r++) {
    const y = height - 18 - r * rowGap * (settings.overlap / 2.5), offset = Math.floor(r * dataArray.length / rows * .45);
    let d = `M 0 ${y}`;
    for (let x=0; x<=width; x+=10) {
      const index = Math.min(dataArray.length-1, offset + Math.floor(x/width * dataArray.length * .55));
      const sample = dataArray[index] / 255;
      const wave = sample * 46 + Math.sin(x*.015+r*.71)*4 + Math.sin(x*.036+r)*2;
      d += ` L ${x} ${y - (wave + 7) * settings.amplitude}`;
    }
    output += `<path d="${d}" fill="none" stroke="rgba(247,246,240,${Math.max(.13,.75-r/rows*.63)})" stroke-width="${settings.weight}" />`;
  }
  svg.innerHTML = output;
  animation = requestAnimationFrame(drawFromAudio);
}

function setStatus(text) { $("statusText").textContent = text; }
function formatTime(value) { if (!Number.isFinite(value)) return "00:00"; return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(Math.floor(value%60)).padStart(2,"0")}`; }

async function loadAudio(file) {
  if (!file) return;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(file); audio.src = audioUrl; audio.load();
  $("trackName").textContent = file.name.toUpperCase().slice(0, 34);
  setStatus("decoding waveform"); emptyState.style.display = "none"; $("playButton").disabled = false;
  try {
    audioContext ||= new AudioContext();
    const buffer = await file.arrayBuffer();
    decodedBuffer = await audioContext.decodeAudioData(buffer);
    analyser ||= audioContext.createAnalyser(); analyser.fftSize = 512; dataArray = new Uint8Array(analyser.frequencyBinCount);
    if (!source) {
      source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    }
    makeMockRidges(); setStatus("ready to listen");
  } catch (error) { setStatus("could not decode file"); console.error(error); }
}

$("audioInput").addEventListener("change", (e) => loadAudio(e.target.files[0]));
["density","amplitude","overlap","brightness"].forEach(id => $(id).addEventListener("input", e => {
  const val = Number(e.target.value);
  if (id==="density") { settings.density=val; $("densityValue").textContent=val; }
  if (id==="amplitude") { settings.amplitude=val/100; $("amplitudeValue").textContent=`${val}%`; }
  if (id==="overlap") { settings.overlap=val/10; $("overlapValue").textContent=settings.overlap.toFixed(1); }
  if (id==="brightness") { settings.weight=val/10; $("brightnessValue").textContent=settings.weight.toFixed(1); }
  makeMockRidges();
}));
$("playButton").addEventListener("click", async () => {
  if (!audio.src) return;
  if (audioContext?.state === "suspended") await audioContext.resume();
  if (isPlaying) { audio.pause(); isPlaying=false; $("playButton").classList.remove("playing"); setStatus("paused"); cancelAnimationFrame(animation); }
  else { await audio.play(); isPlaying=true; $("playButton").classList.add("playing"); setStatus("listening live"); drawFromAudio(); }
});
audio.addEventListener("timeupdate", () => { $("trackTime").textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`; $("progressFill").style.width=`${audio.duration ? audio.currentTime/audio.duration*100 : 0}%`; });
audio.addEventListener("ended", () => { isPlaying=false; $("playButton").classList.remove("playing"); setStatus("ready to listen"); });
$("progressTrack").addEventListener("click", e => { if(audio.duration) audio.currentTime = (e.offsetX/e.currentTarget.offsetWidth)*audio.duration; });
$("muteButton").addEventListener("click", () => { audio.muted=!audio.muted; $("muteButton").style.opacity=audio.muted?".35":"1"; });
["dragenter","dragover"].forEach(event => $("artboard").addEventListener(event, e => { e.preventDefault(); $("artboard").style.borderColor="var(--orange)"; }));
$("artboard").addEventListener("dragleave", () => $("artboard").style.borderColor="");
$("artboard").addEventListener("drop", e => { e.preventDefault(); $("artboard").style.borderColor=""; loadAudio(e.dataTransfer.files[0]); });
function download(blob, name) { const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=name; link.click(); URL.revokeObjectURL(link.href); }
$("exportSvg").addEventListener("click", () => { const content=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 680"><rect width="1200" height="680" fill="#050505"/>${svg.innerHTML}</svg>`; download(new Blob([content],{type:"image/svg+xml"}),"resonance-ridgeline.svg"); });
$("exportPng").addEventListener("click", () => { const canvas=document.createElement("canvas"); canvas.width=2400; canvas.height=1360; const ctx=canvas.getContext("2d"); ctx.fillStyle="#050505";ctx.fillRect(0,0,canvas.width,canvas.height); const img=new Image(); img.onload=()=>{ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>download(blob,"resonance-ridgeline.png"));}; img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 680"><rect width="1200" height="680" fill="#050505"/>${svg.innerHTML}</svg>`); });
makeMockRidges();
