export interface HeatFieldOptions {
  speed?: number;
  warpStrength?: number;
  pixelRatioCap?: number;
}

const VERTEX_SHADER = `#version 300 es
out vec2 vUv;

void main() {
  vec2 positions[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );

  vec2 position = positions[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;

uniform vec2 uResolution;
uniform float uWarpStrength;
uniform vec2 uOrbit;
uniform vec2 uBlobCenters[6];

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  vec2 curve = local * local * (3.0 - 2.0 * local);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
}

float blob(vec2 point, vec2 center, vec2 radius) {
  vec2 delta = (point - center) / radius;
  float distanceSquared = dot(delta, delta);
  float denominator = 1.0 + 1.65 * distanceSquared;
  float softCutoff = 1.0 - smoothstep(2.25, 4.0, distanceSquared);
  return softCutoff / (denominator * denominator);
}

vec3 heatPalette(float value) {
  vec3 red = vec3(1.0, 0.025, 0.0);
  vec3 vermilion = vec3(1.0, 0.16, 0.0);
  vec3 orange = vec3(1.0, 0.43, 0.0);
  vec3 yellow = vec3(1.0, 0.73, 0.015);

  vec3 lowRange = mix(red, vermilion, smoothstep(0.03, 0.34, value));
  vec3 highRange = mix(orange, yellow, smoothstep(0.62, 0.98, value));
  return mix(lowRange, highRange, smoothstep(0.28, 0.72, value));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 point = vUv * 2.0 - 1.0;
  point.x *= aspect;

  // One low-frequency field replaces three multi-octave noise passes.
  float warpNoise = valueNoise(point * 0.68 + uOrbit * 0.46);
  float centeredWarp = warpNoise - 0.5;
  vec2 warpDirection = vec2(
    0.78 + 0.22 * point.y,
    -0.63 + 0.18 * point.x
  );
  vec2 warpedPoint =
    point + warpDirection * centeredWarp * uWarpStrength * 1.35;

  // Start with a golden top and red-orange lower half.
  float field = 0.12 + vUv.y * 0.68;

  // Broad yellow pools keep the upper edge and outer frame luminous.
  field += 0.28 * blob(
    warpedPoint,
    uBlobCenters[0],
    vec2(0.72, 0.54)
  );
  field += 0.24 * blob(
    warpedPoint,
    uBlobCenters[1],
    vec2(0.70, 0.62)
  );
  field += 0.10 * smoothstep(aspect * 0.22, aspect * 0.94, abs(point.x));

  // Moving red pools produce the soft hot zones visible in the reference.
  field -= 0.54 * blob(
    warpedPoint,
    uBlobCenters[2],
    vec2(1.18, 0.68)
  );
  field -= 0.30 * blob(
    warpedPoint,
    uBlobCenters[3],
    vec2(0.42, 0.92)
  );
  field -= 0.26 * blob(
    warpedPoint,
    uBlobCenters[4],
    vec2(0.46, 0.88)
  );
  field -= 0.18 * blob(
    warpedPoint,
    uBlobCenters[5],
    vec2(0.76, 0.54)
  );

  // Keep the motion organic but deliberately broad—never smoky or grainy.
  field += centeredWarp * 0.065;
  field = clamp(field, 0.0, 1.0);

  vec3 color = heatPalette(field);

  // Static interleaved-gradient dithering prevents banding without shimmer.
  float dither = fract(
    52.9829189 *
    fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))
  ) - 0.5;
  color += dither / 255.0;

  outColor = vec4(color, 1.0);
}
`;

const DEFAULT_OPTIONS: Required<HeatFieldOptions> = {
  speed: 1,
  warpStrength: 0.34,
  pixelRatioCap: 1,
};

export class HeatFieldBackground {
  private readonly canvas: HTMLCanvasElement;
  private readonly options: Required<HeatFieldOptions>;
  private readonly motionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexArray: WebGLVertexArrayObject | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private warpLocation: WebGLUniformLocation | null = null;
  private orbitLocation: WebGLUniformLocation | null = null;
  private blobCentersLocation: WebGLUniformLocation | null = null;
  private readonly blobCenters = new Float32Array(12);

  private resizeObserver: ResizeObserver | null = null;
  private animationFrame = 0;
  private startedAt = performance.now();
  private elapsedBeforePause = 0;
  private destroyed = false;
  private contextLost = false;

  constructor(canvas: HTMLCanvasElement, options: HeatFieldOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.motionQuery.addEventListener("change", this.handleMotionChange);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.canvas);

    this.initialize();
  }

  start(): void {
    if (
      this.destroyed ||
      this.contextLost ||
      !this.gl ||
      !this.program
    ) {
      return;
    }

    this.stopAnimationFrame();
    this.resize();

    if (this.motionQuery.matches) {
      this.render(7.4);
      return;
    }

    if (document.visibilityState === "visible") {
      this.startedAt = performance.now() - this.elapsedBeforePause * 1000;
      this.animationFrame = requestAnimationFrame(this.tick);
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.stopAnimationFrame();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.canvas.removeEventListener(
      "webglcontextlost",
      this.handleContextLost,
    );
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.motionQuery.removeEventListener("change", this.handleMotionChange);

    this.releaseResources();
    this.gl = null;
  }

  private initialize(): void {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      this.enableFallback("WebGL2 is not available.");
      return;
    }

    try {
      const vertexShader = this.compileShader(
        gl,
        gl.VERTEX_SHADER,
        VERTEX_SHADER,
      );
      const fragmentShader = this.compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        FRAGMENT_SHADER,
      );
      const program = gl.createProgram();

      if (!program) {
        throw new Error("Unable to create the WebGL program.");
      }

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) ?? "Unknown link error.";
        gl.deleteProgram(program);
        throw new Error(`Unable to link the heat-field shader: ${message}`);
      }

      const vertexArray = gl.createVertexArray();

      if (!vertexArray) {
        gl.deleteProgram(program);
        throw new Error("Unable to create the WebGL vertex array.");
      }

      this.gl = gl;
      this.program = program;
      this.vertexArray = vertexArray;
      this.resolutionLocation = gl.getUniformLocation(program, "uResolution");
      this.warpLocation = gl.getUniformLocation(program, "uWarpStrength");
      this.orbitLocation = gl.getUniformLocation(program, "uOrbit");
      this.blobCentersLocation = gl.getUniformLocation(
        program,
        "uBlobCenters[0]",
      );

      this.canvas.classList.remove("heat-field--fallback");
    } catch (error) {
      this.releaseResources();
      this.enableFallback(
        error instanceof Error ? error.message : "Shader initialization failed.",
      );
    }
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
  ): WebGLShader {
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error("Unable to create a WebGL shader.");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? "Unknown compile error.";
      gl.deleteShader(shader);
      throw new Error(`Unable to compile the heat-field shader: ${message}`);
    }

    return shader;
  }

  private readonly resize = (): void => {
    const gl = this.gl;

    if (!gl || this.contextLost || this.destroyed) {
      return;
    }

    const bounds = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.options.pixelRatioCap,
    );
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
      this.render(this.currentTime());
    }
  };

  private readonly tick = (timestamp: number): void => {
    this.animationFrame = 0;

    if (
      this.destroyed ||
      this.contextLost ||
      this.motionQuery.matches ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const elapsed = (timestamp - this.startedAt) / 1000;
    this.elapsedBeforePause = elapsed;
    this.render(elapsed * this.options.speed);
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private render(time: number): void {
    const gl = this.gl;

    if (
      !gl ||
      !this.program ||
      !this.vertexArray ||
      this.contextLost ||
      this.destroyed
    ) {
      return;
    }

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);

    const phase = (time * Math.PI * 2) / 28;
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    const orbitX = Math.cos(phase);
    const orbitY = Math.sin(phase);
    const centers = this.blobCenters;

    centers[0] = -aspect * 0.44 + 0.12 * Math.sin(phase * 1.2);
    centers[1] = 0.76;
    centers[2] = aspect * 0.46 + 0.1 * Math.cos(phase * 0.9);
    centers[3] = 0.68;
    centers[4] = 0.1 * Math.sin(phase * 0.84);
    centers[5] = -0.76 + 0.08 * Math.cos(phase);
    centers[6] = -aspect * 0.5 + 0.12 * Math.cos(phase * 1.14);
    centers[7] = 0.02;
    centers[8] = aspect * 0.52 + 0.1 * Math.sin(phase * 1.06);
    centers[9] = -0.05;
    centers[10] = 0.18 * Math.cos(phase * 0.72);
    centers[11] = 0.2 + 0.12 * Math.sin(phase * 0.91);

    gl.uniform2f(this.orbitLocation, orbitX, orbitY);
    gl.uniform2fv(this.blobCentersLocation, centers);
    gl.uniform2f(
      this.resolutionLocation,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f(this.warpLocation, this.options.warpStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private currentTime(): number {
    if (this.motionQuery.matches) {
      return 7.4;
    }

    return (
      ((performance.now() - this.startedAt) / 1000) *
      this.options.speed
    );
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.elapsedBeforePause = Math.max(
        0,
        (performance.now() - this.startedAt) / 1000,
      );
      this.stopAnimationFrame();
      return;
    }

    this.start();
  };

  private readonly handleMotionChange = (): void => {
    this.start();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.stopAnimationFrame();
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.program = null;
    this.vertexArray = null;
    this.resolutionLocation = null;
    this.warpLocation = null;
    this.orbitLocation = null;
    this.blobCentersLocation = null;
    this.initialize();
    this.start();
  };

  private stopAnimationFrame(): void {
    if (this.animationFrame !== 0) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private releaseResources(): void {
    if (this.gl && !this.contextLost) {
      if (this.vertexArray) {
        this.gl.deleteVertexArray(this.vertexArray);
      }

      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
    }

    this.program = null;
    this.vertexArray = null;
    this.resolutionLocation = null;
    this.warpLocation = null;
    this.orbitLocation = null;
    this.blobCentersLocation = null;
  }

  private enableFallback(message: string): void {
    this.canvas.classList.add("heat-field--fallback");
    console.warn(`[HeatFieldBackground] ${message}`);
  }
}
