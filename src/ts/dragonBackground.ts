/* ================================================================
   DRACARYS AI — dragonBackground.ts
   Interactive 3D WebGL Dragon & Cinematic Video Background Engine
   ================================================================ */

import { AssistantState } from "./types";

declare const THREE: any;

export type DragonDisplayMode = "3d_interactive" | "cinematic_video";

export interface DragonThemeColors {
    scaleColor: number;
    membraneColor: number;
    hornColor: number;
    eyeColor: number;
    fireColor: number;
    lightColor: number;
}

const THEME_PALETTES: Record<string, DragonThemeColors> = {
    cyan: {
        scaleColor: 0x05182e,
        membraneColor: 0x00d4ff,
        hornColor: 0x38bdf8,
        eyeColor: 0x00ffff,
        fireColor: 0x00f0ff,
        lightColor: 0x00d4ff
    },
    blue: {
        scaleColor: 0x06193d,
        membraneColor: 0x2979ff,
        hornColor: 0x5393ff,
        eyeColor: 0x82b1ff,
        fireColor: 0x3d84ff,
        lightColor: 0x2979ff
    },
    fire: {
        scaleColor: 0x240902,
        membraneColor: 0xff4500,
        hornColor: 0xff8c00,
        eyeColor: 0xffd700,
        fireColor: 0xff3b00,
        lightColor: 0xff5500
    },
    purple: {
        scaleColor: 0x1f0733,
        membraneColor: 0xb000ff,
        hornColor: 0xe040fb,
        eyeColor: 0xd187f5,
        fireColor: 0xd800ff,
        lightColor: 0xb000ff
    },
    emerald: {
        scaleColor: 0x032111,
        membraneColor: 0x00ff88,
        hornColor: 0x00cc66,
        eyeColor: 0x66ffaa,
        fireColor: 0x00ffaa,
        lightColor: 0x00ff88
    },
    amber: {
        scaleColor: 0x261702,
        membraneColor: 0xffb703,
        hornColor: 0xffc83b,
        eyeColor: 0xffd875,
        fireColor: 0xffaa00,
        lightColor: 0xffb703
    },
    crimson: {
        scaleColor: 0x280511,
        membraneColor: 0xff3366,
        hornColor: 0xff6688,
        eyeColor: 0xff99aa,
        fireColor: 0xff1744,
        lightColor: 0xff3366
    },
    stealth: {
        scaleColor: 0x14161a,
        membraneColor: 0x8b949e,
        hornColor: 0xc9d1d9,
        eyeColor: 0x58a6ff,
        fireColor: 0x79c0ff,
        lightColor: 0x8b949e
    }
};

export class DragonBackground {
    private canvas: HTMLCanvasElement;
    private videoElement: HTMLVideoElement | null = null;
    private renderer: any = null;
    private scene: any = null;
    private camera: any = null;

    // Rig hierarchies
    private dragonGroup: any = null;
    private bodySegments: any[] = [];
    private neckSegments: any[] = [];
    private headGroup: any = null;
    private jawMesh: any = null;
    private leftWingGroup: any = null;
    private rightWingGroup: any = null;
    private leftWingBones: any[] = [];
    private rightWingBones: any[] = [];
    private leftWingMembrane: any = null;
    private rightWingMembrane: any = null;
    private tailSegments: any[] = [];
    private eyeLights: any[] = [];
    private coreLight: any = null;

    // Materials
    private scaleMaterial: any = null;
    private membraneMaterial: any = null;
    private hornMaterial: any = null;
    private eyeMaterial: any = null;

    // Particle Systems
    private fireParticles: any = null;
    private fireGeometry: any = null;
    private firePositions: Float32Array = new Float32Array();
    private fireVelocities: Float32Array = new Float32Array();
    private fireLifetimes: Float32Array = new Float32Array();
    private fireMaxParticles = 600;
    private fireActive = false;
    private fireTimer = 0;

    // Ambient floating embers
    private emberParticles: any = null;
    private emberGeometry: any = null;
    private emberPositions: Float32Array = new Float32Array();
    private emberCount = 180;

    // Interaction & Animation state
    private mouseX = 0;
    private mouseY = 0;
    private targetRotX = 0;
    private targetRotY = 0;
    private currentRotX = 0;
    private currentRotY = 0;
    private clock: any = null;
    private isRunning = true;
    private currentState: AssistantState = AssistantState.IDLE;
    private currentTheme = "cyan";
    private displayMode: DragonDisplayMode = "3d_interactive";
    private isVisible = true;
    private videoStream: MediaStream | null = null;

    constructor(canvasId = "dragon3DCanvas", videoId = "dragonVideoPlayer") {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.videoElement = document.getElementById(videoId) as HTMLVideoElement;

        if (!this.canvas) {
            console.warn("DragonBackground: canvas element not found with ID", canvasId);
            return;
        }

        if (typeof THREE === "undefined") {
            console.warn("Three.js not loaded. Waiting or skipping 3D dragon background.");
            return;
        }

        this.initThree();
        this.buildDragonRig();
        this.buildFireParticleSystem();
        this.buildAmbientEmbers();
        this.bindEvents();
        this.setupVideoMirroring();
        this.animate();
    }

    private initThree(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
        this.camera.position.set(0, 0.5, 9.5);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        this.clock = new THREE.Clock();

        // Atmospheric lighting
        const ambientLight = new THREE.AmbientLight(0x041126, 1.8);
        this.scene.add(ambientLight);

        const rimLight = new THREE.DirectionalLight(0x00d4ff, 2.5);
        rimLight.position.set(0, 8, 4);
        this.scene.add(rimLight);

        const fillLight = new THREE.DirectionalLight(0x004488, 1.2);
        fillLight.position.set(-6, -4, 3);
        this.scene.add(fillLight);

        // Dragon Core internal breathing light
        this.coreLight = new THREE.PointLight(0x00d4ff, 2.0, 10);
        this.coreLight.position.set(0, 0, 0);
        this.scene.add(this.coreLight);
    }

    private getColors(): DragonThemeColors {
        return THEME_PALETTES[this.currentTheme] || THEME_PALETTES.cyan;
    }

    private buildDragonRig(): void {
        const colors = this.getColors();

        this.scaleMaterial = new THREE.MeshStandardMaterial({
            color: colors.scaleColor,
            roughness: 0.35,
            metalness: 0.85,
            flatShading: true
        });

        this.membraneMaterial = new THREE.MeshStandardMaterial({
            color: colors.membraneColor,
            emissive: colors.membraneColor,
            emissiveIntensity: 0.35,
            roughness: 0.45,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82
        });

        this.hornMaterial = new THREE.MeshStandardMaterial({
            color: colors.hornColor,
            emissive: colors.hornColor,
            emissiveIntensity: 0.75,
            roughness: 0.15,
            metalness: 0.5
        });

        this.eyeMaterial = new THREE.MeshBasicMaterial({
            color: colors.eyeColor
        });

        this.dragonGroup = new THREE.Group();
        // Position behind the center orb so it beautifully frames it
        this.dragonGroup.position.set(0, 0.4, -1.0);
        this.scene.add(this.dragonGroup);

        // 1. Torso Spine (5 interlocking organic segments)
        let parentSegment = this.dragonGroup;
        const segmentCount = 6;
        for (let i = 0; i < segmentCount; i++) {
            const seg = new THREE.Group();
            const radius = 0.55 - (i * 0.05);
            const geom = new THREE.DodecahedronGeometry(radius, 1);
            const mesh = new THREE.Mesh(geom, this.scaleMaterial);
            mesh.scale.set(1.2, 0.9, 1.4);
            seg.add(mesh);

            // Dorsal Spines on back
            const spikeGeom = new THREE.ConeGeometry(radius * 0.35, radius * 1.5, 4);
            const spikeMesh = new THREE.Mesh(spikeGeom, this.hornMaterial);
            spikeMesh.position.set(0, radius * 0.9, 0);
            spikeMesh.rotation.x = -Math.PI / 8;
            seg.add(spikeMesh);

            seg.position.z = -i * 0.7;
            parentSegment.add(seg);
            this.bodySegments.push(seg);
            parentSegment = seg;
        }

        // 2. Neck & Articulated Dragon Head
        let neckParent = this.dragonGroup;
        const neckCount = 4;
        for (let i = 0; i < neckCount; i++) {
            const neck = new THREE.Group();
            const nRadius = 0.45 - (i * 0.04);
            const nGeom = new THREE.DodecahedronGeometry(nRadius, 1);
            const nMesh = new THREE.Mesh(nGeom, this.scaleMaterial);
            nMesh.scale.set(0.9, 1.0, 1.1);
            neck.add(nMesh);

            neck.position.set(0, 0.28, 0.55);
            neckParent.add(neck);
            this.neckSegments.push(neck);
            neckParent = neck;
        }

        // Head Group
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.35, 0.65);
        neckParent.add(this.headGroup);

        // Skull Main
        const skullGeom = new THREE.ConeGeometry(0.42, 1.1, 6);
        const skullMesh = new THREE.Mesh(skullGeom, this.scaleMaterial);
        skullMesh.rotation.x = Math.PI / 2;
        skullMesh.scale.set(1.1, 1.0, 0.85);
        this.headGroup.add(skullMesh);

        // Snout
        const snoutGeom = new THREE.BoxGeometry(0.38, 0.28, 0.7);
        const snoutMesh = new THREE.Mesh(snoutGeom, this.scaleMaterial);
        snoutMesh.position.set(0, -0.05, 0.6);
        this.headGroup.add(snoutMesh);

        // Articulated Lower Jaw (Pivots open for roars & Dracarys fire)
        const jawGroup = new THREE.Group();
        jawGroup.position.set(0, -0.22, 0.2);
        const jawGeom = new THREE.BoxGeometry(0.32, 0.16, 0.65);
        const jawInner = new THREE.Mesh(jawGeom, this.scaleMaterial);
        jawInner.position.set(0, 0, 0.3);
        jawGroup.add(jawInner);
        this.headGroup.add(jawGroup);
        this.jawMesh = jawGroup;

        // Curved Horns (Left & Right)
        const hornGeom = new THREE.ConeGeometry(0.12, 1.2, 5);
        const leftHorn = new THREE.Mesh(hornGeom, this.hornMaterial);
        leftHorn.position.set(0.28, 0.42, -0.2);
        leftHorn.rotation.set(-Math.PI / 4, 0, -Math.PI / 6);
        this.headGroup.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeom, this.hornMaterial);
        rightHorn.position.set(-0.28, 0.42, -0.2);
        rightHorn.rotation.set(-Math.PI / 4, 0, Math.PI / 6);
        this.headGroup.add(rightHorn);

        // Secondary Brow Horns
        const browGeom = new THREE.ConeGeometry(0.08, 0.6, 4);
        const leftBrow = new THREE.Mesh(browGeom, this.hornMaterial);
        leftBrow.position.set(0.22, 0.22, 0.2);
        leftBrow.rotation.set(-Math.PI / 5, 0, -Math.PI / 4);
        this.headGroup.add(leftBrow);

        const rightBrow = new THREE.Mesh(browGeom, this.hornMaterial);
        rightBrow.position.set(-0.22, 0.22, 0.2);
        rightBrow.rotation.set(-Math.PI / 5, 0, Math.PI / 4);
        this.headGroup.add(rightBrow);

        // Glowing Eyes
        const eyeGeom = new THREE.SphereGeometry(0.09, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeom, this.eyeMaterial);
        leftEye.position.set(0.24, 0.12, 0.45);
        leftEye.scale.set(0.6, 1.3, 0.8);
        this.headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeom, this.eyeMaterial);
        rightEye.position.set(-0.24, 0.12, 0.45);
        rightEye.scale.set(0.6, 1.3, 0.8);
        this.headGroup.add(rightEye);

        const leftEyeLight = new THREE.PointLight(colors.eyeColor, 1.2, 3);
        leftEyeLight.position.copy(leftEye.position);
        this.headGroup.add(leftEyeLight);
        this.eyeLights.push(leftEyeLight);

        const rightEyeLight = new THREE.PointLight(colors.eyeColor, 1.2, 3);
        rightEyeLight.position.copy(rightEye.position);
        this.headGroup.add(rightEyeLight);
        this.eyeLights.push(rightEyeLight);

        // 3. Huge Articulated Dragon Wings
        this.buildWings();

        // 4. Sweeping Serpentine Tail (9 trailing segments)
        let tailParent = this.bodySegments[this.bodySegments.length - 1];
        const tailCount = 9;
        for (let i = 0; i < tailCount; i++) {
            const tailSeg = new THREE.Group();
            const tRadius = 0.35 * Math.pow(0.82, i);
            const tGeom = new THREE.DodecahedronGeometry(tRadius, 0);
            const tMesh = new THREE.Mesh(tGeom, this.scaleMaterial);
            tMesh.scale.set(0.85, 0.85, 1.8);
            tailSeg.add(tMesh);

            // Tail Spikes
            const tSpike = new THREE.Mesh(new THREE.ConeGeometry(tRadius * 0.4, tRadius * 1.6, 4), this.hornMaterial);
            tSpike.position.set(0, tRadius * 0.8, 0);
            tSpike.rotation.x = -Math.PI / 4;
            tailSeg.add(tSpike);

            tailSeg.position.set(0, -0.06, -0.6);
            tailParent.add(tailSeg);
            this.tailSegments.push(tailSeg);
            tailParent = tailSeg;
        }

        // Tail Blade at tip
        const tailBladeGeom = new THREE.ConeGeometry(0.18, 0.9, 4);
        const tailBlade = new THREE.Mesh(tailBladeGeom, this.hornMaterial);
        tailBlade.rotation.x = Math.PI / 2;
        tailBlade.scale.set(0.2, 1.0, 1.0);
        tailBlade.position.set(0, 0, -0.5);
        tailParent.add(tailBlade);
    }

    private buildWings(): void {
        // Left Wing Hierarchy
        this.leftWingGroup = new THREE.Group();
        this.leftWingGroup.position.set(0.65, 0.3, 0.1);
        this.dragonGroup.add(this.leftWingGroup);

        const leftHumerus = new THREE.Group();
        const boneGeom1 = new THREE.CylinderGeometry(0.12, 0.08, 1.8, 6);
        const b1Mesh = new THREE.Mesh(boneGeom1, this.scaleMaterial);
        b1Mesh.position.set(0.8, 0.4, 0);
        b1Mesh.rotation.z = -Math.PI / 3;
        leftHumerus.add(b1Mesh);
        this.leftWingGroup.add(leftHumerus);

        const leftForearm = new THREE.Group();
        leftForearm.position.set(1.5, 0.8, 0);
        const boneGeom2 = new THREE.CylinderGeometry(0.08, 0.05, 2.2, 5);
        const b2Mesh = new THREE.Mesh(boneGeom2, this.scaleMaterial);
        b2Mesh.position.set(1.0, 0.2, 0);
        b2Mesh.rotation.z = -Math.PI / 6;
        leftForearm.add(b2Mesh);
        leftHumerus.add(leftForearm);
        this.leftWingBones = [leftHumerus, leftForearm];

        // Left Wing Membrane Mesh
        const leftMembraneGeom = new THREE.BufferGeometry();
        const leftVerts = new Float32Array([
            0, 0, 0,
            1.5, 0.8, 0,
            2.6, 1.1, 0,
            3.4, 0.2, -0.4,
            2.5, -0.8, -0.6,
            1.2, -0.9, -0.4,
            0, -0.5, -0.2
        ]);
        const leftIndices = [
            0, 1, 6,
            1, 2, 5,
            2, 3, 4,
            1, 5, 6,
            2, 4, 5
        ];
        leftMembraneGeom.setAttribute("position", new THREE.BufferAttribute(leftVerts, 3));
        leftMembraneGeom.setIndex(leftIndices);
        leftMembraneGeom.computeVertexNormals();

        this.leftWingMembrane = new THREE.Mesh(leftMembraneGeom, this.membraneMaterial);
        this.leftWingGroup.add(this.leftWingMembrane);

        // Right Wing Hierarchy (Mirrored)
        this.rightWingGroup = new THREE.Group();
        this.rightWingGroup.position.set(-0.65, 0.3, 0.1);
        this.dragonGroup.add(this.rightWingGroup);

        const rightHumerus = new THREE.Group();
        const rb1Mesh = new THREE.Mesh(boneGeom1, this.scaleMaterial);
        rb1Mesh.position.set(-0.8, 0.4, 0);
        rb1Mesh.rotation.z = Math.PI / 3;
        rightHumerus.add(rb1Mesh);
        this.rightWingGroup.add(rightHumerus);

        const rightForearm = new THREE.Group();
        rightForearm.position.set(-1.5, 0.8, 0);
        const rb2Mesh = new THREE.Mesh(boneGeom2, this.scaleMaterial);
        rb2Mesh.position.set(-1.0, 0.2, 0);
        rb2Mesh.rotation.z = Math.PI / 6;
        rightForearm.add(rb2Mesh);
        rightHumerus.add(rightForearm);
        this.rightWingBones = [rightHumerus, rightForearm];

        // Right Wing Membrane
        const rightMembraneGeom = new THREE.BufferGeometry();
        const rightVerts = new Float32Array([
            0, 0, 0,
            -1.5, 0.8, 0,
            -2.6, 1.1, 0,
            -3.4, 0.2, -0.4,
            -2.5, -0.8, -0.6,
            -1.2, -0.9, -0.4,
            0, -0.5, -0.2
        ]);
        const rightIndices = [
            0, 6, 1,
            1, 5, 2,
            2, 4, 3,
            1, 6, 5,
            2, 5, 4
        ];
        rightMembraneGeom.setAttribute("position", new THREE.BufferAttribute(rightVerts, 3));
        rightMembraneGeom.setIndex(rightIndices);
        rightMembraneGeom.computeVertexNormals();

        this.rightWingMembrane = new THREE.Mesh(rightMembraneGeom, this.membraneMaterial);
        this.rightWingGroup.add(this.rightWingMembrane);
    }

    private buildFireParticleSystem(): void {
        const colors = this.getColors();
        this.fireGeometry = new THREE.BufferGeometry();
        this.firePositions = new Float32Array(this.fireMaxParticles * 3);
        this.fireVelocities = new Float32Array(this.fireMaxParticles * 3);
        this.fireLifetimes = new Float32Array(this.fireMaxParticles);

        for (let i = 0; i < this.fireMaxParticles; i++) {
            this.firePositions[i * 3 + 1] = -999; // hide initially
            this.fireLifetimes[i] = 0;
        }

        this.fireGeometry.setAttribute("position", new THREE.BufferAttribute(this.firePositions, 3));

        // Create glowing radial circle texture programmatically
        const pCanvas = document.createElement("canvas");
        pCanvas.width = 64;
        pCanvas.height = 64;
        const pCtx = pCanvas.getContext("2d");
        if (pCtx) {
            const radGrad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
            radGrad.addColorStop(0, "rgba(255,255,255,1)");
            radGrad.addColorStop(0.3, "rgba(0,240,255,0.9)");
            radGrad.addColorStop(0.7, "rgba(0,100,255,0.3)");
            radGrad.addColorStop(1, "rgba(0,0,0,0)");
            pCtx.fillStyle = radGrad;
            pCtx.fillRect(0, 0, 64, 64);
        }
        const pTexture = new THREE.CanvasTexture(pCanvas);

        const fireMat = new THREE.PointsMaterial({
            size: 0.55,
            color: colors.fireColor,
            map: pTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.fireParticles = new THREE.Points(this.fireGeometry, fireMat);
        this.scene.add(this.fireParticles);
    }

    private buildAmbientEmbers(): void {
        const colors = this.getColors();
        this.emberGeometry = new THREE.BufferGeometry();
        this.emberPositions = new Float32Array(this.emberCount * 3);

        for (let i = 0; i < this.emberCount; i++) {
            this.emberPositions[i * 3] = (Math.random() - 0.5) * 22;
            this.emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
            this.emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
        }

        this.emberGeometry.setAttribute("position", new THREE.BufferAttribute(this.emberPositions, 3));

        const emberMat = new THREE.PointsMaterial({
            size: 0.18,
            color: colors.hornColor,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.emberParticles = new THREE.Points(this.emberGeometry, emberMat);
        this.scene.add(this.emberParticles);
    }

    private bindEvents(): void {
        window.addEventListener("resize", () => this.onWindowResize());

        window.addEventListener("pointermove", (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
            this.targetRotY = this.mouseX * 0.45;
            this.targetRotX = -this.mouseY * 0.35;
        });

        // Click to trigger Dracarys Dragonfire breath
        window.addEventListener("click", (e) => {
            // Don't trigger if clicking inside inputs or buttons
            const target = e.target as HTMLElement;
            if (target && (target.closest("button") || target.closest("input") || target.closest(".offcanvas") || target.closest(".modal"))) {
                return;
            }
            this.triggerFireBreath(1.2);
        });

        // Keyboard Shortcut 'D' to unleash DRACARYS fire
        window.addEventListener("keydown", (e) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === "input" || activeTag === "textarea") return;

            if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
                this.triggerFireBreath(1.5);
            }
        });

        // HUD Controls
        const btnDracarys = document.getElementById("btnDragonDracarys");
        if (btnDracarys) {
            btnDracarys.addEventListener("click", () => this.triggerFireBreath(1.8));
        }

        const btnMode = document.getElementById("btnDragonMode");
        if (btnMode) {
            btnMode.addEventListener("click", () => this.toggleDisplayMode());
        }

        const btnToggle = document.getElementById("btnDragonToggle");
        if (btnToggle) {
            btnToggle.addEventListener("click", () => this.toggleVisibility());
        }
    }

    private onWindowResize(): void {
        if (!this.camera || !this.renderer) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    public triggerFireBreath(intensity = 1.0): void {
        this.fireActive = true;
        this.fireTimer = 1.8 * intensity;

        // Open jaw
        if (this.jawMesh) {
            this.jawMesh.rotation.x = 0.55;
        }

        // Pulse core light
        if (this.coreLight) {
            this.coreLight.intensity = 5.5;
        }

        // Spawn dense particle burst
        if (!this.headGroup) return;
        const headWorldPos = new THREE.Vector3();
        this.headGroup.getWorldPosition(headWorldPos);

        const countToEmit = Math.floor(180 * intensity);
        let emitted = 0;

        for (let i = 0; i < this.fireMaxParticles && emitted < countToEmit; i++) {
            if (this.fireLifetimes[i] <= 0) {
                this.firePositions[i * 3] = headWorldPos.x + (Math.random() - 0.5) * 0.15;
                this.firePositions[i * 3 + 1] = headWorldPos.y - 0.15 + (Math.random() - 0.5) * 0.15;
                this.firePositions[i * 3 + 2] = headWorldPos.z + 0.5;

                // Fire velocity aimed slightly forward & towards mouse
                const forwardSpeed = 5.0 + Math.random() * 4.0;
                this.fireVelocities[i * 3] = (this.mouseX * 2.2 + (Math.random() - 0.5) * 1.5);
                this.fireVelocities[i * 3 + 1] = (this.mouseY * 1.8 + (Math.random() - 0.5) * 1.2);
                this.fireVelocities[i * 3 + 2] = forwardSpeed;

                this.fireLifetimes[i] = 0.8 + Math.random() * 0.7;
                emitted++;
            }
        }
    }

    public setState(state: AssistantState): void {
        this.currentState = state;
        const colors = this.getColors();

        if (state === AssistantState.SPEAKING) {
            this.triggerFireBreath(1.0);
            if (this.coreLight) this.coreLight.color.setHex(colors.fireColor);
        } else if (state === AssistantState.PROCESSING) {
            if (this.coreLight) this.coreLight.intensity = 3.5;
        } else if (state === AssistantState.LISTENING) {
            if (this.coreLight) this.coreLight.intensity = 2.8;
        } else {
            if (this.coreLight) this.coreLight.intensity = 1.8;
        }
    }

    public setTheme(themeName: string): void {
        this.currentTheme = themeName;
        const colors = this.getColors();

        if (this.scaleMaterial) this.scaleMaterial.color.setHex(colors.scaleColor);
        if (this.membraneMaterial) {
            this.membraneMaterial.color.setHex(colors.membraneColor);
            this.membraneMaterial.emissive.setHex(colors.membraneColor);
        }
        if (this.hornMaterial) {
            this.hornMaterial.color.setHex(colors.hornColor);
            this.hornMaterial.emissive.setHex(colors.hornColor);
        }
        if (this.eyeMaterial) this.eyeMaterial.color.setHex(colors.eyeColor);
        if (this.fireParticles && this.fireParticles.material) {
            this.fireParticles.material.color.setHex(colors.fireColor);
        }
        if (this.coreLight) this.coreLight.color.setHex(colors.lightColor);
        this.eyeLights.forEach(light => light.color.setHex(colors.eyeColor));
    }

    public toggleDisplayMode(): void {
        if (this.displayMode === "3d_interactive") {
            this.setDisplayMode("cinematic_video");
        } else {
            this.setDisplayMode("3d_interactive");
        }
    }

    public setDisplayMode(mode: DragonDisplayMode): void {
        this.displayMode = mode;
        const label = document.getElementById("dragonModeLabel");

        if (mode === "cinematic_video") {
            if (label) label.textContent = "Cinematic Video";
            if (this.canvas) this.canvas.classList.add("video-mode-filter");
            if (this.videoElement) {
                this.videoElement.style.display = "block";
                this.videoElement.play().catch(() => {});
            }
        } else {
            if (label) label.textContent = "3D Interactive";
            if (this.canvas) this.canvas.classList.remove("video-mode-filter");
            if (this.videoElement) {
                this.videoElement.style.display = "none";
                this.videoElement.pause();
            }
        }
    }

    public toggleVisibility(): void {
        this.isVisible = !this.isVisible;
        const container = document.getElementById("dragonBackgroundContainer");
        const btnToggle = document.getElementById("btnDragonToggle");

        if (container) {
            container.style.opacity = this.isVisible ? "1" : "0.08";
        }
        if (btnToggle) {
            btnToggle.innerHTML = this.isVisible ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
        }
    }

    private setupVideoMirroring(): void {
        // Stream 3D WebGL canvas into HTML5 video player for authentic interactive video format support
        if (!this.videoElement || !this.canvas) return;
        try {
            if ("captureStream" in this.canvas) {
                this.videoStream = (this.canvas as any).captureStream(30);
                this.videoElement.srcObject = this.videoStream;
            }
        } catch (e) {
            console.debug("Canvas captureStream notice:", e);
        }
    }

    private animate = (): void => {
        if (!this.isRunning) return;
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // 1. Smooth Head & Dragon Rotation towards Mouse
        this.currentRotX += (this.targetRotX - this.currentRotX) * 0.045;
        this.currentRotY += (this.targetRotY - this.currentRotY) * 0.045;

        if (this.dragonGroup) {
            // Hovering floating oscillation
            const hoverY = Math.sin(time * 1.6) * 0.22;
            const hoverRoll = Math.cos(time * 1.6) * 0.04;
            this.dragonGroup.position.y = 0.35 + hoverY;
            this.dragonGroup.rotation.y = this.currentRotY * 0.5 + hoverRoll;
            this.dragonGroup.rotation.x = this.currentRotX * 0.35;
        }

        // Head tracking mouse
        if (this.headGroup) {
            this.headGroup.rotation.y = this.currentRotY * 1.1;
            this.headGroup.rotation.x = this.currentRotX * 0.9;
        }

        // 2. Wing Flapping Kinematics
        let flapSpeed = 2.2;
        let flapAmp = 0.5;

        if (this.currentState === AssistantState.SPEAKING) {
            flapSpeed = 3.6;
            flapAmp = 0.65;
        } else if (this.currentState === AssistantState.PROCESSING) {
            flapSpeed = 3.0;
        }

        const flapAngle = Math.sin(time * flapSpeed) * flapAmp;
        const twistAngle = Math.cos(time * flapSpeed) * 0.22;

        if (this.leftWingGroup && this.rightWingGroup) {
            this.leftWingGroup.rotation.z = flapAngle;
            this.leftWingGroup.rotation.y = -twistAngle;

            this.rightWingGroup.rotation.z = -flapAngle;
            this.rightWingGroup.rotation.y = twistAngle;
        }

        // 3. Serpentine Spine & Tail Wave Propagation
        for (let i = 0; i < this.tailSegments.length; i++) {
            const tailPhase = time * 2.0 - i * 0.38;
            this.tailSegments[i].rotation.y = Math.sin(tailPhase) * 0.14;
            this.tailSegments[i].rotation.x = Math.cos(tailPhase * 0.8) * 0.05;
        }

        // 4. Update Dracarys Fire Particles
        if (this.fireActive) {
            this.fireTimer -= delta;
            if (this.fireTimer <= 0) {
                this.fireActive = false;
                if (this.jawMesh) this.jawMesh.rotation.x = 0; // close jaw
                if (this.coreLight) this.coreLight.intensity = 2.0;
            }
        }

        const pArr = this.firePositions;
        const vArr = this.fireVelocities;
        for (let i = 0; i < this.fireMaxParticles; i++) {
            if (this.fireLifetimes[i] > 0) {
                this.fireLifetimes[i] -= delta;

                pArr[i * 3] += vArr[i * 3] * delta;
                pArr[i * 3 + 1] += vArr[i * 3 + 1] * delta;
                pArr[i * 3 + 2] += vArr[i * 3 + 2] * delta;

                // Fire buoyancy (rises upward)
                vArr[i * 3 + 1] += 0.8 * delta;

                if (this.fireLifetimes[i] <= 0) {
                    pArr[i * 3 + 1] = -999; // hide
                }
            }
        }
        if (this.fireGeometry) {
            this.fireGeometry.attributes.position.needsUpdate = true;
        }

        // 5. Update Ambient Floating Embers
        const eArr = this.emberPositions;
        for (let i = 0; i < this.emberCount; i++) {
            eArr[i * 3 + 1] += (0.45 + (i % 3) * 0.2) * delta;
            eArr[i * 3] += Math.sin(time + i) * 0.25 * delta;

            // Wrap around ceiling
            if (eArr[i * 3 + 1] > 8) {
                eArr[i * 3 + 1] = -8;
                eArr[i * 3] = (Math.random() - 0.5) * 22;
            }
        }
        if (this.emberGeometry) {
            this.emberGeometry.attributes.position.needsUpdate = true;
        }

        // Render Frame
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    };

    public destroy(): void {
        this.isRunning = false;
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
