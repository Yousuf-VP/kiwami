import * as THREE from "three";
import { createGameplay } from "./gameplay.js";
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

const $ = (id) => document.getElementById(id);
const video = $("cameraVideo"), cursor = $("handCursor"), cursorProgress = $("cursorProgress"), toast = $("toast");
let renderer, scene, camera, clock, handLandmarker = null, cameraStream = null, gameplay = null, dojoEnvironment = null;
let trackingActive = false, lastVideoTime = -1, lastInferenceAt = 0, lastHandClickAt = 0, toastTimeout = 0;
let smoothedX = null, smoothedY = null, lastRawX = null, lastRawY = null, lastRawAt = 0;
let palmSince = 0, palmLatched = false, palmAnchorX = null, palmAnchorY = null, backSince = 0, backGestureLatched = false, pendingGesture = "none", pendingGestureFrames = 0, activeGesture = "none", hoveredTarget = null;
let fpsFrames = 0, fpsStamp = performance.now();
const floatingObjects = [], CLICK_COOLDOWN_MS = 480, INFERENCE_INTERVAL_MS = 16, GESTURE_CONFIRM_FRAMES = 3;

function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.classList.remove("show"),3000)}
function setSystem(message,count="0 / 1"){$("systemState").textContent=message;$("handCount").textContent=count}
function setCameraMessage(title,hint){$("cameraState").textContent=title;$("cameraHint").textContent=hint}
function setTrackingHUD(state,title,detail){
 const hud=$("trackingHud");if(!hud)return;
 hud.dataset.state=state;$("trackingTitle").textContent=title;$("trackingDetail").textContent=detail;
}

function createDojoEnvironment(){
 const group=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x38251f,roughness:.82}),dark=new THREE.MeshStandardMaterial({color:0x1b1517,roughness:.9}),paper=new THREE.MeshStandardMaterial({color:0xd9c6a4,roughness:.95,transparent:true,opacity:.22,side:THREE.DoubleSide}),trim=new THREE.MeshStandardMaterial({color:0x8a4c32,roughness:.72}),glow=new THREE.MeshStandardMaterial({color:0xffa65c,emissive:0xff6a2a,emissiveIntensity:2.1});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,22),new THREE.MeshStandardMaterial({color:0x211613,roughness:.94}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-3.48,-2);group.add(floor);
 // Individual warm timber boards with staggered joints, dark seams and subtle grain.
 const plankGeometry=new THREE.BoxGeometry(1.78,.065,1.68);
 const grainGeometry=new THREE.BoxGeometry(.018,.008,1.42);
 const plankMaterials=[0x68402c,0x754832,0x805039,0x5f3929,0x89563a].map(color=>new THREE.MeshStandardMaterial({color,roughness:.88}));
 const grainMaterial=new THREE.MeshStandardMaterial({color:0xb27a51,roughness:1,transparent:true,opacity:.2});
 for(let row=0;row<13;row++){
  const stagger=row%2?.9:0;
  for(let col=0;col<15;col++){
   const x=-12.6+col*1.8+stagger,z=-11.45+row*1.72;
   const board=new THREE.Mesh(plankGeometry,plankMaterials[(row*7+col*3)%plankMaterials.length]);
   board.position.set(x,-3.43,z);group.add(board);
   const grain=new THREE.Mesh(grainGeometry,grainMaterial);
   grain.position.set(x+(col%2?.42:-.42),-3.391,z);group.add(grain);
  }
 }
 const rear=new THREE.Mesh(new THREE.PlaneGeometry(27,13),dark);rear.position.set(0,2.8,-8.5);group.add(rear);
 const paperWall=new THREE.Mesh(new THREE.PlaneGeometry(22,8.8),paper);paperWall.position.set(0,2.9,-8.42);group.add(paperWall);
 for(let x=-10;x<=10;x+=2){const post=new THREE.Mesh(new THREE.BoxGeometry(.13,9.5,.18),trim);post.position.set(x,1.7,-8.25);group.add(post)}
 for(let y=-1.2;y<=6;y+=1.8){const rail=new THREE.Mesh(new THREE.BoxGeometry(22,.12,.2),trim);rail.position.set(0,y,-8.2);group.add(rail)}
 const beam=new THREE.Mesh(new THREE.BoxGeometry(25,.34,.42),wood);beam.position.set(0,7.25,-8.1);group.add(beam);
 for(const side of [-1,1]){
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(.42,10,.46),wood);pillar.position.set(side*11.7,1.5,-5.8);group.add(pillar);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(5.2,8.8),paper);panel.position.set(side*9.1,1.7,-5.9);panel.rotation.y=side*Math.PI*.24;group.add(panel);
  for(let i=0;i<3;i++){const lantern=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.62,.92,.52),glow),cap=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.12,8),dark),base=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.12,8),dark);lantern.add(body);cap.position.y=.53;base.position.y=-.53;lantern.add(cap,base);lantern.position.set(side*(6.8+i*.5),2.35-(i%2)*1.35,-4.8-i*.7);group.add(lantern);const light=new THREE.PointLight(0xff8a48,18,9);light.position.copy(lantern.position);group.add(light)}
 }
 for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.28,6.8,.3),trim);leg.position.set(side*4.7,1.1,-7.65);group.add(leg)}
 const torii=new THREE.Mesh(new THREE.BoxGeometry(10.8,.34,.5),wood);torii.position.set(0,4.65,-7.55);group.add(torii);
 const cap=new THREE.Mesh(new THREE.BoxGeometry(11.8,.2,.62),trim);cap.position.set(0,4.95,-7.55);group.add(cap);
 const count=95,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*23;positions[i*3+1]=Math.random()*10-2;positions[i*3+2]=-Math.random()*12-1}
 const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(positions,3));group.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xff9aa8,size:.055,transparent:true,opacity:.65,depthWrite:false})));
 group.visible=false;scene.add(group);return group;
}
function initScene(){
 const host=$("sceneHost");scene=new THREE.Scene();scene.background=new THREE.Color(0x09090d);scene.fog=new THREE.FogExp2(0x09090d,.035);
 camera=new THREE.PerspectiveCamera(innerWidth/innerHeight<.78?52:43,innerWidth/innerHeight,.1,100);camera.position.set(0,1.1,12.8);camera.lookAt(0,.2,0);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
 scene.add(new THREE.AmbientLight(0xffffff,1.35));
 const key=new THREE.PointLight(0xff8747,95,28);key.position.set(-4,4,5);scene.add(key);
 const rim=new THREE.PointLight(0x7d83ff,65,30);rim.position.set(5,1,-3);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(13,96),new THREE.MeshStandardMaterial({color:0x111018,roughness:.82,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.5;scene.add(floor);dojoEnvironment=createDojoEnvironment();
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
 clock=new THREE.Clock();
 gameplay=createGameplay({THREE,scene,camera,renderer});
 window.fruitFrenzyGame=gameplay;
 addEventListener("resize",resizeScene);animateScene();
}
function resizeScene(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth/innerHeight<.78?52:43;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4))}
function animateScene(){requestAnimationFrame(animateScene);const delta=Math.min(clock.getDelta(),.05),t=clock.elapsedTime,inGame=document.body.classList.contains("is-playing");floatingObjects.forEach((o,i)=>{o.visible=!inGame;if(o.visible){o.position.y=o.userData.baseY+Math.sin(t*.72+o.userData.phase)*.22;o.rotation.y+=.002+i*.00025;o.rotation.x=Math.sin(t*.35+o.userData.phase)*.08}});if(dojoEnvironment)dojoEnvironment.visible=inGame;if(gameplay)gameplay.update(delta,t);camera.position.x=inGame?0:Math.sin(t*.12)*.16;camera.lookAt(0,.2,-.2);renderer.render(scene,camera)}

async function enableCamera(){
 const button=$("cameraButton");
 if(!navigator.mediaDevices?.getUserMedia){showToast("Camera access requires HTTPS or localhost in a supported browser.");setCameraMessage("CAMERA UNAVAILABLE","Open this page over HTTPS and use a supported browser.");return}
 button.disabled=true;button.textContent="CONNECTING…";setCameraMessage("REQUESTING PERMISSION","Approve camera access in your browser.");
 try{
  cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:60,max:60}}});
  video.srcObject=cameraStream;await video.play();$("cameraPreview").hidden=false;
  setCameraMessage("LOADING HAND TRACKER","Preparing the local hand-detection model.");setTrackingHUD("searching","LOADING TRACKER","Starting hand detection…");
  const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const modelAssetPath="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  try {
   handLandmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath,delegate:"GPU"},runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.52,minHandPresenceConfidence:.52,minTrackingConfidence:.48});
  } catch(gpuError) {
   console.warn("GPU hand tracking unavailable; retrying with CPU.",gpuError);
   handLandmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath,delegate:"CPU"},runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.52,minHandPresenceConfidence:.52,minTrackingConfidence:.48});
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
   // Lock the pointer at the last index-finger position as soon as the palm starts opening.
   // This prevents the index tip rising away from a menu button during the click gesture.
   const twoFingerBack=isTwoFingerBack(points),openPalm=isOpenPalm(points);
   const pointerBeforePalmX=smoothedX,pointerBeforePalmY=smoothedY;
   if(!openPalm){palmAnchorX=null;palmAnchorY=null}
   updateIndexCursor(points[8],now);
   if(openPalm&&palmAnchorX===null){
    palmAnchorX=pointerBeforePalmX??smoothedX;palmAnchorY=pointerBeforePalmY??smoothedY;
    if(palmAnchorX!==null&&palmAnchorY!==null)moveHandCursor(palmAnchorX,palmAnchorY);
   }
   const pointing=isIndexPointing(points),fist=isFist(points);
   if(gameplay&&isPlayMode())gameplay.setPointer(smoothedX,smoothedY,now);
   const playingNow=!!gameplay?.isPlaying?.();
   const rawGesture=twoFingerBack&&!playingNow?"back":(openPalm&&!playingNow)?"palm":pointing?"point":fist?"fist":"open";
   if(rawGesture===pendingGesture)pendingGestureFrames++;
   else{pendingGesture=rawGesture;pendingGestureFrames=1}
   if(pendingGestureFrames>=GESTURE_CONFIRM_FRAMES)activeGesture=rawGesture;

   if(activeGesture==="back"){
    palmSince=0;palmLatched=false;
    if(!backSince)backSince=now;
    if(!backGestureLatched&&!isPlayMode()&&now-backSince>=350){triggerMenuBack();backGestureLatched=true}
    setTrackingHUD("detected","TWO FINGERS · BACK","Index + middle fingers extended · release to use again");
    setSystem("BACK GESTURE","1 / 1");
    setCameraMessage("BACK GESTURE READY","Hold index and middle fingers up to go back in menus.");
   }else if(activeGesture==="point"){
    backSince=0;backGestureLatched=false;
    palmSince=0;palmLatched=false;
    setTrackingHUD("detected","POINTING · CURSOR ACTIVE","Move your index fingertip · open your palm to click");
    setSystem("CURSOR ACTIVE","1 / 1");
    setCameraMessage("INDEX FINGER READY","Move your index fingertip quickly through fruit to slice. Avoid bombs and do not let fruit fall. Full open palm selects menu controls; two fingers go Back.");
   }else if(activeGesture==="palm"){
    backSince=0;backGestureLatched=false;
    if(!palmSince)palmSince=now;
    if(!palmLatched&&now-palmSince>=110){triggerHandClick();palmLatched=true}
    setTrackingHUD("detected",palmLatched?"OPEN PALM · CLICKED":"OPEN PALM · READY",gameplay?.state==="paused"?"Open palm selects RESUME, RESTART or MAIN MENU.":"Open palm selects RESTART or MAIN MENU.");
    setSystem("PALM CLICK","1 / 1");
    setCameraMessage("OPEN PALM CLICK READY","Hold all five fingers open over a control. Relax your hand to reset.");
   }else{
    backSince=0;backGestureLatched=false;palmSince=0;palmLatched=false;
    setTrackingHUD("detected","HAND DETECTED","Index fingertip moves · full open palm clicks · two fingers go back");
    setSystem("HAND DETECTED","1 / 1");
    setCameraMessage("HAND DETECTED","Extend your index finger to move the cursor; show your full open palm to click.");
   }
  }else{
   cursor.classList.remove("visible","clicking");palmSince=0;palmLatched=false;palmAnchorX=null;palmAnchorY=null;smoothedX=null;smoothedY=null;lastRawX=null;lastRawY=null;lastRawAt=0;pendingGesture="none";pendingGestureFrames=0;activeGesture="none";backSince=0;backGestureLatched=false;
   if(hoveredTarget){hoveredTarget.classList.remove("hand-hover");hoveredTarget=null}
   setSystem("SEARCHING FOR HAND");setCameraMessage("HAND NOT IN VIEW","Move your hand into the camera frame.");setTrackingHUD("lost","NO HAND DETECTED","Camera is live · move hand into frame");
  }
  fpsFrames++;
 }
 if(now-fpsStamp>=1000){$("cameraFps").textContent=Math.round(fpsFrames*1000/(now-fpsStamp))+" FPS";fpsFrames=0;fpsStamp=now}
 requestAnimationFrame(processHandFrames);
}
function updateIndexCursor(tip,now){
 const rawX=(1-tip.x)*innerWidth,rawY=tip.y*innerHeight;
 const elapsed=Math.max(1,now-lastRawAt);
 const deltaPx=lastRawX===null?0:Math.hypot(rawX-lastRawX,rawY-lastRawY);
 const speed=deltaPx/elapsed;
 // Suppress sub-pixel landmark shimmer; fast strokes receive almost no smoothing lag.
 const alpha=Math.min(.995,Math.max(.76,.76+speed*.0032));
 if(smoothedX===null){smoothedX=rawX;smoothedY=rawY}
 else if(deltaPx>0.85){smoothedX+=(rawX-smoothedX)*alpha;smoothedY+=(rawY-smoothedY)*alpha}
 lastRawX=rawX;lastRawY=rawY;lastRawAt=now;
 moveHandCursor(palmAnchorX!==null&&palmAnchorY!==null?palmAnchorX:smoothedX,palmAnchorX!==null&&palmAnchorY!==null?palmAnchorY:smoothedY);
}
function distance3D(a,b){const dx=a.x-b.x,dy=a.y-b.y,dz=(a.z||0)-(b.z||0);return Math.hypot(dx,dy,dz)}
function fingerExtended(points,tip,pip){return distance3D(points[0],points[tip])>distance3D(points[0],points[pip])*1.12}
function isIndexPointing(p){return fingerExtended(p,8,6)&&!fingerExtended(p,12,10)&&!fingerExtended(p,16,14)&&!fingerExtended(p,20,18)}
function isFist(p){return !fingerExtended(p,8,6)&&!fingerExtended(p,12,10)&&!fingerExtended(p,16,14)&&!fingerExtended(p,20,18)}
function isOpenPalm(p){
 const fingersOpen=fingerExtended(p,8,6)&&fingerExtended(p,12,10)&&fingerExtended(p,16,14)&&fingerExtended(p,20,18);
 const thumbOpen=distance3D(p[4],p[5])>distance3D(p[3],p[5])*1.12;
 return fingersOpen&&thumbOpen;
}
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
 // The root menu has no Back destination. Never leave the game from a gesture.
 window.dispatchEvent(new CustomEvent("fruitfrenzy:back"));
 showToast("NO PREVIOUS MENU");
}
function moveHandCursor(x,y){
 const showCursor=gameplay?.state!=="playing";
 cursor.classList.toggle("visible",showCursor);cursor.style.left=x+"px";cursor.style.top=y+"px";
 if(!showCursor){if(hoveredTarget){hoveredTarget.classList.remove("hand-hover");hoveredTarget=null}return}
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
 if(gameplay?.state==="playing")return;
 if(performance.now()-lastHandClickAt<CLICK_COOLDOWN_MS)return;
 lastHandClickAt=performance.now();
 const x=palmAnchorX!==null&&palmAnchorY!==null?palmAnchorX:smoothedX;
 const y=palmAnchorX!==null&&palmAnchorY!==null?palmAnchorY:smoothedY;
 if(x===null||y===null)return;
 const hit=document.elementFromPoint(x,y);
 const backdrop=$("modalBackdrop");
 if(!backdrop.hidden&&hit===backdrop){if(tutorialActive)completeFirstRunTutorial();else closeModal();return}
 const target=hit?.closest("button,a,[role='button'],input,select,textarea,[data-hand-click]");
 if(!target||target.disabled||target.getAttribute("aria-disabled")==="true")return;
 cursor.classList.add("clicking");setTimeout(()=>cursor.classList.remove("clicking"),170);
 target.click();
}
function stopCamera(){
 trackingActive=false;if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null}
 if(handLandmarker){handLandmarker.close();handLandmarker=null}video.srcObject=null;cursor.classList.remove("visible","dwell","clicking");if(hoveredTarget){hoveredTarget.classList.remove("hand-hover");hoveredTarget=null}smoothedX=null;smoothedY=null;lastRawX=null;lastRawY=null;lastRawAt=0;palmSince=0;palmLatched=false;palmAnchorX=null;palmAnchorY=null;pendingGesture="none";pendingGestureFrames=0;activeGesture="none";backGestureLatched=false;$("cameraPreview").hidden=true;
 $("cameraButton").disabled=false;$("cameraButton").innerHTML='ENABLE CAMERA <span>↗</span>';$("cameraFps").textContent="-- FPS";setSystem("STANDBY");setCameraMessage("CAMERA NOT CONNECTED","Allow camera access to control the menu.");setTrackingHUD("off","TRACKING OFF","Enable camera to begin");
}
function openModal(title,content){$("modalTitle").innerHTML=title;$("modalContent").innerHTML=content;$("modalBackdrop").hidden=false}
let tutorialActive=false;
function closeModal(){$("modalBackdrop").hidden=true;$("modalBackdrop").classList.remove("is-tutorial");tutorialActive=false}
function completeFirstRunTutorial(){
 if(!tutorialActive)return;
 try{localStorage.setItem("ff-tutorial-complete","1")}catch(_){}
 closeModal();
 if(gameplay)gameplay.start();else showToast("Game engine is still loading.");
}
function startFirstRunTutorial(){
 tutorialActive=true;
 const content='<div class="ff-tutorial-screen"><div class="ff-tutorial-top"><span>KIWAMI ORIGINAL</span><span>FIELD GUIDE / 001</span></div><div class="ff-tutorial-hero"><div class="ff-tutorial-eyebrow"><i></i> YOUR TRAINING STARTS NOW</div><h3>READY.<br><em>SET.</em><br>SLICE.</h3><p>One hand. One blade. Master the dojo.</p></div><div class="ff-tutorial-lessons"><article><b>01 / CONTROL</b><strong>POINT & SLICE</strong><p>Extend your index finger and sweep through fruit. Your blade follows your fingertip.</p></article><article><b>02 / SCORE</b><strong>CHAIN COMBOS</strong><p>Slice quickly and catch a whole wave for bigger bonuses. Golden fruit is rare.</p></article><article class="hazard"><b>03 / SURVIVE</b><strong>AVOID BOMBS</strong><p>Never slice a bomb. Missed fruit is safe — keep your focus on the hazards.</p></article></div><div class="ff-tutorial-bottom"><span class="ff-tap-pulse">✦</span><strong>TAP ANYWHERE TO SKIP</strong><span>OR SHOW OPEN PALM</span></div></div>';
 openModal('TRAINING <em>BRIEFING</em>',content);
 $("modalBackdrop").classList.add("is-tutorial");
}
function bindInterface(){
 $("cameraButton").addEventListener("click",enableCamera);$("cameraClose").addEventListener("click",()=>{stopCamera();showToast("Camera disconnected.")});
 $("playButton").addEventListener("click",()=>{
  if(!gameplay){showToast("Game engine is still loading.");return}
  let seen=false;try{seen=localStorage.getItem("ff-tutorial-complete")==="1"}catch(_){}
  if(seen)gameplay.start();else startFirstRunTutorial();
 });
 $("howButton").addEventListener("click",()=>openModal("HOW TO <em>PLAY</em>",'<div class="guide-row"><b>01</b><div><strong>ENABLE YOUR CAMERA</strong><p>Allow webcam access. Hand tracking runs locally in your browser.</p></div></div><div class="guide-row"><b>02</b><div><strong>POINT TO NAVIGATE</strong><p>Your index fingertip controls the menu cursor. Show a full open palm to select; raise index and middle fingers to go Back. The cursor hides while you are actively slicing.</p></div></div><div class="guide-row"><b>03</b><div><strong>SLICE IN THE ARENA</strong><p>Move your index fingertip through fruit to slice. Build timed and same-wave combos, collect rare Golden Fruit and avoid bombs — slicing a bomb ends the run. Missed fruit has no life penalty.</p></div></div>'));
 $("settingsButton").addEventListener("click",()=>openModal("SYSTEM <em>SETTINGS</em>",'<div class="guide-row"><b>CAM</b><div><strong>CAMERA PRIVACY</strong><p>Camera access is optional and only starts after you press Enable Camera. Video is processed locally and is not uploaded by this prototype.</p></div></div><div class="guide-row"><b>TIP</b><div><strong>TRACKING ENVIRONMENT</strong><p>Use a well-lit space, keep your hand inside the frame and face your palm toward the camera.</p></div></div>'));
 $("modalClose").addEventListener("click",closeModal);$("modalBackdrop").addEventListener("pointerdown",e=>{if(tutorialActive){e.preventDefault();completeFirstRunTutorial();return}if(e.target===$("modalBackdrop"))closeModal()});$("modalBackdrop").addEventListener("click",e=>{if(tutorialActive){completeFirstRunTutorial();return}if(e.target===$("modalBackdrop"))closeModal()});addEventListener("keydown",e=>{if(e.key==="Escape"){if(tutorialActive)completeFirstRunTutorial();else closeModal()}});addEventListener("pagehide",stopCamera);
}
initScene();bindInterface();