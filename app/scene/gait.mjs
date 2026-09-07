const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const smoothstep = t => t*t*(3-2*t);

// Distances in metres. A full cycle contains one step per foot.
export function gaitParameters(speed) {
  const jog = smoothstep(clamp((speed-1.2)/3,0,1));
  return {stride:1.05+jog*.98, stance:.62-jog*.22, lift:.055+jog*.075};
}

export function sampleFoot(phase, {stride,stance,lift}) {
  const p = ((phase%1)+1)%1, amplitude = stride*stance/2;
  if (p < stance) return {z:amplitude-stride*p,y:0,contact:true,swing:0};
  const q = (p-stance)/(1-stance);
  // Hermite endpoints retain -groundSpeed, so touchdown has zero world speed.
  const tangent = -stride*(1-stance);
  return {z:-amplitude+2*amplitude*smoothstep(q)+tangent*(2*q*q*q-3*q*q+q),
    y:lift*Math.sin(Math.PI*q)**2,contact:false,swing:q};
}
