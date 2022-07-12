import * as PIXI from 'pixi.js';
import {InteractionEvent} from 'pixi.js';
import * as PIXI3D from 'pixi3d';
import {MaterialRenderSortType} from 'pixi3d';

import {Color, ComponentStatus, Position, Cube} from './cube';

/**
 * A single cell in the grid. Contains either a cube (with the ID stored) or
 * nothing (\c null).
 */
type WorldCell = {
	CubeId: number | null;
};

/**
 * An generator of moves.
 */
type MoveGenerator = Generator<Move, void, undefined>;

/**
 * Possible moves (slides and convex transitions). Slides are represented by
 * a single letter (x, y, or z), which is lowercase for the negative direction
 * and uppercase for the positive direction. Convex transitions are represented
 * similarly, but by a string of length two.
 */
const moveDirections = [
	'x', 'y', 'z', 'X', 'Y', 'Z',
	'xy', 'xY', 'xz', 'xZ',
	'yx', 'yX', 'yz', 'yZ',
	'zx', 'zX', 'zy', 'zY',
	'Xy', 'XY', 'Xz', 'XZ',
	'Yx', 'YX', 'Yz', 'YZ',
	'Zx', 'ZX', 'Zy', 'ZY'
];

/**
 * Representation of a single cube move (either slide or corner).
 */
class Move {
	/**
	 * Creates a move from a starting position and a direction.
	 */
	constructor(public world: World, public position: Position, public direction: string) {
		if (!moveDirections.includes(direction)) {
			throw new Error('Tried to create move with invalid direction "' + direction + '"');
		}
	}

	/**
	 * Returns the coordinate of the cell we're moving from.
	 */
	sourcePosition(): [number, number, number] {
		return this.position;
	}

	private static targetPositionFromFields(position: Position, direction: string): Position {
		let [x, y, z] = [...position];
		for (let i = 0; i < direction.length; i++) {
			switch (direction[i]) {
				case "x":
					x--;
					break;
				case "X":
					x++;
					break;
				case "y":
					y--;
					break;
				case "Y":
					y++;
					break;
				case "z":
					z--;
					break;
				case "Z":
					z++;
					break;
			}
		}
		return [x, y, z];
	}

	/**
	 * Returns the coordinate of the cell we're moving towards.
	 */
	targetPosition(): Position {
		return Move.targetPositionFromFields(this.position, this.direction);
	}

	/**
	 * Checks if this move is valid, but ignores the connectivity requirement
	 * (i.e., still returns true if this move disconnects the configuration
	 * but otherwise is valid).
	 *
	 * This avoids the need to do a BFS to check connectivity.
	 */
	isValidIgnoreConnectivity(): boolean {
		if (this.world.getCube(this.targetPosition())) {
			return false;
		}

		let has = this.world.hasNeighbors(this.position);

		switch (this.direction) {
			case "x":
				return (
					(has['y'] && has['xy']) ||
					(has['Y'] && has['xY']) ||
					(has['z'] && has['xz']) ||
					(has['Z'] && has['xZ'])
				);
			case "X":
				return (
					(has['y'] && has['Xy']) ||
					(has['Y'] && has['XY']) ||
					(has['z'] && has['Xz']) ||
					(has['Z'] && has['XZ'])
				);
			case "y":
				return (
					(has['x'] && has['xy']) ||
					(has['X'] && has['Xy']) ||
					(has['z'] && has['yz']) ||
					(has['Z'] && has['yZ'])
				);
			case "Y":
				return (
					(has['x'] && has['xY']) ||
					(has['X'] && has['XY']) ||
					(has['z'] && has['Yz']) ||
					(has['Z'] && has['YZ'])
				);
			case "z":
				return (
					(has['x'] && has['xz']) ||
					(has['X'] && has['Xz']) ||
					(has['y'] && has['yz']) ||
					(has['Y'] && has['Yz'])	
				);
			case "Z":
				return (
					(has['x'] && has['xZ']) ||
					(has['X'] && has['XZ']) ||
					(has['y'] && has['yZ']) ||
					(has['Y'] && has['YZ'])
				);
			default:
				// for corner moves, need to ensure that there is no Cube in
				// the first direction (which would be in our way) and there
				// is a Cube in the second direction (that we can pivot along)
				return !has[this.direction[0]] && has[this.direction[1]];
		}
	}

	/**
	 * Checks if this move is valid.
	 */
	isValid(): boolean {
		if (!this.isValidIgnoreConnectivity()) {
			return false;
		}
		if (!this.world.isConnected(this.position)) {
			return false;
		}
		return true;
	}

	/**
	 * Computes coordinates of a Cube executing this move at the given time
	 * between 0 and 1.
	 */
	interpolate(time: number): Position {
		time = -2 * time * time * time + 3 * time * time;

		let x: number, y: number, z: number;
		const [x1, y1, z1] = this.sourcePosition();
		const [x2, y2, z2] = this.targetPosition();
		if (this.direction.length === 2) {
			const [xm, ym, zm] = Move.targetPositionFromFields(this.position, this.direction[0]);
			if (time < 0.5) {
				x = x1 + (xm - x1) * 2 * time;
				y = y1 + (ym - y1) * 2 * time;
				z = z1 + (zm - z1) * 2 * time;
			} else {
				x = xm + (x2 - xm) * (2 * time - 1);
				y = ym + (y2 - ym) * (2 * time - 1);
				z = zm + (z2 - zm) * (2 * time - 1);
			}
		} else {
			x = x1 + (x2 - x1) * time;
			y = y1 + (y2 - y1) * time;
			z = z1 + (z2 - z1) * time;
		}

		return [x, y, z];
	}

	execute(): void {
		const cube = this.world.getCube(this.position);
		if (!cube) {
			throw new Error(`Tried to move non-existing Cube ` +
				`at (${this.position[0]}, ${this.position[1]})`);
		}

		this.world.moveCube(cube, this.targetPosition());
	}

	toString(): string {
		const from = this.position;
		const to = this.targetPosition();
		return `(${from[0]}, ${from[1]}) \u2192 (${to[0]}, ${to[1]})`;
	}
}

/**
 * Collection of Cubes on the grid.
 */
class World {

	world: WorldCell[][][] = [];
	pixi = new PIXI3D.Container3D();
	cubes: Cube[] = [];
	currentMove: Move | null = null;
	showComponentMarks = false;

	ground: PIXI3D.Mesh3D[][] = [];
	shadowLight: PIXI3D.ShadowCastingLight;
	phantomCube: PIXI3D.Mesh3D;

	pipeline: PIXI3D.StandardPipeline;

	modifyingCubes = true;

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
					if (this.modifyingCubes && !this.hasCube(newCubePosition)) {
						this.showPhantomCube(newCubePosition);
					}
				});
				tile.on("pointerout", () => {
					this.hidePhantomCube();
				});
				tile.on("pointerdown", (event: InteractionEvent) => {
					if (event.data.button == 0 && this.modifyingCubes && !this.hasCube(newCubePosition)) {
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
	 * Returns the WorldCell at the given coordinate.
	 */
	private getCell([x, y, z]: Position): WorldCell {
		if (!this.world[x]) {
			this.world[x] = [];
		}
		if (!this.world[x][y]) {
			this.world[x][y] = [];
		}
		if (!this.world[x][y][z]) {
			this.world[x][y][z] = {
				CubeId: null
			};
		}
		return this.world[x][y][z];
	}

	/**
	 * Returns the ID of the Cube at the given location, or null if that cell is empty.
	 */
	private getCubeId(p: Position): number | null {
		return this.getCell(p).CubeId;
	}

	/**
	 * Returns the Cube at the given location, or null if that cell is empty.
	 */
	getCube(p: Position): Cube | null {
		const id = this.getCubeId(p);
		if (id === null) {
			return null;
		}
		return this.cubes[id];
	}

	/**
	 * Checks if a Cube exists at the given location.
	 */
	hasCube(p: Position): boolean {
		return !!this.getCube(p);
	}

	/**
	 * Adds a Cube to the world; throws if a Cube already exists at that
	 * location.
	 */
	addCube(Cube: Cube): void {
		this.addCubeUnmarked(Cube);
		this.markComponents();
	}

	/**
	 * As addCube(), but does not update the component status of the Cubes.
	 */
	addCubeUnmarked(Cube: Cube): void {
		if (this.hasCube(Cube.p)) {
			throw new Error(`Tried to insert Cube on top of another Cube ` +
				`at (${Cube.p})`);
		}
		this.getCell(Cube.p).CubeId = this.cubes.length;
		this.cubes.push(Cube);
		this.pixi.addChild(Cube.pixi);
		this.pipeline.enableShadows(Cube.mesh);
	}

	/**
	 * Moves the given Cube from its current location to the given target
	 * location. Throws if a Cube already exists at the target.
	 */
	moveCube(Cube: Cube, to: Position): void {
		this.moveCubeUnmarked(Cube, to);
		this.markComponents();
	}

	/**
	 * As moveCube(), but does not update the component status of the Cubes.
	 */
	moveCubeUnmarked(Cube: Cube, to: Position): void {
		if (this.hasCube(to)) {
			throw new Error(`Tried to move Cube on top of another Cube ` +
				`at (${to})`);
		}

		const id = this.getCubeId(Cube.p)!;
		this.getCell(Cube.p).CubeId = null;
		this.getCell(to).CubeId = id;
		Cube.p = [...to];
		Cube.updatePosition(0, 0);
	}

	/**
	 * Removes the Cube at the given location.
	 */
	removeCube(Cube: Cube): void {
		this.removeCubeUnmarked(Cube);
		this.markComponents();
	}

	/**
	 * As removeCube(), but does not update the component status of the Cubes.
	 */
	removeCubeUnmarked(Cube: Cube): void {
		this.getCell(Cube.p).CubeId = null;
		this.pixi.removeChild(Cube.pixi);
		this.cubes = this.cubes.filter((b) => b !== Cube);
		// because removing the Cube from this.Cubes changes the indices, we
		// need to update the CubeIds as well
		for (let i = 0; i < this.cubes.length; i++) {
			this.getCell(this.cubes[i].p).CubeId = i;
		}
	}

	/**
	 * Updates the positions of all Cubes in the visualization.
	 */
	updatePositions(time: number, timeStep: number): void {
		this.cubes.forEach((Cube) => {
			Cube.updatePosition(time, timeStep);
		});
		if (this.currentMove) {
			const p = this.currentMove.position;
			this.getCube(p)?.updatePosition(time, timeStep, this.currentMove);
		}
	}

	/**
	 * Puts all Cubes back in their starting location.
	 */
	reset(): void {
		this.cubes.forEach((Cube) => {
			this.getCell(Cube.p).CubeId = null;
		});
		for (let i = 0; i < this.cubes.length; i++) {
			const cube = this.cubes[i];
			cube.p = [...cube.resetPosition];
			this.getCell(cube.p).CubeId = i;
		}
		this.currentMove = null;
		this.markComponents();
	}

	/**
	 * Returns an object with keys 'x', 'X', 'y', etc. with booleans
	 * indicating if the given cell has neighboring Cubes in that direction.
	 */
	hasNeighbors([x, y, z]: Position): { [key: string]: boolean } {
		let has: { [key: string]: boolean } = {};
		has['x'] = this.hasCube([x - 1, y, z]);
		has['X'] = this.hasCube([x + 1, y, z]);
		has['y'] = this.hasCube([x, y - 1, z]);
		has['Y'] = this.hasCube([x, y + 1, z]);
		has['z'] = this.hasCube([x, y, z - 1]);
		has['Z'] = this.hasCube([x, y, z + 1]);
		has['xy'] = this.hasCube([x - 1, y - 1, z]);
		has['xY'] = this.hasCube([x - 1, y + 1, z]);
		has['xz'] = this.hasCube([x - 1, y, z - 1]);
		has['xZ'] = this.hasCube([x - 1, y, z + 1]);
		has['Xy'] = this.hasCube([x + 1, y - 1, z]);
		has['XY'] = this.hasCube([x + 1, y + 1, z]);
		has['Xz'] = this.hasCube([x + 1, y, z - 1]);
		has['XZ'] = this.hasCube([x + 1, y, z + 1]);
		has['yz'] = this.hasCube([x, y - 1, z - 1]);
		has['yZ'] = this.hasCube([x, y - 1, z + 1]);
		has['Yz'] = this.hasCube([x, y + 1, z - 1]);
		has['YZ'] = this.hasCube([x, y + 1, z + 1]);
		return has;
	}

	/**
	 * Returns a neighbor of the give cube
	 */
	getOneNeighbor(cube: Cube): Cube | null {
		const [x, y, z] = cube.p;
		let neighbor = this.getCube([x + 1, y, z]);
		if (neighbor) return neighbor;
		neighbor = this.getCube([x - 1, y, z]);
		if (neighbor) return neighbor;
		neighbor = this.getCube([x, y + 1, z]);
		if (neighbor) return neighbor;
		neighbor = this.getCube([x, y - 1, z]);
		if (neighbor) return neighbor;
		neighbor = this.getCube([x, y, z + 1]);
		if (neighbor) return neighbor;
		neighbor = this.getCube([x, y, z - 1]);
		if (neighbor) return neighbor;
		return null;
	}

	/**
	 * Given a Cube, returns a list of all the moves starting at that Cube that
	 * are valid.
	 *
	 * If the configuration would be disconnected without the given Cube, no
	 * move is valid, so an empty array is returned.
	 */
	validMovesFrom(p: Position): Move[] {
		let moves: Move[] = [];

		if (!this.isConnected(p)) {
			return [];
		}

		for (const direction of moveDirections) {
			const m = new Move(this, p, direction);
			if (m.isValidIgnoreConnectivity()) {
				// already checked connectivity before (yay, efficiency!)
				moves.push(m);
			}
		}

		return moves;
	}

	/**
	 * Returns a move from and to the given coordinates.
	 */
	getMoveTo(source: Cube, target: Position): Move | null {
		const moves = this.validMovesFrom(source.p);
		for (let move of moves) {
			if (move.targetPosition()[0] === target[0] &&
				move.targetPosition()[1] === target[1] &&
				move.targetPosition()[2] === target[2]) {
				return move;
			}
		}
		return null;
	}

	/**
	 * Executes the shortest move path between the given Cubes.
	 *
	 * Throws if no move path is possible.
	 *
	 * @param from The source coordinate, containing the Cube we want to move.
	 * @param to The target coordinate, which should be an empty cell.
	 */
	*shortestMovePath(from: Position, to: Position): MoveGenerator {
		// temporarily remove the origin Cube from the configuration, to avoid
		// invalid moves in the resulting move path (because we could slide
		// along the origin Cube itself)
		const cube = this.getCube(from);
		if (cube === null) {
			throw "Cannot compute move path from non-existing Cube" +
			` (${from})`;
		}
		this.removeCubeUnmarked(cube);

		// do BFS over the move graph
		// seen has positions "1,1,1" (strings) as keys
		let seen: { [key: string]: { 'seen': boolean, 'move': Move | null } } = {};
		let queue: [Position, Move | null][] = [[from, null]];

		while (queue.length !== 0) {
			const location = queue.shift()!;
			if (seen[location[0][0] + "," + location[0][1] + "," + location[0][2]]) {
				continue;
			}
			seen[location[0][0] + "," + location[0][1] + "," + location[0][2]] = {
				'seen': true,
				'move': location[1]
			};
			if (location[0][0] === to[0] && location[0][1] === to[1] && location[0][2] === to[2]) {
				// done!
				break;
			}

			const moves = this.validMovesFrom(location[0]);
			moves.forEach(function (move) {
				queue.push([move.targetPosition(), move]);
			});
		}

		if (!seen[to[0] + "," + to[1] + "," + to[2]]) {
			this.addCube(cube);
			throw "No move path possible from " + from + " to " + to;
		}

		// reconstruct the path
		let path: Move[] = [];
		let c = to;
		while (c[0] !== from[0] || c[1] !== from[1] || c[2] !== from[2]) {
			let move = seen[c[0] + "," + c[1] + "," +c[2]].move!;
			path.unshift(move);
			c = move.sourcePosition();
		}

		// put the origin Cube back
		this.addCube(cube);

		yield* path;
	}

	/**
	 * Returns the degree of the given cube (in 6-connectivity).
	 */
	degree(Cube: Cube): number {
		const has = this.hasNeighbors(Cube.p);
		let count = 0;
		for (let direction of 'xXyYzZ') {
			if (has[direction]) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Checks if the configuration is connected. If the skip parameter is
	 * provided, that Cube is ignored (considered as non-existing).
	 */
	isConnected(skip?: Position): boolean {
		if (!this.cubes.length) {
			return true;
		}

		// do BFS from Cube 0 to check if we can reach all Cubes
		let seen = Array(this.cubes.length).fill(false);
		let seenCount = 0;
		let queue = [0];

		if (skip) {
			// mark the skipped Cube so we won't visit it again
			const skipIndex = this.getCubeId(skip);
			if (skipIndex !== null) {
				seen[skipIndex] = true;
				seenCount++;

				// special case: if we were about to start our BFS with the
				// skipped Cube, then pick another Cube to start with
				// (note that if the configuration has exactly 1 Cube, which
				// is then skipped, the function should return true
				// but that works because the BFS starting at the skipped
				// Cube will not encounter any Cubes)
				if (skipIndex === 0 && this.cubes.length > 1) {
					queue = [1];
				}
			}
		}

		while (queue.length !== 0) {
			const cubeId = queue.shift()!;
			if (seen[cubeId]) {
				continue;
			}

			const cube = this.cubes[cubeId];
			seen[cubeId] = true;
			seenCount++;

			const neighbors = [
				this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
				this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
				this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
			];
			neighbors.forEach(function (c) {
				if (c.CubeId) {
					queue.push(c.CubeId);
				}
			});
		}

		return this.cubes.length === seenCount;
	}

	/**
	 * Returns the minimum and maximum x-, y-, and z-coordinates of Cubes in
	 * the configuration, as an array [minX, minY, minZ, maxX, maxY, maxZ].
	 */
	bounds(): [number, number, number, number, number, number] {
		return [
			this.cubes.map((Cube) => Cube.p[0]).min(),
			this.cubes.map((Cube) => Cube.p[1]).min(),
			this.cubes.map((Cube) => Cube.p[2]).min(),
			this.cubes.map((Cube) => Cube.p[0]).max(),
			this.cubes.map((Cube) => Cube.p[1]).max(),
			this.cubes.map((Cube) => Cube.p[2]).max()
		];
	}

	/**
	 * Returns the amount of cubes necessary to span the complete bounding box twice.
	 */
	boundingBoxSpan(): number {
		const bounds = this.bounds();
		const width = bounds[3] - bounds[0] + 1;
		const depth = bounds[4] - bounds[1] + 1;
		const height = bounds[5] - bounds[2] + 1;
		return 2 * (width + depth + height);
	}

	/**
	 * Colors the Cubes by their connectivity, and set their connectivity
	 * fields
	 */
	markComponents(): void {
		const [components, chunkIds] = this.findComponents();
		const stable = this.findCubeStability();
		for (let i = 0; i < this.cubes.length; i++) {
			if (components[i] === 2) {
				this.cubes[i].setComponentStatus(stable[i] ? ComponentStatus.CHUNK_STABLE : ComponentStatus.CHUNK_CUT);
			} else if (components[i] === 1) {
				this.cubes[i].setComponentStatus(stable[i] ? ComponentStatus.LINK_STABLE : ComponentStatus.LINK_CUT);
			} else if (components[i] === 3) {
				this.cubes[i].setComponentStatus(ComponentStatus.CONNECTOR);
			} else {
				this.cubes[i].setComponentStatus(ComponentStatus.NONE);
			}
			this.cubes[i].setChunkId(chunkIds[i]);
		}
	}
	
	/**
	 * Returns a list of component values for each cube
	 * 
	 * This returns two arrays. The first array indicates for each cube the
	 * component status: 1 and 2 mean that the Cube is in a link or chunk,
	 * respectively, while 3 means that the cube is a connector (that is, in
	 * more than one component). The second array contains the ID of the chunk
	 * the Cube is in. If the Cube is a connector and in more than one chunk,
	 * the chunk ID of the chunk closer to the root is returned. Cubes that
	 * are not in a chunk get chunk ID -1.
	 * 
	 * If the configuration is disconnected, this returns -1 for both component
	 * status and chunk IDs.
	 */
	findComponents(): [number[], number[]] {
		let components = Array(this.cubes.length).fill(-1);
		let chunkIds = Array(this.cubes.length).fill(-1);
		
		// don't try to find components if the configuration is disconnected
		if (!this.cubes.length || !this.isConnected()) {
			return [components, chunkIds];
		}
		
		let edgeChunks = Array();
		edgeChunks.push(Array()); // add the first component
		
		let discovery = Array(this.cubes.length).fill(-1);
		let low = Array(this.cubes.length).fill(-1);
		let parent = Array(this.cubes.length).fill(-1);
		
		let edgeStack = Array();
		
		// Start the search from the first cube in the array
		this.findComponentsRecursive(0, discovery, low, edgeStack, parent, 0, edgeChunks);

		// If the edgeStack is not empty, store all remaining edges in the last component
		while (edgeStack.length > 0) {
			edgeChunks[edgeChunks.length - 1].push(edgeStack.pop());
		}
		
		// Convert the list of edges to a chunk per cube
		// We first remove chunks with 1 or 0 edges
		// The last chunk will always have 0 edges
		let edgeChunksOfPropperSize = Array();
		for (let i = 0; i < edgeChunks.length; i++) {
			if (edgeChunks[i].length > 1) {
				edgeChunksOfPropperSize.push(edgeChunks[i]);
			}
		}
		for (let i = 0; i < edgeChunksOfPropperSize.length; i++) {
			let edgeChunk = edgeChunksOfPropperSize[i];			
			for (let edge = 0; edge < edgeChunk.length; edge++) {
				for (let j = 0; j < edgeChunk[edge].length; j++) {
					let v = edgeChunk[edge][j];
					if (chunkIds[v] === -1) {
						chunkIds[v] = i;
						components[v] = 2;
					} else if (chunkIds[v] !== i) {
						// it already had a different chunk id, so it belongs to multiple chunks
						// and is therefore a connector
						components[v] = 3;
					}
				}
			}
		}
		
		// Let all cubes that are not a chunk or connector be a link.
		for (let i = 0; i < components.length; i++) {
			if (components[i] === -1) {
				components[i] = 1;
			}
		}

		// Find all loose cubes.
		// A loose cube is a cube with only 1 neighbor that is in a chunk
		for (let i = 0; i < components.length; i++) {
			if (components[i] === 1 &&
				this.degree(this.cubes[i]) === 1) {
				const neighbor = this.getOneNeighbor(this.cubes[i])!;
				const neighborIndex = this.getCubeId(neighbor.p)!;
				if (components[neighborIndex] === 2) {
					components[i] = 2;
					chunkIds[i] = chunkIds[neighborIndex];
				}
			}
		}
		
		return [components, chunkIds];
	}
	
	private findComponentsRecursive(u: number, discovery: number[],
									low: number[], edgeStack: [number, number][],
									parent: number[], time: number, edgeChunks: [number, number][][]) {
		// Initialize discovery time and low value
		time += 1;
		discovery[u] = time;
		low[u] = time;
		// the number of children of u in the DFS tree
		let children = 0;
		
		// Go through all neighbors of vertex u.
		// There are 6 neighbor spots to check
		
		let nbrs = this.neighborCubesIDs(u);
		for (let v of nbrs) {
			// v is the current neighbor of u
			
			// if v is not visited yet, recurse
			if (discovery[v] == -1) {
				children++;
				parent[v] = u;
				
				// store the edge in subtree stack
				edgeStack.push([u, v]);
				this.findComponentsRecursive(v, discovery, low, edgeStack, parent, time, edgeChunks);
				
				// check if the subtree rooted at v has a connection to one of the ancestors of u
				if (low[u] > low[v]) {
					low[u] = low[v];
				}
				
				// If u is a cut vertex,
				// pop all edges from stack till the edge u-v
				if ((discovery[u] == 1 && children > 1) || (discovery[u] > 1 && low[v] >= discovery[u])) {
					while (edgeStack[edgeStack.length - 1][0] != u || edgeStack[edgeStack.length - 1][1] != v) {
						edgeChunks[edgeChunks.length - 1].push(edgeStack.pop() as [number, number]);
					}
					edgeChunks[edgeChunks.length - 1].push(edgeStack.pop() as [number, number]);
					// start a new chunk
					edgeChunks.push(Array());
				}
			} else if (v != parent[u] && discovery[v] < discovery[u]) {
				// If there is a back edge, update the low value of u
				if (low[u] > discovery[v]) {
					low[u] = discovery[v];
				}
				edgeStack.push([u, v]);
			}
		}
	}
	
	private neighborCubesIDs(i: number) : number[] {
		let nbrs = Array();
		let x = this.cubes[i].p[0];
		let y = this.cubes[i].p[1];
		let z = this.cubes[i].p[2];
		if (this.hasCube([x - 1, y, z])) {
			nbrs.push(this.getCubeId([x - 1, y, z]));
		}
		if (this.hasCube([x + 1, y, z])) {
			nbrs.push(this.getCubeId([x + 1, y, z]));
		}
		if (this.hasCube([x, y- 1, z])) {
			nbrs.push(this.getCubeId([x, y - 1, z]));
		}
		if (this.hasCube([x, y + 1, z])) {
			nbrs.push(this.getCubeId([x, y + 1, z]));
		}
		if (this.hasCube([x, y, z - 1])) {
			nbrs.push(this.getCubeId([x, y, z - 1]));
		}
		if (this.hasCube([x, y, z + 1])) {
			nbrs.push(this.getCubeId([x, y, z + 1]));
		}
		return nbrs;
	}
	
	/**
	 * Determines which Cubes in the configuration are stable.
	 *
	 * Returns a list of booleans for each Cube: true if the corresponding Cube
	 * is stable; false if it is a cut Cube.
	 */
	findCubeStability(): boolean[] {
		if (!this.cubes.length) {
			return [];
		}
		let seen = Array(this.cubes.length).fill(false);
		let parent: (number | null)[] = Array(this.cubes.length).fill(null);
		let depth = Array(this.cubes.length).fill(-1);
		let low = Array(this.cubes.length).fill(-1);
		let stable = Array(this.cubes.length).fill(true);
		this.findCubeStabilityRecursive(0, 0, seen, parent, depth, low, stable);
		return stable;
	}

	private findCubeStabilityRecursive(i: number, d: number,
		seen: boolean[], parent: (number | null)[],
		depth: number[], low: number[],
		stable: boolean[]): void {

		seen[i] = true;
		depth[i] = d;
		low[i] = d;
		let cube = this.cubes[i];

		const neighbors = [
			this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
			this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
			this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
			this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
			this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
			this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
		];
		const self = this;
		let cutCube = false;
		let childCount = 0;
		neighbors.forEach(function (c) {
			if (c.CubeId !== null && !seen[c.CubeId]) {
				parent[c.CubeId] = i;
				self.findCubeStabilityRecursive(c.CubeId, d + 1,
					seen, parent, depth, low, stable);
				childCount++;
				if (low[c.CubeId] >= depth[i]) {
					cutCube = true;
				}
				low[i] = Math.min(low[i], low[c.CubeId]);
			} else if (c.CubeId !== null && c.CubeId != parent[i]) {
				low[i] = Math.min(low[i], depth[c.CubeId]);
			}
		});
		if (parent[i] === null) {
			stable[i] = childCount <= 1;
		} else {
			stable[i] = !cutCube;
		}
	}

	/**
	 * Given a Cube, determines the number of Cubes in its descendant(s),
	 * Viewed from a different Cube called "root"
	 */
	capacity(s: Cube, root: Cube): number {
		// do a BFS from the root, counting the Cubes, but disregard s
				
		let seen = Array(this.cubes.length).fill(false);
		const bId = this.getCubeId(s.p)!;
		seen[bId] = true;
		let cubeCount = 1;
		
		const rootId = this.getCubeId(root.p)!
		let queue = [rootId];
		
		while (queue.length !== 0) {
			const cubeId = queue.shift()!;
			if (seen[cubeId]) {
				continue;
			}
			
			const cube = this.cubes[cubeId];
			seen[cubeId] = true;
			if (bId !== cubeId) {
				cubeCount++;
			}
			
			const nbrs = [
				this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
				this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
				this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
			];
			
			nbrs.forEach(function (c) {
				if (c.CubeId !== null) {
					queue.push(c.CubeId);
				}	
			});
		}
		
		return this.cubes.length - cubeCount;
	}

	/**
	 * Return an array with for each Cube if it contributes to the capacity of s
	 */
	capacityCubes(s: Cube, root: Cube): boolean[] {
		// do a BFS from the root, counting the Cubes, but disregard s

		let seen = Array(this.cubes.length).fill(false);
		const bId = this.getCubeId(s.p)!;
		seen[bId] = true;

		const rootId = this.getCubeId(root.p)!
		let queue = [rootId];

		while (queue.length !== 0) {
			const cubeId = queue.shift()!;
			if (seen[cubeId]) {
				continue;
			}

			const cube = this.cubes[cubeId];
			seen[cubeId] = true;

			const nbrs = [
				this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
				this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
				this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
				this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
			];

			nbrs.forEach(function (c) {
				if (c.CubeId !== null) {
					queue.push(c.CubeId);
				}
			});
		}
		
		return seen.map(c => !c);
	}
	
	/**
	 * Determines if the configuration is xyz-monotone.
	 */
	isXYZMonotone(): boolean {
		const [minX, minY, minZ, , , ] = this.bounds();

		for (const cube of this.cubes) {
			if (cube.p[0] !== minX &&
				!this.hasCube([cube.p[0] - 1, cube.p[1], cube.p[2]])) {
				return false;
			}
			if (cube.p[1] !== minY &&
				!this.hasCube([cube.p[0], cube.p[1] - 1, cube.p[2]])) {
				return false;
			}
			if (cube.p[2] !== minZ &&
				!this.hasCube([cube.p[0], cube.p[1], cube.p[2] - 1])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Generates a JSON string from this world.
	 */
	serialize(): string {
		let cubes: any = [];
		this.cubes.forEach((Cube) => {
			cubes.push({
				'x': Cube.resetPosition[0],
				'y': Cube.resetPosition[1],
				'z': Cube.resetPosition[2],
				'color': [Cube.color.r, Cube.color.g, Cube.color.b]
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
		cubes.forEach((Cube: any) => {
			let color = Color.BLUE;
			if (Cube.hasOwnProperty('color')) {
				color = new Color(Cube['color'][0],
					Cube['color'][1], Cube['color'][2]);
			}
			this.addCube(new Cube(this, [Cube['x'], Cube['y'], Cube['z']], color));
		});
	}
}

export { MoveGenerator, World, Move, moveDirections };
