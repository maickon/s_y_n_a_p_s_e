import * as THREE from 'three';

const frag = `
uniform float t, seed, glitch; uniform int style; varying vec2 vUv;
vec3 permute(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx),i1=x0.x>x0.y?vec2(1,0):vec2(0,1);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
vec3 p=permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1)),m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-.5,a0=x-floor(x+.5);m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
void main(){vec2 uv=vUv;
 if(glitch>.01){uv.x+=sin(uv.y*50.+t*20.)*.02*glitch;uv.y+=cos(uv.x*30.+t*10.)*.01*glitch;}
 vec3 c;
 if(style==0){float n=snoise(uv*3.+vec2(t*.2,seed));c=vec3(sin(n*6.28+t)*.5+.5,cos(uv.x*10.+t)*.3+.2,sin(uv.y*12.-t)*.6+.4);}
 else if(style==1){vec2 s=uv-.5;float k=sin(10.*length(s)-t*3.+atan(s.y,s.x)*2.);c=vec3(k*.8,k*.1,k*.9);}
 else if(style==2){float n=snoise(uv*8.+seed);c=vec3(mod(n*10.+t,1.),mod(n*5.-t,1.),.5);}
 else{float g=pow(abs(sin(uv.x*40.))*abs(sin(uv.y*40.)),.2);c=vec3(0,g*.9,g*.5);}
 if(glitch>.01)c.r=mix(c.r,c.g,glitch*.5);
 gl_FragColor=vec4(c,1);}`;

export function createBg() {
  const canvas = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: true });
  r.setPixelRatio(1.5); r.setSize(1280, 720, false);
  const u = { t: { value: 0 }, seed: { value: 0 }, glitch: { value: 0 }, style: { value: 0 } };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1);}' })));
  return { u, canvas, draw: () => r.render(scene, cam) };
}
