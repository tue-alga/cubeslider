import * as PIXI from 'pixi.js';
import {InteractionEvent} from 'pixi.js';
import * as PIXI3D from 'pixi3d';

import {Color, Cube, Position} from './cube';
import {Configuration} from "./configuration";
import {SimulationMode} from "./cube-slider";


/**
 * Collection of Cubes on the grid.
 */
class World {
	
	configuration: Configuration = new Configuration(this);
	pixi = new PIXI3D.Container3D();
	showComponentMarks = false;

	ground: PIXI3D.Mesh3D[][] = [];
	shadowLight: PIXI3D.ShadowCastingLight;
	phantomCube: PIXI3D.Mesh3D;

	pipeline: PIXI3D.StandardPipeline;

	modifyingCubes = true;

	simulationMode: SimulationMode = SimulationMode.RESET;

	/**
	 * Creates the world and initializes its PIXI elements (viewport and grid).
	 */
	constructor(app: PIXI.Application) {
		const renderer = app.renderer as PIXI.Renderer;

		// @ts-ignore
		let ibl = new PIXI3D.ImageBasedLighting(PIXI.Loader.shared.resources['diffuse.cubemap'].cubemap, PIXI.Loader.shared.resources['specular.cubemap'].cubemap);

		PIXI3D.LightingEnvironment.main = new PIXI3D.LightingEnvironment(renderer, ibl);

		let dirLight = new PIXI3D.Light();
		dirLight.type = PIXI3D.LightType.directional;
		dirLight.intensity = 1;
		dirLight.position.set(0, 0, 0);
		dirLight.rotationQuaternion.setEulerAngles(70, 70, 0);
		PIXI3D.LightingEnvironment.main.lights.push(dirLight);

		this.shadowLight = new PIXI3D.ShadowCastingLight(renderer, dirLight, {
			'shadowTextureSize': 2048,
			'quality': PIXI3D.ShadowQuality.high
		});
		this.shadowLight.softness = 10;
		this.shadowLight.shadowArea = 50;
		this.pipeline = renderer.plugins.pipeline;

		let darkGroundMaterial = new PIXI3D.StandardMaterial();
		darkGroundMaterial.baseColor = new PIXI3D.Color(0.9, 0.9, 0.9);
		darkGroundMaterial.exposure = 1.5;
		let lightGroundMaterial = new PIXI3D.StandardMaterial();
		lightGroundMaterial.baseColor = new PIXI3D.Color(1, 1, 1);
		lightGroundMaterial.exposure = 1.5;
		for (let x = -10; x < 10; x++) {
			let row: PIXI3D.Mesh3D[] = [];
			for (let y = -10; y < 10; y++) {
				let tile = this.pixi.addChild(PIXI3D.Mesh3D.createPlane());
				let pixiCoords = World.worldToPixiCoords([x, y, -0.5]);
				tile.position.x = pixiCoords[0];
				tile.position.y = pixiCoords[1];
				tile.position.z = pixiCoords[2];
				tile.scale.set(0.5);
				row.push(tile);
				if ((x + y) % 2 == 0) {
					tile.material = darkGroundMaterial;
				} else {
					tile.material = lightGroundMaterial;
				}
				tile.interactive = true;
				tile.hitArea = new PIXI3D.PickingHitArea(undefined, tile);
				let newCubePosition: Position = [x, y, 0];
				tile.on("pointerover", () => {
					if (this.modifyingCubes && !this.configuration.hasCube(newCubePosition)) {
						this.showPhantomCube(newCubePosition);
					}
				});
				tile.on("pointerout", () => {
					this.hidePhantomCube();
				});
				tile.on("pointerdown", (event: InteractionEvent) => {
					if (event.data.button == 0 && this.modifyingCubes &&
							!this.configuration.hasCube(newCubePosition) &&
							this.simulationMode === SimulationMode.RESET) {
						this.hidePhantomCube();
						this.addCube(new Cube(this, newCubePosition, Color.GRAY));
					}
				});
				this.pipeline.enableShadows(tile, this.shadowLight);
			}
			this.ground.push(row);
		}

		
		// show 2 axis.
		// One transparent in front of everything (depthTest = false)
		// One opaque
		let axisWidth = 0.1;
		let axisHeight = 6;
		let axisScale = axisHeight / 2;
		
		for (let i = 0; i < 3; i++) {
			let axisMaterialTransparent = new PIXI3D.StandardMaterial();
			axisMaterialTransparent.alphaMode = PIXI3D.StandardMaterialAlphaMode.blend
			axisMaterialTransparent.renderSortType = PIXI3D.MaterialRenderSortType.transparent;
			axisMaterialTransparent.state.depthTest = false;
			
			let axisMaterialOpaque = new PIXI3D.StandardMaterial();
			
			let axisTransparent = this.pixi.addChild(PIXI3D.Mesh3D.createCube());
			let axisOpaque = this.pixi.addChild(PIXI3D.Mesh3D.createCube());
			switch (i) {
				case 0:
					axisTransparent.position.x = axisScale;
					axisOpaque.position.x = axisScale;
					axisTransparent.scale.set(axisScale, axisWidth, axisWidth);
					axisOpaque.scale.set(axisScale, axisWidth, axisWidth);
					axisMaterialTransparent.baseColor = new PIXI3D.Color(1, 0, 0, 0.2);
					axisMaterialOpaque.baseColor = new PIXI3D.Color(1, 0, 0);
					break;
				case 1:
					axisTransparent.position.z = -axisScale;
					axisOpaque.position.z = -axisScale;
					axisTransparent.scale.set(axisWidth, axisWidth, axisScale);
					axisOpaque.scale.set(axisWidth, axisWidth, axisScale);
					axisMaterialTransparent.baseColor = new PIXI3D.Color(0, 1, 0, 0.2);
					axisMaterialOpaque.baseColor = new PIXI3D.Color(0, 1, 0);
					break;
				case 2:
					axisTransparent.position.y = axisScale;
					axisOpaque.position.y = axisScale;
					axisTransparent.scale.set(axisWidth, axisScale, axisWidth);
					axisOpaque.scale.set(axisWidth, axisScale, axisWidth);
					axisMaterialTransparent.baseColor = new PIXI3D.Color(0, 0, 1, 0.2);
					axisMaterialOpaque.baseColor = new PIXI3D.Color(0, 0, 1);
					break;
			}
			axisTransparent.material = axisMaterialTransparent;
			axisOpaque.material = axisMaterialOpaque;
			axisTransparent.interactive = false;
			axisOpaque.interactive = false;
		}
		

		// phantom cube for showing where a new cube will be added
		let material = new PIXI3D.StandardMaterial();
		material.baseColor = new PIXI3D.Color(1, 1, 1, 0.4);
		material.exposure = 1.5;
		material.metallic = 0.3;
		material.roughness = 0.5;
		material.alphaMode = PIXI3D.StandardMaterialAlphaMode.blend;
		material.renderSortType = PIXI3D.MaterialRenderSortType.transparent;
		// @ts-ignore
		this.phantomCube = PIXI3D.Model.from(PIXI.Loader.shared.resources["cube.gltf"]['gltf']).meshes[0];
		this.phantomCube.material = material;
		this.phantomCube.visible = false;
		this.pixi.addChild(this.phantomCube);
	}

	static pixiToWorldCoords(p: [number, number, number]) : [number, number, number] {
		return [p[0], -p[2], p[1]];
	}
	
	static worldToPixiCoords(p: [number, number, number]) : [number, number, number] {
		return [p[0], p[2], -p[1]];
	}
	
	showPhantomCube([x, y, z]: Position): void {
		this.pixi.removeChild(this.phantomCube);
		this.pixi.addChild(this.phantomCube);
		let pixiCoords = World.worldToPixiCoords([x, y, z]);
		this.phantomCube.position.set(pixiCoords[0], pixiCoords[1], pixiCoords[2]);
		this.phantomCube.visible = true;
	}

	hidePhantomCube(): void {
		this.phantomCube.visible = false;
	}

	/**
	 * Adds a cube to the world; throws if a cubes already exists at that location.
	 * @param cube
	 */
	addCube(cube: Cube): void {
		this.configuration.addCube(cube);
		this.pixi.addChild(cube.pixi);
		this.pipeline.enableShadows(cube.mesh);
	}

	/**
	 * Removes the cube at the given location
	 */
	removeCube(cube: Cube): void {
		this.configuration.removeCube(cube);
		this.pixi.removeChild(cube.pixi);
	}

	/**
	 * Generates a JSON string from this world.
	 */
	serialize(): string {
		let cubes: any = [];
		this.configuration.cubes.forEach((cube) => {
			cubes.push({
				'x': cube.resetPosition[0],
				'y': cube.resetPosition[1],
				'z': cube.resetPosition[2],
				'color': [cube.color.r, cube.color.g, cube.color.b]
			});
		});
		let obj: any = {
			'_version': 1,
			'cubes': cubes
		};
		return JSON.stringify(obj);
	}

	/**
	 * Parses a JSON string back into this world. Make sure this is an empty
	 * world before calling this method.
	 */
	deserialize(data: string): void {
		let obj: any = JSON.parse(data);

		const version = obj['_version'];
		if (version > 1) {
			throw new Error('Save file with incorrect version');
		}

		let cubes: any[] = obj['cubes'];
		cubes.forEach((cube: any) => {
			let color = Color.BLUE;
			if (cube.hasOwnProperty('color')) {
				color = new Color(cube['color'][0],
					cube['color'][1], cube['color'][2]);
			}
			this.addCube(new Cube(this, [cube['x'], cube['y'], cube['z']], color));
		});
	}
}

export { World, SimulationMode };
