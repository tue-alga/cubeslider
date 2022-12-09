import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d';

import {SimulationMode, World} from './world';
import {InteractionEvent, Program} from "pixi.js";
import { Move } from './move';
import {Camera, Material, Mesh3D, MeshShader, StandardMaterial, Vec3} from "pixi3d";

type Position = [number, number, number];

// A custom material that allows for setting specific move types.
// When these booleans are set, stripes of color appear over the cubes.
class CustomMaterial extends Material {
	/** The base color of the material. */
	baseColor: PIXI3D.Color = new PIXI3D.Color(1.0, 1.0, 1.0);
	lightPos: Float32Array = Vec3.fromValues(100.0, 50.0, 0.0);
	lmMove: boolean = false;
	cornerMove: boolean = false;
	chainMove: boolean = false;

	updateUniforms(mesh: Mesh3D, shader:MeshShader) {
		if (shader.uniforms.u_Time === undefined) {
			shader.uniforms.u_Time = 0;
		}
		shader.uniforms.u_ViewProjection = Camera.main.viewProjection;
		shader.uniforms.u_Model = mesh.worldTransform.array;
		shader.uniforms.u_BaseColor = [this.baseColor.r, this.baseColor.g, this.baseColor.b];
		shader.uniforms.u_PossibleMoves = [+this.lmMove, +this.cornerMove, +this.chainMove];
		shader.uniforms.u_LightPos = [this.lightPos[0], this.lightPos[1], this.lightPos[2]];
		shader.uniforms.u_ViewPos = [Camera.main.x, Camera.main.y, Camera.main.z];
	}

	// The vertex shader is responsible for converting each vertex position into
	// normalized device coordinates (from -1 to 1). The defined attributes
	// (a_Position and a_Normal) are automatically linked to the mesh geometry
	// when using `MeshShader`. Varying variables are passed to the fragment shader.
	// Uniforms are used to pass values from JavaScript to the shader.
	// Both vertex -and fragment shaders are written using GLSL (GL Shader Language).

	vertexShader = `
			attribute vec3 a_Position;
			attribute vec2 a_UV1;
			attribute vec3 a_Normal;

			varying vec3 v_Position;
			varying vec2 v_UV1;
			varying vec3 v_Normal;
			varying vec3 v_FragPos;

			uniform mat4 u_ViewProjection;
			uniform mat4 u_Model;

			void main() {
			  v_Position = a_Position;
			  v_UV1 = a_UV1;
			  v_Normal = a_Normal;
			  v_FragPos = vec3(u_Model * vec4(a_Position, 1.0));
			  gl_Position = u_ViewProjection * u_Model * vec4(a_Position, 1.0);
			}
			`;
	
	fragmentShader = `
			varying vec3 v_Position;
			varying vec2 v_UV1;
			varying vec3 v_Normal;
			varying vec3 v_FragPos;

			uniform vec3 u_BaseColor;
			uniform vec3 u_PossibleMoves;
			
			uniform vec3 u_LightPos;
			uniform vec3 u_ViewPos;
			
			const vec3 colorLM = vec3(1.0, 0.0, 0.0);
			const vec3 colorCorner = vec3(0.0, 1.0, 0.0);
			const vec3 colorChain = vec3(0.0, 0.0, 1.0);
			
			void main() {
			  vec3 position = v_Position / 100.0;
			  
			  // Count the number of colors we need and which colors that are
			  float numberOfColors = 0.0;
			  vec3 color1;
			  vec3 color2;
			  vec3 color3;
			  if (u_PossibleMoves.x == 1.0) {
			  	numberOfColors = numberOfColors + 1.0;
			  	color1 = colorLM;
			  }
			  if (u_PossibleMoves.y == 1.0) {
			  	numberOfColors = numberOfColors + 1.0;
			  	if (length(color1) == 0.0) {
			  		color1 = colorCorner;
			  	} else {
			  		color2 = colorCorner;
			  	}
			  }
			  if (u_PossibleMoves.z == 1.0) {
			  	numberOfColors = numberOfColors + 1.0;
				if (length(color1) == 0.0) {
			  		color1 = colorChain;
			  	} else if (length(color2) == 0.0) {
			  		color2 = colorChain;
			  	} else {
			  		color3 = colorChain;
			  	}
			  }
			  
			  // We want twice as many stripes as we have colors for visibility, unless there is only 1 color
			  float numberOfStripes = numberOfColors * 2.0;	  
			  if (numberOfColors == 1.0) {
			  	numberOfStripes = 1.0;
			  }
			  
			  // Calculate the normalized positions for each coordinate
			  float normalPosY = v_Position.y + 0.5;
			  float normalPosX = v_Position.x + 0.5;
			  float normalPosZ = v_Position.z + 0.5;
			  // interpolate between all coordinates to get a diagonal gradient
			  float normalPos = mix(normalPosX, normalPosY, 0.5);
			  normalPos = mix(normalPos, normalPosZ, 0.5);
			  // create gradient stripes
			  float gradient = mod(normalPos * (numberOfStripes / numberOfColors), 1.0);
			  // cap the gradient into integers
			  float stripes = floor(gradient * numberOfColors);
			  
			  // depending on the current stripe, a different color will be picked
			  vec3 color = vec3(0.0, 0.0, 0.0);
			  if (stripes == 0.0) {
			  	color = color1;
			  } else if (stripes == 1.0) {
			  	color = color2;
			  } else if (stripes == 2.0) {
			  	color = color3;
			  }
			  // if there are no available moves, pick the default color
			  if (length(u_PossibleMoves) == 0.0) {
			  	color = u_BaseColor;
			  }
			  
			  vec3 normal = v_Normal + 0.5;
			  
			  // add diffuse lighting
			  vec3 lightDir = normalize(u_LightPos - v_FragPos);
			  float diffuseFactor = max(dot(normal, lightDir), 0.0);	  
			  
			  float lightFactor = diffuseFactor;
			  // let lightFactor range between 0.2 and 0.8
			  float startRange = 0.5;
			  float endRange = 0.8;
			  float range = endRange - startRange;
			  lightFactor = lightFactor * range + startRange;
			  
			  gl_FragColor = vec4(color * lightFactor, 1.0);
			}
			`;

	createShader() {
		return new MeshShader(Program.from(this.vertexShader, this.fragmentShader));
	}
}

class Color {
	static readonly GRAY = new Color(230, 230, 230);
	static readonly BLUE = new Color(68, 187, 248);
	static readonly RED = new Color(248, 78, 94);
	static readonly YELLOW = new Color(248, 230, 110);
	static readonly PURPLE = new Color(200, 90, 220);
	static readonly ORANGE = new Color(248, 160, 80);
	static readonly GREEN = new Color(140, 218, 90);

	static readonly CONNECTOR_COLOR = new PIXI3D.Color(0.45, 0.65, 0.925); // #73A6EC
	static readonly CHUNK_STABLE_COLOR = new PIXI3D.Color(0.3, 0.5, 0.9); // #4D80E6
	static readonly CHUNK_CUT_COLOR = new PIXI3D.Color(0.6, 0.8, 0.95); // #99CCF2
	static readonly LINK_STABLE_COLOR = new PIXI3D.Color(0.9, 0.5, 0.3); //#E6804D
	static readonly LINK_CUT_COLOR = new PIXI3D.Color(0.95, 0.8, 0.6); // #F2CC99
	static readonly HEAVY_COLOR = new PIXI3D.Color(0.42,0.93,0.45); //#6AEC73
	static readonly MOVEALBE_COLOR = new PIXI3D.Color(1, 1, 0); // #ffff00
	
	static readonly BASE_COLOR = new PIXI3D.Color(1, 1, 1);
	
	constructor(public r: number, public g: number, public b: number) {
	}

	toHexColor(): number {
		return (this.r << 16) | (this.g << 8) | this.b;
	}

	equals(other: Color): boolean {
		return this.r === other.r &&
			this.g === other.g &&
			this.b === other.b;
	}
}

enum ComponentStatus {
	LINK_CUT, LINK_STABLE, CHUNK_CUT, CHUNK_STABLE, CONNECTOR, NONE
}

class Cube {
	p: Position;
	resetPosition: Position;
	color: Color;
	componentStatus: ComponentStatus;
	heavyChunk: boolean;
	chunkId: number;
	pixi = new PIXI3D.Container3D();
	mesh: PIXI3D.Mesh3D;
	selectionCircle = new PIXI.Graphics();
	circle = new PIXI.Graphics();
	componentMark = new PIXI.Graphics();
	backgroundPixi = new PIXI.Graphics();
	foregroundPixi = new PIXI.Graphics();
	selected: boolean = false;

	constructor(private world: World | null, p: [number, number, number], color?: Color, interactive?: boolean) {
		this.p = [p[0], p[1], p[2]];
		this.resetPosition = [p[0], p[1], p[2]];
		this.color = (color === undefined) ? new Color(Color.BASE_COLOR.r, Color.BASE_COLOR.g, Color.BASE_COLOR.b) : color;
		this.componentStatus = ComponentStatus.NONE;
		this.heavyChunk = false;
		this.chunkId = -1;
		
		// @ts-ignore
		this.mesh = PIXI3D.Model.from(PIXI.Loader.shared.resources["cube.gltf"]['gltf']).meshes[0];
		
		if (world !== null) {
			let material = new PIXI3D.StandardMaterial();
			material.baseColor = Color.BASE_COLOR;
			material.exposure = 1.5;
			material.metallic = 0.3;
			material.roughness = 0.5;
			material.shadowCastingLight = world.shadowLight;

			this.mesh.material = material;
			this.mesh.position.set(0, 0, 0);
			this.pixi.addChild(this.mesh);
		
			if (interactive === undefined || interactive) {
				this.addShield([-1, 0, 0], [0, 0, 90]);  // x
				this.addShield([1, 0, 0], [0, 0, -90]);  // X
				this.addShield([0, -1, 0], [90, 0, 0]);  // y
				this.addShield([0, 1, 0], [-90, 0, 0]);  // Y
				this.addShield([0, 0, -1], [180, 0, 0]);  // z
				this.addShield([0, 0, 1], [0, 0, 0]);  // Z
			}

			this.mesh.material = new CustomMaterial();
			
			this.updatePixi();
		}

		this.updatePosition(0, 0);
	}

	private addShield(p: Position, [rx, ry, rz]: [number, number, number]): void {
		if (this.world === null) {
			throw Error("Adding shields on a cube that does not have a world attached makes no sense.");
		}
		let shield = PIXI3D.Mesh3D.createPlane();
		this.pixi.addChild(shield);
		shield.scale.set(0.5);
		shield.position.set(p[0] * 0.5, p[2] * 0.5, -p[1] * 0.5);
		shield.rotationQuaternion.setEulerAngles(rx, ry, rz);
		shield.interactive = true;
		shield.alpha = 0;
		shield.hitArea = new PIXI3D.PickingHitArea(undefined, shield);
		shield.on("pointerover", () => {
			let newCubePosition: Position = [
				this.p[0] + p[0], this.p[1] + p[1], this.p[2] + p[2]];
			if (this.world!.modifyingCubes && !this.world!.configuration.hasCube(newCubePosition)) {
				this.world!.showPhantomCube(newCubePosition);
			}
		});
		shield.on("pointerout", () => {
			this.world!.hidePhantomCube();
		});
		shield.on("pointerdown", (event: InteractionEvent) => {
			if (this.world!.modifyingCubes && this.world!.simulationMode === SimulationMode.RESET) {
				let newCubePosition: Position = [
					this.p[0] + p[0], this.p[1] + p[1], this.p[2] + p[2]];
				// primary button (0) adds cubes, secondary button (2) removes cubes
				if (event.data.button == 0 && !this.world!.configuration.hasCube(newCubePosition)) {
					this.world!.hidePhantomCube();
					this.world!.addCube(new Cube(this.world, newCubePosition, this.color));
				} else if (event.data.button == 2) {
					this.world!.removeCube(this);
				}
			}
		});
	}

	updatePixi(): void {
		if (this.world === null) {
			throw Error("You tried calling updatePixi on a cube that does not have a world attached.");
		}
		let material = this.mesh.material! as CustomMaterial;
		if (this.world.showMoves.indexOf(this) > -1) {
			if (this.world.freeMoves.indexOf(this) > -1) {
				material.lmMove = true;
			}
			if (this.world.cornerMoves.indexOf(this) > -1) {
				material.cornerMove = true;
			}
			if (this.world.chainMoves.indexOf(this) > -1) {
				material.chainMove = true;
			}
		} else {
			material.lmMove = false;
			material.cornerMove = false;
			material.chainMove = false;
		}
		if (!this.world.showComponentMarks) {
			if (this.heavyChunk) {
				material.baseColor = Color.HEAVY_COLOR;
			} else {
				material.baseColor = new PIXI3D.Color(1, 1, 1);
			}
		} else {
			switch (this.componentStatus) {
				case ComponentStatus.CONNECTOR:
					material.baseColor = Color.CONNECTOR_COLOR;
					break;
				case ComponentStatus.CHUNK_STABLE:
					material.baseColor = Color.CHUNK_STABLE_COLOR;
					break;
				case ComponentStatus.CHUNK_CUT:
					material.baseColor = Color.CHUNK_CUT_COLOR;
					break;
				case ComponentStatus.LINK_STABLE:
					material.baseColor = Color.LINK_STABLE_COLOR;
					break;
				case ComponentStatus.LINK_CUT:
					material.baseColor = Color.LINK_CUT_COLOR;
					break;
				default:
					material.baseColor = Color.BASE_COLOR;
					break;
			}
		}
	}

	updatePosition(time: number, timeStep: number, move?: Move): void {
		let [x, y, z] = this.p;
		if (move) {
			[x, y, z] = move.interpolate(time - timeStep + 1);
		}
	
		let pixiCoords = World.worldToPixiCoords([x, y, z]);
		
		this.pixi.x = pixiCoords[0];
		this.pixi.y = pixiCoords[1];
		this.pixi.z = pixiCoords[2];
	}

	setColor(color: Color): void {
		this.color = color;
		this.updatePixi();
	}

	setComponentStatus(componentStatus: ComponentStatus, heavyChunk: boolean = false): void {
		this.componentStatus = componentStatus;
		this.heavyChunk = heavyChunk;
		if (this.world !== null) {
			this.updatePixi();
		}
	}

	setChunkId(chunkId: number): void {
		this.chunkId = chunkId;
		if (this.world !== null) {
			this.updatePixi();
		}
	}

	nextColor(): void {
		if (this.color.equals(Color.GRAY)) {
			this.setColor(Color.BLUE);
		} else if (this.color.equals(Color.BLUE)) {
			this.setColor(Color.RED);
		} else if (this.color.equals(Color.RED)) {
			this.setColor(Color.YELLOW);
		} else if (this.color.equals(Color.YELLOW)) {
			this.setColor(Color.PURPLE);
		} else if (this.color.equals(Color.PURPLE)) {
			this.setColor(Color.ORANGE);
		} else if (this.color.equals(Color.ORANGE)) {
			this.setColor(Color.GREEN);
		} else {
			this.setColor(Color.GRAY);
		}
	}
}

export { Cube, Color, ComponentStatus, Position };
