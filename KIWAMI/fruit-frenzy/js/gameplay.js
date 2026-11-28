export function createGameplay({THREE,scene,camera,renderer}){
 const now=()=>performance.now(),fruitGeo=new THREE.SphereGeometry(1,32,24),particleGeo=new THREE.SphereGeometry(.04,8,6);
 const fruits=[],parts=[],particles=[],trail=[],waveHits=new Map();
 const mats=[
  new THREE.MeshBasicMaterial({color:0xff3d1a,transparent:true,opacity:.2,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}),
  new THREE.MeshBasicMaterial({color:0xff7138,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}),
  new THREE.MeshBasicMaterial({color:0xfff4e8,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false})
 ];
 const blades=mats.map((mat,i)=>{const mesh=new THREE.Mesh(new THREE.BufferGeometry(),mat);mesh.frustumCulled=false;mesh.renderOrder=30+i;scene.add(mesh);return mesh});
 const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-.25),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),hitPoint=new THREE.Vector3();
 const fruitTypes=[
  ["APPLE",0xe83c43,0x58b85a,.52,10],["ORANGE",0xff9b28,0x5bb34e,.48,10],["KIWI",0x8bc34a,0x3d8e48,.5,15],
  ["PLUM",0x9b63cf,0x5c9e54,.46,15],["WATERMELON",0x2eae68,0x23824f,.58,20],["STRAWBERRY",0xf05262,0x3d9b55,.4,15]
 ].map(([name,color,leaf,radius,points])=>({name,color,leaf,radius,points}));
 let state="menu",score=0,best=0,combo=0,bestCombo=0,sliced=0,elapsed=0,spawn=0,lastSlice=0,wave=0,lastPointer=null,lastPointerAt=0,audio=null,lastSound=0,hud,msgTimer=0,impactTimer=0;
 try{best=Number(localStorage.getItem("ff-classic-best")||0)}catch(_){}
 function makeUI(){
  hud=document.createElement("section");hud.className="game-hud";hud.id="classicHud";
  hud.innerHTML='<div class="game-hud-top"><div class="hud-stat"><small>SCORE</small><strong id="ffScore">000000</strong></div><div class="hud-stat"><small>BEST</small><strong id="ffBest">000000</strong></div><div class="hud-stat hud-combo-stat"><small>BEST COMBO</small><strong id="ffBestCombo">0</strong></div><button class="game-pause" id="ffPause" aria-label="Pause game">Ⅱ</button></div><div class="game-hud-bottom"><span id="ffCombo">SLICE FRUIT · AVOID BOMBS</span><span id="ffTime">00:00</span></div><div class="game-center-message" id="ffMessage"></div><div class="game-overlay" id="ffOverlay" hidden><div class="game-dialog"><div class="game-dialog-kicker" id="ffDialogKicker">CLASSIC MODE · DOJO</div><h2 id="ffDialogTitle">PAUSED</h2><p id="ffDialogText"></p><div class="game-dialog-actions"><button id="ffResume">RESUME</button><button id="ffRestart">RESTART</button><button id="ffMenu" class="secondary">MAIN MENU</button></div></div></div>';
  document.body.appendChild(hud);
  hud.querySelector("#ffPause").addEventListener("click",()=>state==="playing"?pause():state==="paused"?resume():null);
  hud.querySelector("#ffResume").addEventListener("click",resume);hud.querySelector("#ffRestart").addEventListener("click",start);hud.querySelector("#ffMenu").addEventListener("click",returnToMenu);
  addEventListener("pointermove",e=>{if(state==="playing")setPointer(e.clientX,e.clientY,now())},{passive:true});
  addEventListener("keydown",e=>{if(e.key==="Escape"&&state==="playing")pause();else if(e.key==="Escape"&&state==="paused")resume()});
 }
 function timeText(){const s=Math.floor(elapsed);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
 function mult(){return Math.min(5,1+Math.floor(Math.max(0,combo-1)/3))}
 function updateHud(force=false){if(!hud)return;const t=now();if(!force&&t-(updateHud.t||0)<80)return;updateHud.t=t;
  hud.querySelector("#ffScore").textContent=String(score).padStart(6,"0");hud.querySelector("#ffBest").textContent=String(Math.max(best,score)).padStart(6,"0");hud.querySelector("#ffBestCombo").textContent=bestCombo;
  hud.querySelector("#ffTime").textContent=timeText();hud.querySelector("#ffCombo").textContent=combo>1?"COMBO ×"+mult()+" · "+combo+" SLICES":"SLICE FRUIT · AVOID BOMBS";
 }
 function message(text,duration=850){const n=hud.querySelector("#ffMessage");n.textContent=text;n.classList.remove("visible");void n.offsetWidth;n.classList.add("visible");clearTimeout(msgTimer);msgTimer=setTimeout(()=>n.classList.remove("visible"),duration)}
 function cinematicImpact(power=1){if(!hud)return;hud.style.setProperty("--impact-power",String(Math.max(.35,Math.min(1.4,power))));hud.classList.remove("slice-impact");void hud.offsetWidth;hud.classList.add("slice-impact");clearTimeout(impactTimer);impactTimer=setTimeout(()=>hud.classList.remove("slice-impact"),260)}
 function overlay(kicker,title,text,resume){hud.querySelector("#ffDialogKicker").textContent=kicker;hud.querySelector("#ffDialogTitle").textContent=title;hud.querySelector("#ffDialogText").textContent=text;hud.querySelector("#ffResume").hidden=!resume;hud.querySelector("#ffOverlay").hidden=false}
 function hideOverlay(){hud.querySelector("#ffOverlay").hidden=true}
 function clearTrail(){trail.length=0;lastPointer=null;lastPointerAt=0;blades.forEach(b=>{b.visible=false;b.geometry.dispose();b.geometry=new THREE.BufferGeometry()})}
 function clearAll(){fruits.forEach(f=>scene.remove(f.mesh));parts.forEach(p=>scene.remove(p.mesh));particles.forEach(p=>scene.remove(p.mesh));fruits.length=0;parts.length=0;particles.length=0;waveHits.clear();clearTrail()}
 function start(){clearAll();score=0;combo=0;bestCombo=0;sliced=0;elapsed=0;spawn=.85;lastSlice=0;wave=0;state="playing";document.body.classList.add("is-playing");document.body.classList.remove("game-overlay-active");document.body.dataset.playMode="true";hideOverlay();updateHud(true);spawnWave();message("SLICE FRUIT · AVOID THE BOMBS",1600)}
 function pause(){if(state!=="playing")return;state="paused";document.body.classList.add("game-overlay-active");document.body.dataset.playMode="false";clearTrail();overlay("CLASSIC MODE · DOJO","PAUSED","Your run is on hold. Resume when you're ready.",true)}
 function resume(){if(state!=="paused")return;state="playing";document.body.classList.remove("game-overlay-active");document.body.dataset.playMode="true";clearTrail();hideOverlay()}
 function returnToMenu(){state="menu";document.body.classList.remove("is-playing","game-overlay-active");document.body.dataset.playMode="false";hideOverlay();clearAll();updateHud(true)}
 function endGame(reason){if(state!=="playing")return;cinematicImpact(1.35);state="gameover";document.body.classList.add("game-overlay-active");document.body.dataset.playMode="false";clearTrail();if(score>best){best=score;try{localStorage.setItem("ff-classic-best",String(best))}catch(_){}}
  updateHud(true);overlay("RUN COMPLETE · "+timeText(),"GAME OVER",reason+" Final score: "+score+" · Fruits sliced: "+sliced+" · Best combo: "+bestCombo+".",false)}
 function spawnWave(){
  if(state!=="playing")return;const waveId=++wave,diff=Math.min(1,elapsed/100),count=3+Math.floor(Math.random()*3)+(diff>.55&&Math.random()>.48?1:0);
  const bomb=Math.random()<.09+diff*.07,gold=!bomb&&Math.random()<.035,width=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(6,camera.position.z-.25)*camera.aspect;
  Array.from({length:count},(_,i)=>(Math.random()-.5)*width*1.35).forEach((x,i)=>setTimeout(()=>{if(state!=="playing")return;if(bomb&&i===count-1)createBomb(x,waveId);else createFruit(x,waveId,gold&&i===Math.floor(count/2))},i*(.1+Math.random()*.11)*1000));
  for(const k of waveHits.keys())if(k<wave-8)waveHits.delete(k);
 }
 function createFruit(x,waveId,golden=false){
  const type=golden?{name:"GOLDEN FRUIT",color:0xffd34e,leaf:0x8b9b42,radius:.5,points:100}:fruitTypes[Math.floor(Math.random()*fruitTypes.length)],r=type.radius*(.91+Math.random()*.18);
  const mat=new THREE.MeshPhysicalMaterial({color:type.color,roughness:golden?.16:.25,metalness:golden?.28:.02,clearcoat:.9,clearcoatRoughness:.13,emissive:golden?0x9a6500:0,emissiveIntensity:golden?.65:0});
  const mesh=new THREE.Mesh(fruitGeo,mat);mesh.scale.set(r*.94,r,r*.92);mesh.position.set(x,-5.35,.25);mesh.rotation.set(Math.random(),Math.random(),Math.random());
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.16,7),new THREE.MeshStandardMaterial({color:0x63412b}));stem.position.y=r*.9;mesh.add(stem);
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(.12,10,7),new THREE.MeshStandardMaterial({color:type.leaf}));leaf.scale.set(1.4,.25,.7);leaf.position.set(.12,r*.94,0);leaf.rotation.z=-.45;mesh.add(leaf);
  if(golden){const ring=new THREE.Mesh(new THREE.TorusGeometry(r*1.18,.025,8,36),new THREE.MeshBasicMaterial({color:0xffd34e,transparent:true,opacity:.8,blending:THREE.AdditiveBlending}));ring.rotation.x=Math.PI/2;mesh.add(ring)}
  scene.add(mesh);fruits.push({mesh,type:golden?"golden":"fruit",radius:r,points:type.points,waveId,velocity:new THREE.Vector3((Math.random()-.5)*2.1,10.5+Math.random()*1.4+Math.min(1.5,elapsed*.012),(Math.random()-.5)*.2),spin:(Math.random()-.5)*2.8});
 }
 function createBomb(x,waveId){
  const group=new THREE.Group(),body=new THREE.Mesh(new THREE.SphereGeometry(.48,28,20),new THREE.MeshStandardMaterial({color:0x24232a,roughness:.32,metalness:.5}));group.add(body);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.49,.045,8,36),new THREE.MeshStandardMaterial({color:0xff7144,emissive:0x7a1c0c,emissiveIntensity:1.4}));band.rotation.x=Math.PI/2;group.add(band);
  const fuse=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.2,8),new THREE.MeshStandardMaterial({color:0xc6a27c}));fuse.position.set(.08,.48,0);fuse.rotation.z=-.45;group.add(fuse);
  const spark=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshBasicMaterial({color:0xffc45b}));spark.position.set(.13,.59,0);group.add(spark);
  group.position.set(x,-5.35,.3);scene.add(group);fruits.push({mesh:group,type:"bomb",radius:.55,waveId,velocity:new THREE.Vector3((Math.random()-.5)*1.8,10.3+Math.random()*1.3,0),spin:(Math.random()-.5)*2});
 }
 function screenToWorld(x,y){ndc.set(x/innerWidth*2-1,-y/innerHeight*2+1);ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(plane,hitPoint)?hitPoint.clone():null}
 function setPointer(x,y,t=now()){if(state!=="playing")return;const p=screenToWorld(x,y);if(!p)return;
  // Keep the last emitted blade point as the anchor. Tiny landmark jitter is ignored,
  // while small real movements accumulate until they form a visible slice segment.
  if(!lastPointer){lastPointer=p.clone();lastPointerAt=t;return}
  const d=Math.hypot(p.x-lastPointer.x,p.y-lastPointer.y);
  const worldPerPixel=(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(6,camera.position.z-.25))/innerHeight;
  const movementGate=Math.max(.004,worldPerPixel*1.35);
  if(d<movementGate)return;
  const from=lastPointer.clone(),distance=d;
  const steps=Math.min(8,Math.max(1,Math.ceil(distance/.075)));
  for(let i=1;i<=steps;i++){
   const point=from.clone().lerp(p,i/steps);
   trail.push({point,time:t-(steps-i)*2.2});
   if(trail.length>48)trail.shift();
  }
  cutAlong(from,p);
  lastPointer=p.clone();lastPointerAt=t;
 }
 function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l)):0;return Math.hypot(px-ax-t*dx,py-ay-t*dy)}
 function cutAlong(a,b){if(state!=="playing")return;for(let i=fruits.length-1;i>=0;i--){const f=fruits[i],p=f.mesh.position;if(segDist(p.x,p.y,a.x,a.y,b.x,b.y)>f.radius*.92)continue;fruits.splice(i,1);scene.remove(f.mesh);
  if(f.type==="bomb"){burst(p,0xff7548,30);endGame("BOMB SLICED · THE RUN ENDS.");return}
  const color=f.type==="golden"?0xffd34e:f.mesh.material.color.getHex();scoreFruit(f);splitFruit(f,p);burst(p,color,f.type==="golden"?34:20);juiceSplash(p,color);cinematicImpact(f.type==="golden"?1.25:.7);slurp()}}
 function scoreFruit(f){const t=now();combo=t-lastSlice<=1500?combo+1:1;lastSlice=t;bestCombo=Math.max(bestCombo,combo);score+=f.points*mult();const n=(waveHits.get(f.waveId)||0)+1;waveHits.set(f.waveId,n);
  if(n>=2){const bonus=[0,0,10,20,40,60][Math.min(5,n)]||60;score+=bonus;cinematicImpact(Math.min(1.35,.72+n*.12));message(n>=5?"PERFECT WAVE  +"+bonus:"WAVE COMBO  +"+bonus,760)}
  else if(f.type==="golden")message("GOLDEN FRUIT  +100",1000);else if(combo>=2)message("COMBO ×"+mult(),650);updateHud(true)}
 function splitFruit(f,p){const material=new THREE.MeshPhysicalMaterial({color:f.type==="golden"?0xffd34e:f.mesh.material.color.clone(),roughness:.3,clearcoat:.7,side:THREE.DoubleSide});
  for(let s=0;s<2;s++){const geo=new THREE.SphereGeometry(f.radius,24,18,s*Math.PI,Math.PI,0,Math.PI*2),mesh=new THREE.Mesh(geo,material);mesh.position.copy(p);mesh.position.x+=s===0?-.07:.07;mesh.rotation.set(Math.random()*.5,Math.random()*.5,Math.random()*.5);scene.add(mesh);parts.push({mesh,velocity:new THREE.Vector3((s===0?-1:1)*(1.2+Math.random()),1.4+Math.random(),(s===0?-1:1)*.5),spin:(s===0?-1:1)*(2+Math.random()*3),life:.76,max:.76})}}
 function juiceSplash(p,color){const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}),geo=new THREE.SphereGeometry(.05,8,6);
  for(let i=0;i<20;i++){const mesh=new THREE.Mesh(geo,mat);mesh.position.copy(p);const a=Math.random()*Math.PI*2,v=2.2+Math.random()*5.2,vel=new THREE.Vector3(Math.cos(a)*v,Math.sin(a)*v+1.1,(Math.random()-.5)*2.2),life=.38+Math.random()*.34;mesh.scale.setScalar(.7+Math.random()*1.4);scene.add(mesh);particles.push({mesh,velocity:vel,life,max:life})}}
 function slurp(){const t=now();if(t-lastSound<85)return;lastSound=t;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audio)audio=new AC();if(audio.state==="suspended")audio.resume();const c=audio,s=c.currentTime+.005,master=c.createGain();master.gain.setValueAtTime(.0001,s);master.gain.exponentialRampToValueAtTime(.12,s+.025);master.gain.exponentialRampToValueAtTime(.0001,s+.34);master.connect(c.destination);
  const osc=c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain();osc.type="sawtooth";osc.frequency.setValueAtTime(460+Math.random()*90,s);osc.frequency.exponentialRampToValueAtTime(105+Math.random()*25,s+.3);filter.type="lowpass";filter.frequency.setValueAtTime(1250,s);filter.frequency.exponentialRampToValueAtTime(360,s+.3);gain.gain.setValueAtTime(.0001,s);gain.gain.exponentialRampToValueAtTime(.34,s+.035);gain.gain.exponentialRampToValueAtTime(.0001,s+.32);osc.connect(filter).connect(gain).connect(master);osc.start(s);osc.stop(s+.35);
  const n=Math.floor(c.sampleRate*.28),buf=c.createBuffer(1,n,c.sampleRate),data=buf.getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=buf;f.type="bandpass";f.frequency.setValueAtTime(780,s);f.frequency.exponentialRampToValueAtTime(230,s+.27);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.16,s+.025);g.gain.exponentialRampToValueAtTime(.0001,s+.28);src.connect(f).connect(g).connect(master);src.start(s);src.stop(s+.29);master.gain.setValueAtTime(.0001,s+.36)}catch(_){}}
 function burst(p,color,count){const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,blending:THREE.AdditiveBlending,depthWrite:false});for(let i=0;i<count;i++){const mesh=new THREE.Mesh(particleGeo,mat);mesh.position.copy(p);const vel=new THREE.Vector3((Math.random()-.5)*7,Math.random()*6,(Math.random()-.5)*2);scene.add(mesh);particles.push({mesh,velocity:vel,life:.45+Math.random()*.4,max:.85})}}
 function taperedSlashGeometry(points,width,zOffset){
  const curve=points.length>2?new THREE.CatmullRomCurve3(points):new THREE.LineCurve3(points[0],points[points.length-1]);
  const count=Math.max(12,Math.min(72,points.length*5)),sampled=curve.getPoints(count),positions=[],indices=[];
  for(let i=0;i<sampled.length;i++){
   const p=sampled[i],prev=sampled[Math.max(0,i-1)],next=sampled[Math.min(sampled.length-1,i+1)];
   const dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
   const t=i/(sampled.length-1),taper=Math.pow(Math.sin(Math.PI*t),.78),half=width*(.025+.975*taper);
   positions.push(p.x+nx*half,p.y+ny*half,p.z+zOffset,p.x-nx*half,p.y-ny*half,p.z+zOffset);
   if(i<sampled.length-1){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,b,c,b,d,c)}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 function updateBlade(){const t=now();while(trail.length&&t-trail[0].time>165)trail.shift();
  const pts=trail.map(x=>x.point),show=pts.length>1;
  blades.forEach(b=>b.visible=show);if(!show)return;
  const age=Math.max(0,t-trail[trail.length-1].time),fade=Math.max(0,1-age/165);
  const widths=[.19,.095,.034],z=[-.035,-.018,0];
  blades.forEach((blade,i)=>{const old=blade.geometry;blade.geometry=taperedSlashGeometry(pts,widths[i],z[i]);old.dispose()});
  mats[2].opacity=.98*fade;mats[1].opacity=.62*fade;mats[0].opacity=.3*fade;
 }
 function update(dt){if(state==="playing"){elapsed+=dt;spawn-=dt;if(spawn<=0){spawnWave();spawn=Math.max(.68,1.5-elapsed*.006)}
  for(let i=fruits.length-1;i>=0;i--){const f=fruits[i];f.velocity.y-=8.6*dt;f.mesh.position.addScaledVector(f.velocity,dt);f.mesh.rotation.x+=dt*f.spin;f.mesh.rotation.y+=dt*f.spin*.42;if(f.mesh.position.y< -7.8&&f.velocity.y<0){fruits.splice(i,1);scene.remove(f.mesh)}}
  updateBlade();updateHud()}
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;p.velocity.y-=8.2*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=dt*p.spin;p.mesh.rotation.z+=dt*p.spin*.6;p.mesh.scale.setScalar(Math.max(.01,p.life/p.max));if(p.life<=0){scene.remove(p.mesh);parts.splice(i,1)}}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.velocity.y-=5.5*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.scale.setScalar(Math.max(.01,p.life));if(p.mesh.material)p.mesh.material.opacity=Math.max(0,p.life/(p.max||1));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1)}}}
 makeUI();updateHud(true);
 return {start,pause,resume,returnToMenu,update,setPointer,isPlaying:()=>state==="playing",isSessionActive:()=>["playing","paused","gameover"].includes(state),get state(){return state},get score(){return score}};
}