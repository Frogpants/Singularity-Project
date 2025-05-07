
import { mat4, vec3 } from 'https://cdn.skypack.dev/gl-matrix';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

const vertexShaderSource = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0, 1);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

#define MAX_BODIES 16

uniform vec3 u_camera;
uniform vec3 u_sunDir;
uniform float u_fov;
uniform int u_bodyCount;

uniform vec3 u_centers[MAX_BODIES];
uniform float u_radii[MAX_BODIES];
uniform float u_masses[MAX_BODIES];
uniform vec3 u_colors[MAX_BODIES];
uniform float u_emissive[MAX_BODIES];
uniform float u_roughness[MAX_BODIES];
uniform float u_terrainScale[MAX_BODIES];
uniform float u_terrainStrength[MAX_BODIES];
uniform float u_atmoHeight[MAX_BODIES];

in vec2 v_uv;
out vec4 outColor;

vec3 rayDirection(vec2 uv, float fov) {
    float x = (uv.x - 0.5) * 2.0;
    float y = (uv.y - 0.5) * 2.0;
    return normalize(vec3(x * fov, y * fov, 1.0));
}

float hash(float x) {
    return fract(sin(x) * 43758.5453);
}

float noise(vec3 p) {
    return sin(p.x * 3.0) + sin(p.y * 3.3) + sin(p.z * 2.7);
}

vec3 bendRay(vec3 ray, vec3 origin, vec3 center, float mass) {
    vec3 toCenter = normalize(center - origin);
    float dist = length(center - origin);
    float gravity = clamp(mass / (dist * dist + 1.0), 0.0, 0.1);
    return normalize(ray + toCenter * gravity);
}

bool intersectSphere(vec3 ro, vec3 rd, vec3 center, float radius, out float t) {
    vec3 oc = ro - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return false;
    h = sqrt(h);
    t = -b - h;
    if (t < 0.0) t = -b + h;
    return t > 0.0;
}

void main() {
    vec3 ro = u_camera;
    vec3 rd = rayDirection(v_uv, u_fov);

    vec3 color = vec3(0.0);
    float closestT = 1e9;
    int hitIndex = -1;
    vec3 hitPos;

    for (int i = 0; i < MAX_BODIES; i++) {
        if (i >= u_bodyCount) break;

        // Apply gravitational bending
        if (u_masses[i] > 1e32) {
            rd = bendRay(rd, ro, u_centers[i], u_masses[i]);
        }

        float t;
        if (intersectSphere(ro, rd, u_centers[i], u_radii[i], t)) {
            if (t < closestT) {
                closestT = t;
                hitIndex = i;
                hitPos = ro + rd * t;
            }
        }
    }

    if (hitIndex != -1) {
        vec3 center = u_centers[hitIndex];
        float radius = u_radii[hitIndex];
        vec3 normal = normalize(hitPos - center);

        // Apply procedural terrain bump
        if (u_terrainStrength[hitIndex] > 0.0) {
            float elevation = noise(normal * u_terrainScale[hitIndex]);
            normal = normalize(normal * (1.0 + elevation * u_terrainStrength[hitIndex] / radius));
        }

        float diffuse = max(dot(normal, normalize(u_sunDir)), 0.0);
        vec3 baseColor = u_colors[hitIndex];
        vec3 shaded = baseColor * diffuse * (1.0 - u_roughness[hitIndex]);

        // Atmospheric blending
        float altitude = length(hitPos - center) - radius;
        float atmo = clamp(1.0 - altitude / u_atmoHeight[hitIndex], 0.0, 1.0);
        shaded = mix(shaded, vec3(0.5, 0.7, 1.0), atmo);

        // Emissive bodies like suns
        shaded += baseColor * u_emissive[hitIndex];

        color = shaded;
    }

    outColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

function createProgram(gl, vsSrc, fsSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

// Fullscreen
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]), gl.STATIC_DRAW);

const a_position = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(a_position);
gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

// Uniforms

const bodies = [
  {
    center: [0, 0, 0],
    radius: 50,
    mass: 5e24,
    color: [0.2, 0.5, 1.0],
    emissive: 0.0,
    roughness: 0.2,
    terrainScale: 4,
    terrainStrength: 3,
    atmoHeight: 20
  },
  {
    center: [300, 0, 0],
    radius: 80,
    mass: 1e30,
    color: [1.0, 1.0, 0.6],
    emissive: 1.0,
    roughness: 0.0,
    terrainScale: 0,
    terrainStrength: 0,
    atmoHeight: 0
  },
  {
    center: [200, 0, 0],
    radius: 30,
    mass: 1e35,
    color: [0.05, 0.05, 0.1],
    emissive: 0.0,
    roughness: 1.0,
    terrainScale: 0,
    terrainStrength: 0,
    atmoHeight: 0
  }
];

function setUniformArray(name, items, extractor) {
    const flat = items.flatMap(extractor);
    const loc = gl.getUniformLocation(program, name);
    gl['uniform' + flat.length + 'fv'](loc, new Float32Array(flat));
}

// Set uniforms
gl.uniform3fv(gl.getUniformLocation(program, 'u_camera'), [0, 0, -200]);
gl.uniform3fv(gl.getUniformLocation(program, 'u_sunDir'), [1, 0.4, 0.2]);
gl.uniform1f(gl.getUniformLocation(program, 'u_fov'), 1.2);
gl.uniform1i(gl.getUniformLocation(program, 'u_bodyCount'), bodies.length);

setUniformArray('u_centers', bodies, b => b.center);
setUniformArray('u_radii', bodies, b => [b.radius]);
setUniformArray('u_masses', bodies, b => [b.mass]);
setUniformArray('u_colors', bodies, b => b.color);
setUniformArray('u_emissive', bodies, b => [b.emissive]);
setUniformArray('u_roughness', bodies, b => [b.roughness]);
setUniformArray('u_terrainScale', bodies, b => [b.terrainScale]);
setUniformArray('u_terrainStrength', bodies, b => [b.terrainStrength]);
setUniformArray('u_atmoHeight', bodies, b => [b.atmoHeight]);

// Draw
gl.drawArrays(gl.TRIANGLES, 0, 6);
