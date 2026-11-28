import * as THREE from "three";
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

const $ = (id) => document.getElementById(id);
const video = $("cameraVideo"), cursor = $("handCursor"), cursorProgress = $("cursorProgress"), toast = $("toast");
let renderer, scene, camera, clock, handLandmarker = null, cameraStream = null;
let trackingActive = false, lastVideoTime = -1, lastInferenceAt = 0, lastHandClickAt = 0, toastTimeout = 0;
let smoothedX = null, smoothedY = null, lastRawX = null, lastRawY = null, lastRawAt = 0;
let fistSince = 0, fistLatched = false, backGestureLatched = false, pendingGesture = "none", pendingGestureFrames = 0, activeGesture = "none", hoveredTarget = null;
let fpsFrames = 0, fpsStamp = performance.now();
const floatingObjects = [], CLICK_COOLDOWN_MS = 480, INFERENCE_INTERVAL_MS = 33, GESTURE_CONFIRM_FRAMES = 2;

function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.classList.remove("show"),3000)}
function setSystem(message,count="0 / 1"){$("systemState").textContent=message;$("handCount").textContent=count}
function setCameraMessage(title,hint){$("cameraState").textContent=title;$("cameraHint").textContent=hint}
function setTrackingHUD(state,title,detail){
 const hud=$("trackingHud");if(!hud)return;
 hud.dataset.state=state;$("trackingTitle").textContent=title;$("trackingDetail").textContent=detail;
}

function initScene(){
 const host=$("sceneHost");scene=new THREE.Scene();scene.background=new THREE.Color(0x09090d);scene.fog=new THREE.FogExp2(0x09090d,.035);
 camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,100);camera.position.set(0,1.1,12.8);camera.lookAt(0,.2,0);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
 scene.add(new THREE.AmbientLight(0xffffff,1.35));
 const key=new THREE.PointLight(0xff8747,95,28);key.position.set(-4,4,5);scene.add(key);
 const rim=new THREE.PointLight(0x7d83ff,65,30);rim.position.set(5,1,-3);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(13,96),new THREE.MeshStandardMaterial({color:0x111018,roughness:.82,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.5;scene.add(floor);
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(3.8+i*1.5,.012,8,140),new THREE.MeshBasicMaterial({color:0xff7138,transparent:true,opacity:.25}));ring.position.set(1.8,-.5+i*.08,-4-i*.3);ring.rotation.x=Math.PI*.5;ring.rotation.z=i*.18;scene.add(ring)}
 const specs=[
 {color:0xe84343,scale:[.78,.82,.78],pos:[3.6,1.45,-1.8],leaf:0x5dba63},
 {color:0xffb52e,scale:[.65,.92,.65],pos:[5.2,-.8,-3.4],leaf:0x4d9d4f},
 {color:0x77c85a,scale:[.9,.9,.9],pos:[-3.2,1.2,-2.5],leaf:0x398c45},
 {color:0xff7a32,scale:[.72,.72,.72],pos:[-4.4,-.6,-1.8],leaf:0x4ca34b},
 {color:0xa64bcb,scale:[.58,.8,.58],pos:[.5,2.5,-4.8],leaf:0x56a65c}
 ];
 specs.forEach((s,i)=>{
  const group=new THREE.Group();
  const fruit=new THREE.Mesh(new THREE.SphereGeometry(1,40,32),new THREE.MeshPhysicalMaterial({color:s.color,roughness:.27,metalness:.02,clearcoat:.7,clearcoatRoughness:.18}));fruit.scale.set(...s.scale);group.add(fruit);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.24,8),new THREE.MeshStandardMaterial({color:0x5d3924,roughness:.8}));stem.position.y=s.scale[1]*.92;group.add(stem);
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(.19,18,12),new THREE.MeshStandardMaterial({color:s.leaf,roughness:.55}));leaf.scale.set(1.35,.28,.7);leaf.position.set(.17,s.scale[1]+.1,0);leaf.rotation.z=-.35;group.add(leaf);
  group.position.set(...s.pos);group.rotation.set(i*.3,i*.7,i*.2);group.userData.phase=i*1.7;group.userData.baseY=s.pos[1];scene.add(group);floatingObjects.push(group);
 });
 const count=240,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*24;positions[i*3+1]=(Math.random()-.5)*13;positions[i*3+2]=-Math.random()*18-2}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffb27b,size:.025,transparent:true,opacity:.62})));
 clock=new THREE.Clock();addEventListener("resize",resizeScene);animateScene();
}
function resizeScene(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4))}
function animateScene(){requestAnimationFrame(animateScene);const t=clock.getElapsedTime();floatingObjects.forEach((o,i)=>{o.position.y=o.userData.baseY+Math.sin(t*.72+o.userData.phase)*.22;o.rotation.y+=.002+i*.00025;o.rotation.x=Math.sin(t*.35+o.userData.phase)*.08});camera.position.x=Math.sin(t*.12)*.16;camera.lookAt(0,.2,-.2);renderer.render(scene,camera)}

async function enableCamera(){
 const button=$("cameraButton");
 if(!navigator.mediaDevices?.getUserMedia){showToast("Camera access requires HTTPS or localhost in a supported browser.");setCameraMessage("CAMERA UNAVAILABLE","Open this page over HTTPS and use a supported browser.");return}
 button.disabled=true;button.textContent="CONNECTING…";setCameraMessage("REQUESTING PERMISSION","Approve camera access in your browser.");
 try{
  cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
  video.srcObject=cameraStream;await video.play();$("cameraPreview").hidden=false;
  setCameraMessage("LOADING HAND TRACKER","Preparing the local hand-detection model.");setTrackingHUD("searching","LOADING TRACKER","Starting hand detection…");
  const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const modelAssetPath="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  try {
   handLandmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath,delegate:"GPU"},runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.58,minHandPresenceConfidence:.55,minTrackingConfidence:.55});
  } catch(gpuError) {
   console.warn("GPU hand tracking unavailable; retrying with CPU.",gpuError);
   handLandmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath,delegate:"CPU"},runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.58,minHandPresenceConfidence:.55,minTrackingConfidence:.55});
  }
  trackingActive=true;button.textContent="CAMERA ENABLED";setCameraMessage("WAITING FOR YOUR HAND","Show one hand to the camera, palm facing forward.");setTrackingHUD("searching","SEARCHING FOR HAND","Camera is live · show one hand");setSystem("SCANNING");processHandFrames();showToast("Camera connected. Show one hand to begin calibration.");
 }catch(error){
  console.error("FRUIT FRENZY camera setup:",error);stopCamera();button.disabled=false;button.textContent="ENABLE CAMERA ↗";
  const denied=error?.name==="NotAllowedError"||error?.name==="PermissionDeniedError";
  setCameraMessage(denied?"CAMERA PERMISSION BLOCKED":"TRACKER COULD NOT START",denied?"Allow camera access in browser site settings, then retry.":"Check your connection and reload the page.");
  setSystem("CAMERA ERROR");setTrackingHUD("lost","TRACKER ERROR","Check camera permission and connection");showToast(denied?"Camera permission was not granted.":"Could not initialize hand tracking. Check the console or reload.");
 }
}
function processHandFrames(){
 if(!trackingActive||!handLandmarker)return;
 const now=performance.now();
 if(video.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&video.currentTime!==lastVideoTime&&now-lastInferenceAt>=INFERENCE_INTERVAL_MS){
  lastVideoTime=video.currentTime;lastInferenceAt=now;
  const result=handLandmarker.detectForVideo(video,now);const points=result.landmarks?.[0];
  if(points){
   const pointing=isIndexPointing(points),fist=isFist(points);
   const twoFingerBack=isTwoFingerBack(points);
   const rawGesture=twoFingerBack?"back":pointing?"point":fist?"fist":"open";
   if(rawGesture===pendingGesture)pendingGestureFrames++;
   else{pendingGesture=rawGesture;pendingGestureFrames=1}
   if(pendingGestureFrames>=GESTURE_CONFIRM_FRAMES)activeGesture=rawGesture;

   if(activeGesture==="back"){
    fistSince=0;fistLatched=false;
    if(!backGestureLatched&&!isPlayMode()){triggerMenuBack();backGestureLatched=true}
    setTrackingHUD("detected","TWO FINGERS · BACK","Index + middle fingers extended · release to use again");
    setSystem("BACK GESTURE","1 / 1");
    setCameraMessage("BACK GESTURE READY","Hold index and middle fingers up to go back in menus.");
   }else if(activeGesture==="point"){
    backGestureLatched=false;
    const tip=points[8],rawX=(1-tip.x)*innerWidth,rawY=tip.y*innerHeight;
    const elapsed=Math.max(1,now-lastRawAt);
    const speed=lastRawX===null?0:Math.hypot(rawX-lastRawX,rawY-lastRawY)/elapsed;
    const alpha=Math.min(.82,Math.max(.34,.34+speed*.0014));
    if(smoothedX===null){smoothedX=rawX;smoothedY=rawY}
    else{smoothedX+=(rawX-smoothedX)*alpha;smoothedY+=(rawY-smoothedY)*alpha}
    lastRawX=rawX;lastRawY=rawY;lastRawAt=now;
    moveHandCursor(smoothedX,smoothedY);
    fistSince=0;fistLatched=false;
    setTrackingHUD("detected","POINTING · CURSOR ACTIVE","Move index finger · make a fist to click");
    setSystem("CURSOR ACTIVE","1 / 1");
    setCameraMessage("INDEX FINGER READY","Point at a control, then close your fist to click. Raise index + middle fingers to go back.");
   }else if(activeGesture==="fist"){
    backGestureLatched=false;
    if(!fistSince)fistSince=now;
    if(!fistLatched&&now-fistSince>=85){triggerHandClick();fistLatched=true}
    setTrackingHUD("detected",fistLatched?"FIST · CLICKED":"FIST · READY","Fist detected · release to click again");
    setSystem("FIST GESTURE","1 / 1");
    setCameraMessage("FIST CLICK READY","Release your hand, point at another control, then make a fist.");
   }else{
    backGestureLatched=false;fistSince=0;fistLatched=false;
    setTrackingHUD("detected","HAND DETECTED","Point to move · fist to click · two fingers to go back");
    setSystem("HAND DETECTED","1 / 1");
    setCameraMessage("HAND DETECTED","Extend your index finger to move the cursor.");
   }
  }else{
   cursor.classList.remove("visible","clicking");fistSince=0;fistLatched=false;smoothedX=null;smoothedY=null;lastRawX=null;lastRawY=null;lastRawAt=0;pendingGesture="none";pendingGestureFrames=0;activeGesture="none";backGestureLatched=false;
   if(hoveredTarget){hoveredTarget.classList.remove("hand-hover");hoveredTarget=null}
   setSystem("SEARCHING FOR HAND");setCameraMessage("HAND NOT IN VIEW","Move your hand into the camera frame.");setTrackingHUD("lost","NO HAND DETECTED","Camera is live · move hand into frame");
  }
  fpsFrames++;
 }
 if(now-fpsStamp>=1000){$("cameraFps").textContent=Math.round(fpsFrames*1000/(now-fpsStamp))+" FPS";fpsFrames=0;fpsStamp=now}
 requestAnimationFrame(processHandFrames);
}
function distance3D(a,b){const dx=a.x-b.x,dy=a.y-b.y,dz=(a.z||0)-(b.z||0);return Math.hypot(dx,dy,dz)}
function fingerExtended(points,tip,pip){return distance3D(points[0],points[tip])>distance3D(points[0],points[pip])*1.12}
function isIndexPointing(p){return fingerExtended(p,8,6)&&!fingerExtended(p,12,10)&&!fingerExtended(p,16,14)&&!fingerExtended(p,20,18)}
function isFist(p){return !fingerExtended(p,8,6)&&!fingerExtended(p,12,10)&&!fingerExtended(p,16,14)&&!fingerExtended(p,20,18)}
function isTwoFingerBack(p){
 return fingerExtended(p,8,6)&&fingerExtended(p,12,10)&&!fingerExtended(p,16,14)&&!fingerExtended(p,20,18);
}
function isPlayMode(){
 const game=window.fruitFrenzyGame;
 if(game){
  if(typeof game.isPlaying==="function"&&game.isPlaying())return true;
  if(["playing","running","active"].includes(String(game.state||game.mode||"").toLowerCase()))return true;
  if(game.playMode===true||game.isPlaying===true)return true;
 }
 if(document.body.dataset.playMode==="true"||document.documentElement.dataset.playMode==="true")return true;
 return !!document.querySelector('[data-screen="game"].is-active, .game-screen.is-active, #gameScreen.is-active');
}
function triggerMenuBack(){
 // Two-finger Back is only used outside Play Mode.
 const backButton=[...document.querySelectorAll(
  "[data-back-button], #backButton, .back-button, .menu-back, .modal-close"
 )].find(el=>!el.disabled&&el.getAttribute("aria-disabled")!=="true"&&el.getClientRects().length);
 if(backButton){
  backButton.click();
  showToast("BACK");
  return;
 }
 // The prototype's secondary menu screens are dialogs; close them like Back.
 const modal=$("modalBackdrop");
 if(modal&&!modal.hidden){
  closeModal();
  showToast("BACK");
  return;
 }
 // On the main menu, Back returns to the KIWAMI studio homepage.
 const studioBack=document.querySelector("a.back-link, a.studio-mark");
 if(studioBack){
  studioBack.click();
  showToast("BACK TO STUDIO");
  return;
 }
 window.dispatchEvent(new CustomEvent("fruitfrenzy:back"));
 showToast("BACK");
}
function moveHandCursor(x,y){
 cursor.classList.add("visible");cursor.style.left=x+"px";cursor.style.top=y+"px";
 const underPointer=document.elementFromPoint(x,y);
 const candidate=underPointer?.closest("button,a,[role='button'],input,select,textarea,[data-hand-click]");
 const target=candidate&&!candidate.disabled&&candidate.getAttribute("aria-disabled")!=="true"?candidate:null;
 if(target!==hoveredTarget){
  if(hoveredTarget)hoveredTarget.classList.remove("hand-hover");
  hoveredTarget=target;
  if(hoveredTarget)hoveredTarget.classList.add("hand-hover");
 }
}
function triggerHandClick(){
 if(performance.now()-lastHandClickAt<CLICK_COOLDOWN_MS)return;
 lastHandClickAt=performance.now();
 const x=smoothedX,y=smoothedY;
 if(x===null||y===null)return;
 const hit=document.elementFromPoint(x,y);
 const backdrop=$("modalBackdrop");
 if(!backdrop.hidden&&hit===backdrop){closeModal();return}
 const target=hit?.closest("button,a,[role='button'],input,select,textarea,[data-hand-click]");
 if(!target||target.disabled||target.getAttribute("aria-disabled")==="true")return;
 cursor.classList.add("clicking");setTimeout(()=>cursor.classList.remove("clicking"),170);
 target.click();
}
function stopCamera(){
 trackingActive=false;if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null}
 if(handLandmarker){handLandmarker.close();handLandmarker=null}video.srcObject=null;cursor.classList.remove("visible","dwell","clicking");if(hoveredTarget){hoveredTarget.classList.remove("hand-hover");hoveredTarget=null}smoothedX=null;smoothedY=null;lastRawX=null;lastRawY=null;lastRawAt=0;fistSince=0;fistLatched=false;pendingGesture="none";pendingGestureFrames=0;activeGesture="none";backGestureLatched=false;$("cameraPreview").hidden=true;
 $("cameraButton").disabled=false;$("cameraButton").innerHTML='ENABLE CAMERA <span>↗</span>';$("cameraFps").textContent="-- FPS";setSystem("STANDBY");setCameraMessage("CAMERA NOT CONNECTED","Allow camera access to control the menu.");setTrackingHUD("off","TRACKING OFF","Enable camera to begin");
}
function openModal(title,content){$("modalTitle").innerHTML=title;$("modalContent").innerHTML=content;$("modalBackdrop").hidden=false}
function closeModal(){$("modalBackdrop").hidden=true}
function bindInterface(){
 $("cameraButton").addEventListener("click",enableCamera);$("cameraClose").addEventListener("click",()=>{stopCamera();showToast("Camera disconnected.")});
 $("playButton").addEventListener("click",()=>openModal("THE FRENZY IS <em>LOADING</em>",'<div class="guide-row"><b>01</b><div><strong>HAND INPUT FOUNDATION READY</strong><p>Your hand-controlled menu is online. The 3D slicing engine, fruit physics, scoring and game modes are scheduled for Phase 2.</p></div></div><div class="guide-row"><b>02</b><div><strong>COMING NEXT</strong><p>Index-finger blade trail, fruit launches, slice detection, combos, lives and the first playable Classic mode.</p></div></div>'));
 $("howButton").addEventListener("click",()=>openModal("HOW TO <em>PLAY</em>",'<div class="guide-row"><b>01</b><div><strong>ENABLE YOUR CAMERA</strong><p>Allow webcam access. Hand tracking runs locally in your browser.</p></div></div><div class="guide-row"><b>02</b><div><strong>POINT TO NAVIGATE</strong><p>Move your index finger to move the glowing cursor. Point with your index finger to move; close your fist to click.</p></div></div><div class="guide-row"><b>03</b><div><strong>SLICE IN THE ARENA</strong><p>Quick index-finger movements will draw the energy blade. The slicing system arrives in Phase 2.</p></div></div>'));
 $("settingsButton").addEventListener("click",()=>openModal("SYSTEM <em>SETTINGS</em>",'<div class="guide-row"><b>CAM</b><div><strong>CAMERA PRIVACY</strong><p>Camera access is optional and only starts after you press Enable Camera. Video is processed locally and is not uploaded by this prototype.</p></div></div><div class="guide-row"><b>TIP</b><div><strong>TRACKING ENVIRONMENT</strong><p>Use a well-lit space, keep your hand inside the frame and face your palm toward the camera.</p></div></div>'));
 $("modalClose").addEventListener("click",closeModal);$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal()});addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});addEventListener("pagehide",stopCamera);
}
initScene();bindInterface();