import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d';

import { World, Move } from './world';

type Position = [number, number];

class Color {
	static readonly GRAY = new Color(230, 230, 230);
	static readonly BLUE = new Color(68, 187, 248);
	static readonly RED = new Color(248, 78, 94);
	static readonly YELLOW = new Color(248, 230, 110);
	static readonly PURPLE = new Color(200, 90, 220);
	static readonly ORANGE = new Color(248, 160, 80);
	static readonly GREEN = new Color(140, 218, 90);

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

class Square {
	p: Position;
	resetPosition: Position;
	color: Color;
	componentStatus: ComponentStatus;
	chunkId: number;
	onBoundary: boolean = false;
	pixi = new PIXI3D.Container3D();
	mesh: PIXI3D.Mesh3D;
	selectionCircle = new PIXI.Graphics();
	circle = new PIXI.Graphics();
	componentMark = new PIXI.Graphics();
	backgroundPixi = new PIXI.Graphics();
	foregroundPixi = new PIXI.Graphics();
	dots: [number, PIXI.Graphics][] = [];
	selected: boolean = false;

	constructor(private world: World, p: [number, number], color: Color) {
		this.p = [p[0], p[1]];
		this.resetPosition = [p[0], p[1]];
		this.color = color;
		this.componentStatus = ComponentStatus.NONE;
		this.chunkId = -1;

		// @ts-ignore
		let material = new PIXI3D.StandardMaterial();
		material.baseColor = new PIXI3D.Color(1, 1, 1);
		material.exposure = 1.5;
		material.metallic = 0.3;
		material.roughness = 0.5;
		material.shadowCastingLight = world.shadowLight;

		// @ts-ignore
		this.mesh = PIXI3D.Model.from(PIXI.Loader.shared.resources["cube.gltf"]['gltf']).meshes[0];
		this.mesh.material = material;
		this.mesh.position.set(0, 0, 0);
		this.pixi.addChild(this.mesh);

		/*this.foregroundPixi.addChild(this.selectionCircle);
		this.pixi.addChild(this.circle);
		this.pixi.addChild(this.componentMark);*/
		this.updatePixi();

		this.updatePosition(0, 0);
	}

	updatePixi(): void {
		if (!this.world.showComponentMarks) {
			(this.mesh.material! as PIXI3D.StandardMaterial).baseColor = new PIXI3D.Color(1, 1, 1);
		} else {
			switch (this.componentStatus) {
				case ComponentStatus.CONNECTOR:
					(this.mesh.material! as PIXI3D.StandardMaterial).baseColor = new PIXI3D.Color(0.45, 0.65, 0.925);
					break;
				case ComponentStatus.CHUNK_STABLE:
					(this.mesh.material! as PIXI3D.StandardMaterial).baseColor = new PIXI3D.Color(0.3, 0.5, 0.9);
					break;
				case ComponentStatus.CHUNK_CUT:
					(this.mesh.material! as PIXI3D.StandardMaterial).baseColor = new PIXI3D.Color(0.6, 0.8, 0.95);
					break;
				case ComponentStatus.LINK_STABLE:
					(this.mesh.material! as PIXI3D.StandardMaterial).baseColor = new PIXI3D.Color(0.9, 0.5, 0.3);
					break;
				case ComponentStatus.LINK_CUT:
					(this.mesh.material! as PIXI3D.StandardMaterial).baseColor = new PIXI3D.Color(0.95, 0.8, 0.6);
					break;
			}
		}
		/*this.selectionCircle.clear();
		this.selectionCircle.lineStyle(15, 0x2277dd);
		this.selectionCircle.moveTo(-40, -40);
		this.selectionCircle.lineTo(40, -40);
		this.selectionCircle.lineTo(40, 40);
		this.selectionCircle.lineTo(-40, 40);
		this.selectionCircle.closePath();

		this.circle.clear();
		this.circle.beginFill(this.color.toHexColor());
		this.circle.lineStyle(6, 0x222222);
		this.circle.moveTo(-40, -40);
		this.circle.lineTo(40, -40);
		this.circle.lineTo(40, 40);
		this.circle.lineTo(-40, 40);
		this.circle.closePath();
		this.circle.endFill();

		this.componentMark.clear();
		if (this.world.showComponentMarks) {
			switch (this.componentStatus) {
				case ComponentStatus.CONNECTOR:
					this.componentMark.lineStyle(6, 0x0066CB);
					this.componentMark.moveTo(-15, -15);
					this.componentMark.lineTo(15, -15);
					this.componentMark.lineTo(15, 15);
					this.componentMark.lineTo(-15, 15);
					this.componentMark.closePath();
					this.componentMark.moveTo(-15, -15);
					this.componentMark.lineTo(15, 15);
					this.componentMark.moveTo(15, -15);
					this.componentMark.lineTo(-15, 15);
					break;
				case ComponentStatus.CHUNK_STABLE:
					this.componentMark.beginFill(0x0066CB);
					this.componentMark.moveTo(-18, -18);
					this.componentMark.lineTo(18, -18);
					this.componentMark.lineTo(18, 18);
					this.componentMark.lineTo(-18, 18);
					this.componentMark.closePath();
					this.componentMark.endFill();
					break;
				case ComponentStatus.CHUNK_CUT:
					this.componentMark.lineStyle(6, 0x0066CB);
					this.componentMark.moveTo(-15, -15);
					this.componentMark.lineTo(15, -15);
					this.componentMark.lineTo(15, 15);
					this.componentMark.lineTo(-15, 15);
					this.componentMark.closePath();
					break;
				case ComponentStatus.LINK_STABLE:
					this.componentMark.beginFill(0xD5004A);
					this.componentMark.drawCircle(0, 0, 19);
					this.componentMark.endFill();
					break;
				case ComponentStatus.LINK_CUT:
					this.componentMark.lineStyle(6, 0xD5004A);
					this.componentMark.drawCircle(0, 0, 16);
					break;
			}
		}

		this.backgroundPixi.clear();
		this.backgroundPixi.beginFill(0x000000);
		this.backgroundPixi.lineStyle(6, 0x000000);
		this.backgroundPixi.moveTo(40, -40);
		this.backgroundPixi.lineTo(50, -30);
		this.backgroundPixi.lineTo(50, 50);
		this.backgroundPixi.lineTo(-30, 50);
		this.backgroundPixi.lineTo(-40, 40);
		this.backgroundPixi.lineTo(-40, -40);
		this.backgroundPixi.closePath();
		this.backgroundPixi.endFill();*/
	}

	updatePosition(time: number, timeStep: number, move?: Move): void {
		let [x, y] = this.p;
		if (move) {
			[x, y] = move.interpolate(time - timeStep + 1);
		}

		this.pixi.x = x;
		this.pixi.z = -y;
	}

	setColor(color: Color): void {
		this.color = color;
		this.updatePixi();
	}

	setComponentStatus(componentStatus: ComponentStatus): void {
		this.componentStatus = componentStatus;
		this.updatePixi();
	}

	setChunkId(chunkId: number): void {
		this.chunkId = chunkId;
		this.updatePixi();
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

export { Square, Color, ComponentStatus, Position };
