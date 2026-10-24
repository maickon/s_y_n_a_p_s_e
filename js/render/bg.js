import * as THREE from 'three';

const frag = `
uniform float t, seed, glitch, asp; uniform int style; varying vec2 vUv;
vec3 permute(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx),i1=x0.x>x0.y?vec2(1,0):vec2(0,1);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
vec3 p=permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1)),m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-.5,a0=x-floor(x+.5);m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
float h1(float n){return fract(sin(n)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*snoise(p);p*=2.02;a*=.5;}return v*.5+.5;}
void main(){vec2 uv=vUv;
 if(glitch>.01){uv.x+=sin(uv.y*50.+t*20.)*.02*glitch;uv.y+=cos(uv.x*30.+t*10.)*.01*glitch;}
 vec3 c;vec2 q=uv-.5;float vg=1.-dot(q,q)*1.4;
 if(style==0){float n=snoise(uv*3.+vec2(t*.2,seed));c=vec3(sin(n*6.28+t)*.5+.5,cos(uv.x*10.+t)*.3+.2,sin(uv.y*12.-t)*.6+.4);}
 else if(style==1){float k=sin(10.*length(q)-t*3.+atan(q.y,q.x)*2.);c=vec3(k*.8,k*.1,k*.9);}
 else if(style==2){float n=snoise(uv*8.+seed);c=vec3(mod(n*10.+t,1.),mod(n*5.-t,1.),.5);}
 else if(style==3){float g=pow(abs(sin(uv.x*40.))*abs(sin(uv.y*40.)),.2);c=vec3(0,g*.9,g*.5);}
 else if(style==4){float n=fbm(uv*vec2(3.,2.)+vec2(t*.04,seed*.01));c=vec3(.03+n*.32)*vg;}
 else if(style==5){float n=fbm(uv*2.+t*.03+seed*.01),fl=.94+.06*h1(floor(t*24.));c=vec3(.42,.32,.2)*(n+.45)*fl*vg;c+=step(.997,h2(vec2(floor(uv.x*400.),floor(t*24.))))*.25;}
 else if(style==6){c=mix(vec3(.02,.12,.14),vec3(.22,.1,.03),uv.x+.15*sin(t*.1))*.9;for(int i=0;i<14;i++){float fi=float(i);vec2 p=vec2(h1(fi*3.1+seed),fract(h1(fi*7.7)+t*.01*(.5+h1(fi))));float d=length((uv-p)*vec2(asp,1.));c+=mix(vec3(.1,.6,.6),vec3(1.,.55,.2),h1(fi*1.3))*smoothstep(.09,.0,d)*.35;}c*=vg*1.3;}
 else if(style==7){c=mix(vec3(0,.02,.06),vec3(.02,.05,.12),uv.y);for(int i=0;i<3;i++){float fi=float(i),y=.55+.08*fi+.08*sin(uv.x*3.+t*.25+fi*2.)+.06*(fbm(vec2(uv.x*2.+t*.05,fi))-.5);c+=mix(vec3(.1,1.,.5),vec3(.6,.2,1.),fi/2.)*exp(-abs(uv.y-y)*14.)*(.5+.5*fbm(vec2(uv.x*6.,t*.2+fi)))*.6;}c+=step(.9985,h2(floor(uv*vec2(640.,360.))))*.8;}
 else if(style==8){if(uv.y<.42){vec2 g=vec2((uv.x-.5)/(.43-uv.y),1./(.43-uv.y)+t*2.);float l=max(smoothstep(.95,1.,abs(fract(g.x*2.)*2.-1.)),smoothstep(.93,1.,abs(fract(g.y*.5)*2.-1.)));c=mix(vec3(.08,0,.15),vec3(1.,.1,.8),l)*(1.-uv.y*1.5);}else{c=mix(vec3(1.,.35,.2),vec3(.15,0,.3),(uv.y-.42)*2.);float d=length((uv-vec2(.5,.55))*vec2(asp,1.));float sun=smoothstep(.2,.19,d)*step(.5,fract((uv.y-.42)*40.-t*.5)+ (uv.y-.42)*3.);c=mix(c,vec3(1.,.8,.2),sun);}}
 else if(style==9){float n=fbm(uv*2.5+vec2(t*.02,seed*.01)),m=fbm(uv*4.-t*.015);c=vec3(.25,.05,.4)*n*1.4+vec3(.05,.2,.5)*m+vec3(.8,.2,.5)*pow(n*m,3.)*2.;c+=step(.998,h2(floor(uv*vec2(800.,450.))))*(.5+.5*sin(t*3.+h2(floor(uv*800.))*30.));c*=vg;}
 else if(style==10){c=mix(vec3(.9,.91,.93),vec3(.78,.81,.86),uv.y)+(fbm(uv*1.5+t*.02)-.5)*.06;}
 else if(style==11){float col=floor(uv.x*64.),sp=.2+h1(col)*.6,y=fract(uv.y+t*sp*.25+h1(col*3.));float gl=step(.45,h2(vec2(col,floor(uv.y*36.)+floor(t*10.*sp))));c=vec3(.1,1.,.35)*gl*pow(y,5.)*1.4+vec3(0,.04,.01);}
 else{float n=fbm(uv*3.+vec2(t*.05,0.)),k=pow(abs(sin(n*12.+t*.6)),12.);c=mix(vec3(0,.05,.12),vec3(0,.25,.4),uv.y)+vec3(.3,.7,.9)*k*.35;c*=vg;}
 if(glitch>.01)c.r=mix(c.r,c.g,glitch*.5);
 gl_FragColor=vec4(c,1);}`;

export function createBg(w = 1280, h = 720) {
  const canvas = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: true });
  r.setPixelRatio(1.5); r.setSize(w, h, false);
  const u = { t: { value: 0 }, seed: { value: 0 }, glitch: { value: 0 }, style: { value: 0 }, asp: { value: w / h } };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1);}' })));
  return { u, canvas, draw: () => r.render(scene, cam), dispose: () => { r.dispose(); r.forceContextLoss(); } };
}
