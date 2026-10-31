(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};

var PATTERNS=['Lưới căn chỉnh','Sọc neon','Plasma','Đường hầm','Sóng cầu vồng','Viền chạy','Mưa số','Dung nham','Vạn hoa','Chuyển màu','Nhịp tròn','Hạt sao','Trắng'];

/* ---------- Shaders ---------- */
var VS=[
'attribute vec2 aUV;',
'uniform vec3 uH0;uniform vec3 uH1;uniform vec3 uH2;',
'varying vec2 vUV;',
'void main(){',
'  vUV=aUV; vec3 v=vec3(aUV,1.0);',
'  gl_Position=vec4(dot(uH0,v),dot(uH1,v),0.0,dot(uH2,v));',
'}'].join('\n');

var FS=[
'#ifdef GL_FRAGMENT_PRECISION_HIGH',
'precision highp float;',
'#else',
'precision mediump float;',
'#endif',
'varying vec2 vUV;',
'uniform float uMode,uTime,uAspect,uHue,uBright,uOpacity,uFeather;',
'uniform vec2 uTexScale,uFlip;',
'uniform sampler2D uTex;',
'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);',
'  float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));',
'  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}',
'vec3 pal(float t){return 0.5+0.5*cos(6.28318*(t+vec3(0.0,0.33,0.67)));}',
'vec3 hueRot(vec3 c,float a){const vec3 k=vec3(0.57735);float ca=cos(a);float sa=sin(a);return c*ca+cross(k,c)*sa+k*dot(k,c)*(1.0-ca);}',
'vec3 pattern(float m,vec2 uv,float t,float asp){',
'  vec2 p=(uv-0.5)*vec2(asp,1.0)*2.0;',
'  if(m<0.5){',
'    vec2 g=vec2(uv.x*asp,uv.y)*8.0;vec2 fr=fract(g);',
'    float d=min(min(fr.x,1.0-fr.x),min(fr.y,1.0-fr.y));',
'    float line=1.0-smoothstep(0.015,0.04,d);',
'    vec3 c=vec3(0.04)+line*vec3(0.55);',
'    float e=min(min(uv.x,1.0-uv.x)*asp,min(uv.y,1.0-uv.y));',
'    c=mix(c,vec3(1.0,0.82,0.1),1.0-smoothstep(0.012,0.022,e));',
'    float cr=1.0-smoothstep(0.003,0.006,min(abs(uv.x-0.5)*asp,abs(uv.y-0.5)));',
'    c=mix(c,vec3(0.2,0.9,1.0),cr);',
'    float rg=1.0-smoothstep(0.004,0.008,abs(length(vec2((uv.x-0.5)*asp,uv.y-0.5))-0.4));',
'    c=mix(c,vec3(1.0,0.2,0.8),rg);',
'    vec2 q=vec2(min(uv.x,1.0-uv.x)*asp,min(uv.y,1.0-uv.y));',
'    if(q.x<0.1&&q.y<0.1){',
'      c=uv.y<0.5?(uv.x<0.5?vec3(1.0,0.2,0.2):vec3(0.2,1.0,0.3)):(uv.x<0.5?vec3(1.0,0.8,0.1):vec3(0.2,0.4,1.0));',
'    }',
'    float sc=1.0-smoothstep(0.0,0.008,abs(uv.x-fract(t*0.2)));',
'    return c+vec3(0.35)*sc;',
'  }',
'  if(m<1.5){float s=fract((uv.x*asp+uv.y)*4.0-t*0.5);float v=smoothstep(0.0,0.08,s)*(1.0-smoothstep(0.45,0.55,s));return vec3(0.02)+v*pal(uv.x*asp*0.25+t*0.08);}',
'  if(m<2.5){float v=sin(p.x*2.2+t)+sin(p.y*2.6+t*1.3)+sin((p.x+p.y)*2.0+t*0.7)+sin(length(p)*3.5-t*1.5);return pal(v*0.18+t*0.04)*0.9+0.05;}',
'  if(m<3.5){float r=length(p)+0.0001;float a=atan(p.y,p.x);float z=1.0/r;float ring=smoothstep(0.0,0.35,sin(z*5.0-t*4.0));float spoke=0.55+0.45*step(0.0,sin(a*8.0+z*0.8));return pal(z*0.08+t*0.07)*ring*spoke*clamp(r*1.4,0.0,1.0);}',
'  if(m<4.5){float w=sin(uv.x*asp*6.0+t*2.0)*0.07+sin(uv.x*asp*11.0-t*1.3)*0.035;float y=uv.y+w;return pal(y*1.3+t*0.1)*(0.55+0.45*sin(y*50.0-t*2.0));}',
'  if(m<5.5){float e=min(min(uv.x,1.0-uv.x)*asp,min(uv.y,1.0-uv.y));float a=atan(p.y,p.x)/6.28318+0.5;float head=pow(1.0-fract(a-t*0.2),4.0);float line=1.0-smoothstep(0.015,0.03,e);float glow=exp(-e*22.0)*0.5;return pal(t*0.08+a)*(line*(0.25+1.1*head)+glow*(0.15+head));}',
'  if(m<6.5){',
'    float cols=18.0*asp;float x=floor(uv.x*cols);',
'    float sp=0.4+hash(vec2(x,1.0))*0.9;float off=hash(vec2(x,7.0));',
'    float y=fract(uv.y-t*sp*0.3-off);',
'    float trail=pow(y,3.0);float head=smoothstep(0.96,1.0,y);',
'    float cy=floor(uv.y*28.0);float fl=step(0.45,hash(vec2(x,cy+floor(t*sp*6.0))));',
'    vec2 cf=fract(vec2(uv.x*cols,uv.y*28.0));',
'    float mk=step(0.12,cf.x)*step(cf.x,0.88)*step(0.15,cf.y)*step(cf.y,0.85);',
'    return (vec3(0.1,1.0,0.45)*trail*(0.35+0.65*fl)+vec3(0.8,1.0,0.9)*head)*mk;',
'  }',
'  if(m<7.5){float n=fbm(vec2(uv.x*asp*2.5,uv.y*2.5)+vec2(0.0,-t*0.35)+fbm(vec2(uv.x*asp,uv.y)*2.0+t*0.15)*1.5);float h=clamp(n*1.7-0.25,0.0,1.0);return vec3(h*1.6,h*h*1.1,h*h*h*0.4);}',
'  if(m<8.5){float r=length(p);float a=atan(p.y,p.x);float seg=6.28318/8.0;a=abs(mod(a,seg)-seg*0.5);vec2 q=vec2(cos(a),sin(a))*r;float v=sin(q.x*7.0+t)*sin(q.y*7.0-t*0.8)+sin(r*9.0-t*2.0);return pal(v*0.15+r*0.25+t*0.05)*smoothstep(-0.4,0.5,v)+0.03;}',
'  if(m<9.5){return mix(pal(t*0.06),pal(t*0.06+0.35),uv.y*0.8+uv.x*0.2);}',
'  if(m<10.5){float r=length(p);float ring=fract(r*1.6-t*0.5);float l=smoothstep(0.0,0.08,ring)*(1.0-smoothstep(0.2,0.4,ring));return pal(r*0.25-t*0.08)*l+0.02;}',
'  if(m<11.5){',
'    vec3 c=vec3(0.0);',
'    for(int k=0;k<2;k++){',
'      float fk=float(k);float sc=12.0+8.0*fk;',
'      vec2 g=vec2(uv.x*asp,uv.y)*sc;g.y+=t*(0.6+0.5*fk);',
'      vec2 id=floor(g);vec2 f=fract(g)-0.5;',
'      float r=hash(id+fk*17.0);',
'      vec2 pos=(vec2(hash(id+3.1),hash(id+7.7))-0.5)*0.6;',
'      float d=length(f-pos);float tw=0.5+0.5*sin(t*2.0+r*6.28318);',
'      c+=pal(r+fk*0.3)*smoothstep(0.14,0.0,d)*tw*step(0.35,r);',
'    }',
'    return c;',
'  }',
'  return vec3(1.0);',
'}',
'void main(){',
'  vec2 uv=vUV;',
'  if(uFlip.x>0.5)uv.x=1.0-uv.x;',
'  if(uFlip.y>0.5)uv.y=1.0-uv.y;',
'  vec3 col;float a=1.0;',
'  if(uMode<-0.5){',
'    vec2 tuv=(uv-0.5)*uTexScale+0.5;',
'    if(tuv.x<0.0||tuv.x>1.0||tuv.y<0.0||tuv.y>1.0)a=0.0;',
'    col=texture2D(uTex,clamp(tuv,0.0,1.0)).rgb;',
'  }else{col=pattern(uMode,uv,uTime,uAspect);}',
'  col=hueRot(col,uHue)*uBright;',
'  float e=min(min(vUV.x,1.0-vUV.x),min(vUV.y,1.0-vUV.y));',
'  if(uFeather>0.001)a*=smoothstep(0.0,uFeather,e);',
'  gl_FragColor=vec4(col,a*uOpacity);',
'}'].join('\n');

var UNIFORMS=['uH0','uH1','uH2','uMode','uTime','uAspect','uHue','uBright','uOpacity','uFeather','uTexScale','uFlip','uTex'];

function makeCtx(canvas,attrs){
  var gl=canvas.getContext('webgl',attrs)||canvas.getContext('experimental-webgl',attrs);
  if(!gl)return null;
  function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}return s}
  var vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);
  if(!vs||!fs)return null;
  var p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(p));return null}
  var u={};UNIFORMS.forEach(function(n){u[n]=gl.getUniformLocation(p,n)});
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(p,'aUV');
  gl.useProgram(p);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.uniform1i(u.uTex,0);
  return {gl:gl,u:u};
}

/* Ma trận chiếu từ hình vuông đơn vị sang tứ giác (TL, TR, BR, BL) trong toạ độ NDC. */
function homography(P){
  var x0=P[0][0],y0=P[0][1],x1=P[1][0],y1=P[1][1],x2=P[2][0],y2=P[2][1],x3=P[3][0],y3=P[3][1];
  var dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  var a,b,c,d,e,f,g,h;
  if(Math.abs(dx3)<1e-9&&Math.abs(dy3)<1e-9){g=0;h=0;a=x1-x0;b=x2-x1;c=x0;d=y1-y0;e=y2-y1;f=y0}
  else{var den=dx1*dy2-dx2*dy1;g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;a=x1-x0+g*x1;b=x3-x0+h*x3;c=x0;d=y1-y0+g*y1;e=y3-y0+h*y3;f=y0}
  return [[a,b,c],[d,e,f],[g,h,1]];
}

function drawQuad(ctx,ndc,o){
  var H=homography(ndc);
  for(var i=0;i<3;i++)for(var j=0;j<3;j++)if(!isFinite(H[i][j]))return;
  var gl=ctx.gl,u=ctx.u;
  gl.uniform3f(u.uH0,H[0][0],H[0][1],H[0][2]);
  gl.uniform3f(u.uH1,H[1][0],H[1][1],H[1][2]);
  gl.uniform3f(u.uH2,H[2][0],H[2][1],H[2][2]);
  gl.uniform1f(u.uMode,o.mode);gl.uniform1f(u.uTime,o.t);gl.uniform1f(u.uAspect,o.asp);
  gl.uniform1f(u.uHue,o.hue);gl.uniform1f(u.uBright,o.bright);gl.uniform1f(u.uOpacity,o.op);gl.uniform1f(u.uFeather,o.feather);
  gl.uniform2f(u.uTexScale,o.tex[0],o.tex[1]);gl.uniform2f(u.uFlip,o.flip[0],o.flip[1]);
  gl.drawArrays(gl.TRIANGLES,0,6);
}

/* ---------- Trạng thái ---------- */
var glc=$('#gl'),ov=$('#ov'),octx=ov.getContext('2d');
var main=makeCtx(glc,{alpha:false,antialias:true,powerPreference:'high-performance'});
if(!main){$('#nogl').style.display='grid';$('#panel').style.display='none';return}
var gl=main.gl;
var ACC=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#ffd23f';
var MONO="'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace";

var KEY='mapping-may-chieu-v2';
var state={surfaces:[],boxes:[],sel:null,selCorner:-1,run:false,black:false,nextId:1,nextBoxId:1};
var media={};var mseq=0;

function rect(x0,y0,x1,y1){return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]}
function newSurface(i){
  var o=(i%6)*0.035;
  return {id:state.nextId++,name:'Khung '+(i+1),pts:rect(0.2+o,0.2+o,0.8+o,0.8+o),src:'p0',rot:0,
    opacity:1,speed:1,hue:0,bright:1,feather:0,flipH:false,flipV:false,fit:'cover',aspect:'auto',visible:true,t:1};
}
/* Hình hộp: 7 điểm dùng chung (đỉnh trên, 4 đỉnh bên, đỉnh dưới, góc giữa) và 3 mặt, mỗi mặt có mẫu riêng. */
var FACE_IDX=[[0,1,6,5],[6,1,2,3],[5,6,3,4]];
var FACE_NAMES=['Mặt trên','Mặt phải','Mặt trái'];
function boxOf(s){if(!s||s.box==null)return null;for(var i=0;i<state.boxes.length;i++)if(state.boxes[i].id===s.box)return state.boxes[i];return null}
function cont(s){var b=boxOf(s);return b?b.pts:s.pts}
function ptsOf(s){var b=boxOf(s);return b?FACE_IDX[s.face].map(function(i){return b.pts[i]}):s.pts}
function renderPts(s){var P=ptsOf(s),r=(((s.rot||0)%4)+4)%4;return r?P.map(function(_,i){return P[(i+r)%4]}):P}
function boxPts(o){
  var w=window.innerWidth||1280,h=window.innerHeight||720,cx=0.5+o,cy=0.5+o,Ry=0.3,Rx=Ry*h/w,k=0.866;
  return [[cx,cy-Ry],[cx+Rx*k,cy-Ry/2],[cx+Rx*k,cy+Ry/2],[cx,cy+Ry],[cx-Rx*k,cy+Ry/2],[cx-Rx*k,cy-Ry/2],[cx,cy]];
}
function newBox(){
  var n=state.boxes.length+1,b={id:state.nextBoxId++,pts:boxPts(((n-1)%5)*0.03)},first=null;
  state.boxes.push(b);
  for(var f=0;f<3;f++){
    var s=newSurface(state.surfaces.length);delete s.pts;
    s.box=b.id;s.face=f;s.name='Hộp '+n+' · '+FACE_NAMES[f];s.aspect='1';
    state.surfaces.push(s);if(!first)first=s;
  }
  return first;
}
function load(){
  try{
    var d=JSON.parse(localStorage.getItem(KEY)||'null');
    if(d&&Array.isArray(d.surfaces)&&d.surfaces.length){
      state.boxes=(d.boxes||[]).filter(function(b){return b&&Array.isArray(b.pts)&&b.pts.length===7});
      state.surfaces=d.surfaces.filter(function(s){
        if(!s)return false;
        if(s.box!=null)return !!FACE_IDX[s.face]&&state.boxes.some(function(b){return b.id===s.box});
        return Array.isArray(s.pts)&&s.pts.length===4;
      }).map(function(s){
        s.t=1;if(typeof s.src!=='string'||s.src.charAt(0)!=='p')s.src='p0';return s});
      state.nextId=Math.max(d.nextId||1,state.surfaces.reduce(function(m,s){return Math.max(m,s.id+1)},1));
      state.nextBoxId=Math.max(d.nextBoxId||1,state.boxes.reduce(function(m,b){return Math.max(m,b.id+1)},1));
      state.sel=state.surfaces.length?(state.surfaces.some(function(s){return s.id===d.sel})?d.sel:state.surfaces[0].id):null;
    }
  }catch(e){}
  if(!state.surfaces.length){state.sel=newBox().id}
}
var saveTimer=0;
function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){
    try{
      var surfaces=state.surfaces.map(function(s){var c={};for(var k in s)c[k]=s[k];if(c.src.charAt(0)!=='p')c.src='p0';if(c.box!=null)delete c.pts;delete c.t;return c});
      localStorage.setItem(KEY,JSON.stringify({surfaces:surfaces,boxes:state.boxes,sel:state.sel,nextId:state.nextId,nextBoxId:state.nextBoxId}));
    }catch(e){}
  },300);
}
function cur(){for(var i=0;i<state.surfaces.length;i++)if(state.surfaces[i].id===state.sel)return state.surfaces[i];return null}
function srcName(id){if(id.charAt(0)==='p')return PATTERNS[+id.slice(1)]||'Mẫu';return media[id]?media[id].name:'Mẫu'}

/* ---------- Toast ---------- */
var toastEl=$('#toast'),toastT=0;
function toast(msg,ms){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){toastEl.classList.remove('show')},ms||2400)}

/* ---------- Kích thước ---------- */
var W=0,H=0,dpr=1;
function resize(){
  var w=window.innerWidth,h=window.innerHeight,d=Math.min(window.devicePixelRatio||1,2);
  if(w===W&&h===H&&d===dpr)return;
  W=w;H=h;dpr=d;
  glc.width=Math.round(W*dpr);glc.height=Math.round(H*dpr);
  ov.width=Math.round(W*dpr);ov.height=Math.round(H*dpr);
  $('#resInfo').textContent=Math.round(W*dpr)+' × '+Math.round(H*dpr);
  syncCorner();
}
window.addEventListener('resize',resize);

/* ---------- Texture cho video / ảnh ---------- */
function makeTex(){
  var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
  return t;
}
function uploadTex(m){
  gl.bindTexture(gl.TEXTURE_2D,m.tex);
  try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,m.el)}catch(e){}
}

/* ---------- Vòng vẽ ---------- */
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function surfAspect(s){
  if(s.aspect&&s.aspect!=='auto'){var v=parseFloat(s.aspect);if(v>0)return v}
  var P=renderPts(s).map(function(p){return [p[0]*W,p[1]*H]});
  var w=(dist(P[0],P[1])+dist(P[3],P[2]))/2,h=(dist(P[0],P[3])+dist(P[1],P[2]))/2;
  return h>1?Math.max(0.1,Math.min(10,w/h)):1;
}
function texScale(s,sa,m){
  var ma=m.w/m.h||1;
  if(s.fit==='stretch')return [1,1];
  if(s.fit==='contain')return sa>ma?[sa/ma,1]:[1,ma/sa];
  return sa>ma?[1,ma/sa]:[sa/ma,1];
}
var last=performance.now();
function frame(now){
  var dt=Math.min(0.1,(now-last)/1000);last=now;
  resize();
  gl.viewport(0,0,glc.width,glc.height);
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(!state.black){
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    var used={};
    state.surfaces.forEach(function(s){if(s.visible&&s.src.charAt(0)==='m'&&media[s.src])used[s.src]=1});
    for(var id in used){
      var m=media[id];
      if(m.kind==='video'){
        if(m.el.readyState>=2&&m.el.currentTime!==m.lastT){m.lastT=m.el.currentTime;uploadTex(m)}
      }
    }
    state.surfaces.forEach(function(s){
      if(!s.visible)return;
      s.t+=dt*s.speed;
      var ndc=renderPts(s).map(function(p){return [p[0]*2-1,1-p[1]*2]});
      var sa=surfAspect(s),o={t:s.t,asp:sa,hue:s.hue*Math.PI/180,bright:s.bright,op:s.opacity,feather:s.feather,
        flip:[s.flipH?1:0,s.flipV?1:0],tex:[1,1],mode:0};
      if(s.src.charAt(0)==='p'){o.mode=+s.src.slice(1)}
      else{
        var m=media[s.src];if(!m)return;
        o.mode=-1;o.tex=texScale(s,sa,m);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.tex);
      }
      drawQuad(main,ndc,o);
    });
  }
  drawOverlay();
  requestAnimationFrame(frame);
}

/* ---------- Lớp chỉnh khung ---------- */
function drawOverlay(){
  octx.setTransform(dpr,0,0,dpr,0,0);octx.clearRect(0,0,W,H);
  if(state.run)return;
  var sel=cur(),selBox=sel&&sel.box!=null?sel.box:null;
  function label(t,x,y,col){
    octx.font='600 11px '+MONO;octx.textAlign='center';octx.textBaseline='middle';
    octx.lineWidth=3;octx.strokeStyle='rgba(0,0,0,.85)';octx.strokeText(t,x,y);octx.fillStyle=col;octx.fillText(t,x,y);
  }
  function handles(P,on){
    P.forEach(function(p,i){
      var x=p[0]*W,y=p[1]*H,sl=on&&i===state.selCorner,sz=sl?15:(on?10:7);
      octx.fillStyle=sl?ACC:'#0b0d11';octx.strokeStyle=on?ACC:'rgba(255,255,255,.7)';octx.lineWidth=1.5;
      octx.fillRect(x-sz/2,y-sz/2,sz,sz);octx.strokeRect(x-sz/2,y-sz/2,sz,sz);
      if(on){
        octx.font='600 10px '+MONO;octx.textAlign='left';octx.textBaseline='bottom';
        octx.lineWidth=3;octx.strokeStyle='rgba(0,0,0,.85)';octx.strokeText(String(i+1),x+10,y-6);
        octx.fillStyle=ACC;octx.fillText(String(i+1),x+10,y-6);
      }
    });
  }
  state.surfaces.forEach(function(s){
    var on=s===sel,inBox=s.box!=null,P=ptsOf(s);
    octx.beginPath();P.forEach(function(p,i){if(i)octx.lineTo(p[0]*W,p[1]*H);else octx.moveTo(p[0]*W,p[1]*H)});octx.closePath();
    if(on&&inBox){octx.fillStyle='rgba(255,210,63,.12)';octx.fill()}
    octx.lineWidth=on?1.5:1;
    octx.strokeStyle=on?ACC:(inBox&&s.box===selBox?'rgba(255,210,63,.55)':'rgba(255,255,255,.5)');
    octx.setLineDash(on||inBox?[]:[5,4]);octx.stroke();octx.setLineDash([]);
    var cx=0,cy=0;P.forEach(function(p){cx+=p[0]*W/4;cy+=p[1]*H/4});
    label(s.name,cx,cy,on?ACC:'rgba(255,255,255,.8)');
    if(on){
      var R=renderPts(s),mx=(R[0][0]+R[1][0])/2*W,my=(R[0][1]+R[1][1])/2*H;
      label('▲ trên',mx+(cx-mx)*0.28,my+(cy-my)*0.28,ACC);
    }
  });
  state.boxes.forEach(function(b){handles(b.pts,b.id===selBox)});
  state.surfaces.forEach(function(s){if(s.box==null)handles(s.pts,s===sel)});
}

/* ---------- Tương tác chuột / cảm ứng ---------- */
function inPoly(x,y,P){
  var c=false;
  for(var i=0,j=3;i<4;j=i++){
    if(((P[i][1]>y)!==(P[j][1]>y))&&(x<(P[j][0]-P[i][0])*(y-P[i][1])/(P[j][1]-P[i][1])+P[i][0]))c=!c;
  }
  return c;
}
function hit(x,y){
  var order=state.surfaces.slice().reverse();
  var s=cur();if(s){order=order.filter(function(q){return q!==s});order.unshift(s)}
  var i,k,q,P,seen={};
  for(i=0;i<order.length;i++){
    q=order[i];
    var key=q.box!=null?'b'+q.box:'s'+q.id;if(seen[key])continue;seen[key]=1;
    var same=!!s&&(q===s||(q.box!=null&&q.box===s.box)),C=cont(q);
    for(k=0;k<C.length;k++){
      if(Math.hypot(C[k][0]*W-x,C[k][1]*H-y)<(same?16:12))return {s:(same?s:q),corner:k};
    }
  }
  for(i=0;i<order.length;i++){
    q=order[i];P=ptsOf(q).map(function(p){return [p[0]*W,p[1]*H]});
    if(inPoly(x,y,P))return {s:q,corner:-1};
  }
  return null;
}
var drag=null;
ov.addEventListener('pointerdown',function(e){
  if(state.run)return;
  var h=hit(e.clientX,e.clientY);
  if(!h){state.selCorner=-1;syncCorner();return}
  select(h.s.id);state.selCorner=h.corner;
  drag=h.corner>=0?{type:'corner',s:h.s,k:h.corner}:{type:'move',s:h.s,x:e.clientX,y:e.clientY,pts:cont(h.s).map(function(p){return p.slice()})};
  try{ov.setPointerCapture(e.pointerId)}catch(_){}
  syncCorner();
});
ov.addEventListener('pointermove',function(e){
  if(state.run)return;
  if(!drag){var h=hit(e.clientX,e.clientY);ov.style.cursor=h?(h.corner>=0?'crosshair':'move'):'default';return}
  var C=cont(drag.s);
  if(drag.type==='corner'){C[drag.k][0]=e.clientX/W;C[drag.k][1]=e.clientY/H}
  else{var dx=(e.clientX-drag.x)/W,dy=(e.clientY-drag.y)/H;drag.pts.forEach(function(p,i){C[i][0]=p[0]+dx;C[i][1]=p[1]+dy})}
  syncCorner();save();
});
function endDrag(){drag=null}
ov.addEventListener('pointerup',endDrag);
ov.addEventListener('pointercancel',endDrag);

/* ---------- Danh sách khung / thuộc tính ---------- */
var slist=$('#slist');
var EYE_ON='<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M1.5 10S5 4.5 10 4.5 18.5 10 18.5 10 15 15.5 10 15.5 1.5 10 1.5 10Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>';
var EYE_OFF='<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M1.5 10S5 4.5 10 4.5 18.5 10 18.5 10 15 15.5 10 15.5 1.5 10 1.5 10Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 17L17 3" stroke="currentColor" stroke-width="1.5"/></svg>';
function renderList(){
  slist.innerHTML=state.surfaces.map(function(s){
    return '<div class="srow'+(s.id===state.sel?' on':'')+'" data-id="'+s.id+'">'+
      '<button class="eye" data-act="vis" type="button" aria-pressed="'+s.visible+'" aria-label="Bật hoặc tắt '+esc(s.name)+'">'+(s.visible?EYE_ON:EYE_OFF)+'</button>'+
      '<button class="sname" data-act="sel" type="button"><span class="n">'+esc(s.name)+'</span><span class="ssrc">'+esc(srcName(s.src))+'</span></button></div>';
  }).join('');
}
slist.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  var row=b.closest('.srow');var id=+row.dataset.id;
  var s=state.surfaces.filter(function(q){return q.id===id})[0];if(!s)return;
  if(b.dataset.act==='vis'){s.visible=!s.visible;renderList();save()}
  else select(id);
});
function select(id){
  if(state.sel!==id){state.sel=id;state.selCorner=-1}
  renderList();syncProps();markTiles();save();
}

var SLIDERS=[
  {k:'bright',label:'Độ sáng',min:0,max:200,k100:100,unit:'%'},
  {k:'opacity',label:'Độ đậm',min:0,max:100,k100:100,unit:'%'},
  {k:'speed',label:'Tốc độ',min:0,max:300,k100:100,unit:'%'},
  {k:'hue',label:'Sắc màu',min:0,max:360,k100:1,unit:'°'},
  {k:'feather',label:'Mờ viền',min:0,max:30,k100:100,unit:'%'}
];
var sliderBox=$('#sliders');
SLIDERS.forEach(function(d){
  var w=document.createElement('div');w.className='sl';
  w.innerHTML='<label for="r_'+d.k+'">'+d.label+'</label><output id="o_'+d.k+'"></output><input type="range" id="r_'+d.k+'" min="'+d.min+'" max="'+d.max+'" step="1">';
  sliderBox.appendChild(w);
  $('#r_'+d.k).addEventListener('input',function(e){
    var s=cur();if(!s)return;
    s[d.k]=(+e.target.value)/d.k100;$('#o_'+d.k).textContent=e.target.value+d.unit;save();
  });
});
var elProps=$('#props'),elNo=$('#noSurf');
function syncProps(){
  var s=cur();
  elProps.hidden=!s;elNo.hidden=!!s;
  if(!s)return;
  $('#pName').value=s.name;
  $('#pSrc').textContent=srcName(s.src);
  SLIDERS.forEach(function(d){var v=Math.round(s[d.k]*d.k100);$('#r_'+d.k).value=v;$('#o_'+d.k).textContent=v+d.unit});
  $('#pFlipH').checked=s.flipH;$('#pFlipV').checked=s.flipV;
  $('#pFit').value=s.fit;$('#pAspect').value=s.aspect;
  $('#pRot').value=String(((s.rot||0)%4+4)%4);$('#boxOnly').hidden=s.box==null;
  syncCorner();
}
function syncCorner(){
  var s=cur(),el=$('#pCorner');if(!s||!el)return;
  var C=cont(s),box=s.box!=null;
  if(state.selCorner<0){el.innerHTML='Chưa chọn '+(box?'điểm':'góc')+'. Bấm vào ô vuông hoặc nhấn <b>1–'+C.length+'</b>.'}
  else{var p=C[state.selCorner];el.innerHTML=(box?'Điểm':'Góc')+' <b>'+(state.selCorner+1)+'</b> · '+Math.round(p[0]*W*dpr)+', '+Math.round(p[1]*H*dpr)+' px'}
}
$('#pName').addEventListener('input',function(e){var s=cur();if(!s)return;s.name=e.target.value||'Khung';renderList();save()});
$('#pFlipH').addEventListener('change',function(e){var s=cur();if(s){s.flipH=e.target.checked;save()}});
$('#pFlipV').addEventListener('change',function(e){var s=cur();if(s){s.flipV=e.target.checked;save()}});
$('#pFit').addEventListener('change',function(e){var s=cur();if(s){s.fit=e.target.value;save()}});
$('#pAspect').addEventListener('change',function(e){var s=cur();if(s){s.aspect=e.target.value;save()}});
$('#pRot').addEventListener('change',function(e){var s=cur();if(s){s.rot=+e.target.value;save()}});
$('#btnBoxSame').addEventListener('click',function(){
  var s=cur();if(!s||s.box==null)return;
  state.surfaces.forEach(function(q){if(q.box===s.box)q.src=s.src});
  renderList();markTiles();save();toast('Cả 3 mặt đang dùng “'+srcName(s.src)+'”.',1800);
});
$('#btnReset').addEventListener('click',function(){
  var s=cur();if(!s)return;
  var b=boxOf(s);
  if(b){boxPts(0).forEach(function(p,i){b.pts[i][0]=p[0];b.pts[i][1]=p[1]})}
  else s.pts=rect(0.2,0.2,0.8,0.8);
  state.selCorner=-1;syncCorner();save();
});
$('#btnAdd').addEventListener('click',function(){var s=newSurface(state.surfaces.length);state.surfaces.push(s);select(s.id)});
$('#btnAddBox').addEventListener('click',function(){var s=newBox();select(s.id);toast('Đã thêm hình hộp. Kéo 7 ô vuông cho khớp vật thể.',2600)});
$('#btnDup').addEventListener('click',function(){
  var s=cur();if(!s)return;
  if(s.box!=null){toast('Hình hộp không nhân đôi được. Bấm “+ Hình hộp” để thêm hộp mới.',2600);return}
  var c=JSON.parse(JSON.stringify(s));c.id=state.nextId++;c.name=s.name+' (bản sao)';c.t=1;
  c.pts=c.pts.map(function(p){return [p[0]+0.03,p[1]+0.03]});
  state.surfaces.push(c);select(c.id);
});
function deleteCurrent(){
  var s=cur();if(!s)return;
  var i=state.surfaces.indexOf(s);
  if(s.box!=null){
    var bid=s.box;
    state.surfaces=state.surfaces.filter(function(q){return q.box!==bid});
    state.boxes=state.boxes.filter(function(b){return b.id!==bid});
    toast('Đã xoá cả hình hộp (3 mặt).',1800);
  }else state.surfaces.splice(i,1);
  var n=state.surfaces[Math.min(i,state.surfaces.length-1)];
  state.sel=n?n.id:null;state.selCorner=-1;renderList();syncProps();markTiles();save();
}
$('#btnDel').addEventListener('click',deleteCurrent);

/* ---------- Thư viện mẫu ---------- */
var tilesP=$('#tilesP'),tilesM=$('#tilesM');
var thumbCanvas=document.createElement('canvas');thumbCanvas.width=320;thumbCanvas.height=180;
var tctx=makeCtx(thumbCanvas,{preserveDrawingBuffer:true,alpha:false});
function patternThumb(i,target){
  var c=target.getContext('2d');
  if(!tctx){c.fillStyle='#1a1d24';c.fillRect(0,0,320,180);return}
  var g=tctx.gl;g.viewport(0,0,320,180);g.disable(g.BLEND);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);
  drawQuad(tctx,[[-1,1],[1,1],[1,-1],[-1,-1]],{mode:i,t:2.2,asp:16/9,hue:0,bright:1,op:1,feather:0,flip:[0,0],tex:[1,1]});
  c.drawImage(thumbCanvas,0,0);
}
PATTERNS.forEach(function(name,i){
  var w=document.createElement('div');w.className='tw';
  w.innerHTML='<button class="tile" type="button" data-src="p'+i+'"><canvas width="320" height="180"></canvas><span>'+esc(name)+'</span></button>';
  tilesP.appendChild(w);
  patternThumb(i,$('canvas',w));
});
function markTiles(){
  var s=cur();
  document.querySelectorAll('.tile[data-src]').forEach(function(t){t.classList.toggle('on',!!s&&t.dataset.src===s.src)});
}
function assign(src){
  var s=cur();
  if(!s){toast('Hãy tạo hoặc chọn một khung trước.');return}
  s.src=src;renderList();syncProps();markTiles();save();
  toast('Đã gán “'+srcName(src)+'” cho '+s.name,1800);
}
document.addEventListener('click',function(e){
  var t=e.target.closest('.tile[data-src]');
  if(t&&$('#panel').contains(t))assign(t.dataset.src);
});
$('#pChange').addEventListener('click',function(){showTab('lib')});
$('#btnRestart').addEventListener('click',function(){
  for(var id in media){if(media[id].kind==='video'){try{media[id].el.currentTime=0;media[id].el.play()}catch(e){}}}
  state.surfaces.forEach(function(s){s.t=1});
  toast('Đã phát lại từ đầu.',1500);
});

/* ---------- Video / ảnh của người dùng ---------- */
var fileIn=$('#file'),host=$('#mediaHost');
$('#btnUpload').addEventListener('click',function(){fileIn.click()});
fileIn.addEventListener('change',function(){addFiles(fileIn.files);fileIn.value=''});
window.addEventListener('dragover',function(e){e.preventDefault()});
window.addEventListener('drop',function(e){e.preventDefault();if(e.dataTransfer&&e.dataTransfer.files.length)addFiles(e.dataTransfer.files)});
function addFiles(list){
  Array.prototype.forEach.call(list,function(f){
    if(/^video\//.test(f.type))addVideo(f);
    else if(/^image\//.test(f.type))addImage(f);
    else toast('Tệp “'+f.name+'” không phải video hoặc ảnh.');
  });
}
function shortName(n){return n.replace(/\.[^.]+$/,'').slice(0,28)}
function addVideo(f){
  var url=URL.createObjectURL(f),v=document.createElement('video');
  v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.src=url;host.appendChild(v);
  v.addEventListener('error',function(){toast('Không đọc được “'+f.name+'”. Thử MP4 (H.264) hoặc WebM.',3500);URL.revokeObjectURL(url);v.remove()},{once:true});
  v.addEventListener('loadeddata',function(){
    var m={id:'m'+(++mseq),name:shortName(f.name),kind:'video',el:v,tex:makeTex(),w:v.videoWidth,h:v.videoHeight,lastT:-1,url:url};
    registerMedia(m);
  },{once:true});
  v.play().catch(function(){});
}
function addImage(f){
  var url=URL.createObjectURL(f),im=new Image();
  im.onload=function(){
    var m={id:'m'+(++mseq),name:shortName(f.name),kind:'image',el:im,tex:makeTex(),w:im.naturalWidth,h:im.naturalHeight,lastT:-1,url:url};
    uploadTex(m);registerMedia(m);
  };
  im.onerror=function(){toast('Không đọc được ảnh “'+f.name+'”.',3000);URL.revokeObjectURL(url)};
  im.src=url;
}
function registerMedia(m){
  media[m.id]=m;
  var w=document.createElement('div');w.className='tw';w.dataset.mid=m.id;
  w.innerHTML='<button class="tile" type="button" data-src="'+m.id+'"><canvas width="320" height="180"></canvas><span>'+esc(m.name)+'</span></button><button class="x" type="button" aria-label="Xoá '+esc(m.name)+'">×</button>';
  tilesM.insertBefore(w,$('#btnUpload'));
  var c=$('canvas',w).getContext('2d');c.fillStyle='#000';c.fillRect(0,0,320,180);
  var ma=m.w/m.h,dw=320,dh=180;if(ma>16/9)dh=320/ma;else dw=180*ma;
  try{c.drawImage(m.el,(320-dw)/2,(180-dh)/2,dw,dh)}catch(e){}
  $('.x',w).addEventListener('click',function(){removeMedia(m.id)});
  assign(m.id);
}
function removeMedia(id){
  var m=media[id];if(!m)return;
  if(m.kind==='video'){try{m.el.pause()}catch(e){}m.el.removeAttribute('src');m.el.remove()}
  URL.revokeObjectURL(m.url);gl.deleteTexture(m.tex);delete media[id];
  var w=tilesM.querySelector('[data-mid="'+id+'"]');if(w)w.remove();
  state.surfaces.forEach(function(s){if(s.src===id)s.src='p0'});
  renderList();syncProps();markTiles();save();
}

/* ---------- Tab ---------- */
function showTab(which){
  var lib=which==='lib';
  $('#paneFrames').hidden=lib;$('#paneLib').hidden=!lib;
  $('#tabFrames').setAttribute('aria-selected',String(!lib));$('#tabLib').setAttribute('aria-selected',String(lib));
}
$('#tabFrames').addEventListener('click',function(){showTab('frames')});
$('#tabLib').addEventListener('click',function(){showTab('lib')});

/* ---------- Ẩn bảng / toàn màn hình / phím tắt ---------- */
function setRun(v){
  state.run=v;document.body.classList.toggle('run',v);
  if(v){var a=document.activeElement;if(a&&a.blur)a.blur();toast('Đang chạy. Nhấn H, Esc hoặc nhấp đúp để hiện bảng.',1600)}
  else toastEl.classList.remove('show');
}
function toggleFS(){
  if(document.fullscreenElement){document.exitFullscreen()}
  else{
    var p=document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
    if(p&&p.catch)p.catch(function(){toast('Trình duyệt chưa cho vào toàn màn hình. Hãy nhấn F11.',3000)});
    else toast('Hãy nhấn F11 để vào toàn màn hình.',3000);
  }
}
$('#btnHide').addEventListener('click',function(){setRun(true)});
$('#btnFS').addEventListener('click',toggleFS);
window.addEventListener('dblclick',function(){if(state.run)setRun(false)});
window.addEventListener('keydown',function(e){
  var tag=(e.target.tagName||'').toLowerCase();
  var typing=tag==='input'&&(e.target.type==='text')||tag==='textarea'||tag==='select';
  if(e.key==='Escape'){
    if(state.run){setRun(false);return}
    if(state.selCorner>=0){state.selCorner=-1;syncCorner()}
    return;
  }
  if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
  var k=e.key.toLowerCase();
  if(k==='h'){setRun(!state.run);e.preventDefault();return}
  if(k==='f'){toggleFS();e.preventDefault();return}
  if(k==='b'){state.black=!state.black;toast(state.black?'Đã tắt hình (đen toàn bộ).':'Đã bật lại hình.',1400);e.preventDefault();return}
  if(state.run)return;
  var s=cur();if(!s)return;
  if(k>='1'&&k<='9'&&+k<=cont(s).length){state.selCorner=+k-1;syncCorner();return}
  if(k==='delete'&&tag!=='input'){deleteCurrent();return}
  var dx=0,dy=0,st=e.shiftKey?10:1;
  if(e.key==='ArrowLeft')dx=-st;else if(e.key==='ArrowRight')dx=st;else if(e.key==='ArrowUp')dy=-st;else if(e.key==='ArrowDown')dy=st;else return;
  if(tag==='input')return;
  e.preventDefault();
  var C=cont(s);
  if(state.selCorner>=0){var p=C[state.selCorner];p[0]+=dx/W;p[1]+=dy/H}
  else C.forEach(function(p){p[0]+=dx/W;p[1]+=dy/H});
  syncCorner();save();
});

/* ---------- Khởi động ---------- */
load();resize();renderList();syncProps();markTiles();
requestAnimationFrame(frame);
})();