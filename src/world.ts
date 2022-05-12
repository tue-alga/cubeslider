import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d';
import { Viewport } from 'pixi-viewport';

import { Color, ComponentStatus, Position, Square } from './square';

/**
 * A single cell in the grid. Contains either a cube (with the ID stored) or
 * nothing (\c null).
 */
type WorldCell = {
	squareId: number | null;
};

/**
 * An generator of moves.
 */
type Algorithm = Generator<Move, void, undefined>;

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
		if (this.world.getSquare(this.targetPosition())) {
			return false;
		}

		let has = this.world.hasNeighbors(this.position);

		// TODO ADAPT TO 3D
		switch (this.direction) {
			case "N":
				return (has['W'] && has['NW']) || (has['E'] && has['NE']);
			case "E":
				return (has['N'] && has['NE']) || (has['S'] && has['SE']);
			case "S":
				return (has['W'] && has['SW']) || (has['E'] && has['SE']);
			case "W":
				return (has['N'] && has['NW']) || (has['S'] && has['SW']);

			default:
				// for corner moves, need to ensure that there is no square in
				// the first direction (which would be in our way) and there
				// is a square in the second direction (that we can pivot along)
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
	 * Computes coordinates of a square executing this move at the given time
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
		const square = this.world.getSquare(this.position);
		if (!square) {
			throw new Error(`Tried to move non-existing square ` +
				`at (${this.position[0]}, ${this.position[1]})`);
		}

		this.world.moveSquare(square, this.targetPosition());
	}

	toString(): string {
		const from = this.position;
		const to = this.targetPosition();
		return `(${from[0]}, ${from[1]}) \u2192 (${to[0]}, ${to[1]})`;
	}
}

/**
 * Collection of squares on the grid.
 */
class World {

	world: WorldCell[][][] = [];
	pixi = new PIXI3D.Container3D();
	squares: Square[] = [];
	currentMove: Move | null = null;
	showComponentMarks = false;

	ground: PIXI3D.Mesh3D;
	shadowLight: PIXI3D.ShadowCastingLight;
	phantomCube: PIXI3D.Mesh3D;

	pipeline: PIXI3D.StandardPipeline;

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

		this.ground = this.pixi.addChild(PIXI3D.Mesh3D.createPlane());
		this.ground.position.y = -0.5;
		this.ground.scale.set(20);
		//this.ground.material = material;

		this.pipeline = renderer.plugins.pipeline;
		this.pipeline.enableShadows(this.ground, this.shadowLight);

		// phantom cube for showing where a new cube will be added
		let material = new PIXI3D.StandardMaterial();
		material.baseColor = new PIXI3D.Color(1, 1, 1, 0.4);
		material.exposure = 1.5;
		material.metallic = 0.3;
		material.roughness = 0.5;
		material.alphaMode = PIXI3D.StandardMaterialAlphaMode.blend;
		// @ts-ignore
		this.phantomCube = PIXI3D.Model.from(PIXI.Loader.shared.resources["cube.gltf"]['gltf']).meshes[0];
		this.phantomCube.material = material;
		this.phantomCube.visible = false;
		this.pixi.addChild(this.phantomCube);
	}

	showPhantomCube([x, y, z]: Position): void {
		this.pixi.removeChild(this.phantomCube);
		this.pixi.addChild(this.phantomCube);
		this.phantomCube.position.set(x, z, -y);
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
				squareId: null
			};
		}
		return this.world[x][y][z];
	}

	/**
	 * Returns the ID of the square at the given location, or null if that cell is empty.
	 */
	private getSquareId(p: Position): number | null {
		return this.getCell(p).squareId;
	}

	/**
	 * Returns the square at the given location, or null if that cell is empty.
	 */
	getSquare(p: Position): Square | null {
		const id = this.getSquareId(p);
		if (id === null) {
			return null;
		}
		return this.squares[id];
	}

	/**
	 * Checks if a square exists at the given location.
	 */
	hasSquare(p: Position): boolean {
		return !!this.getSquare(p);
	}

	/**
	 * Adds a square to the world; throws if a square already exists at that
	 * location.
	 */
	addSquare(square: Square): void {
		this.addSquareUnmarked(square);
		//this.markComponents();
	}

	/**
	 * As addSquare(), but does not update the component status of the squares.
	 */
	addSquareUnmarked(square: Square): void {
		if (this.hasSquare(square.p)) {
			throw new Error(`Tried to insert square on top of another square ` +
				`at (${square.p})`);
		}
		this.getCell(square.p).squareId = this.squares.length;
		this.squares.push(square);
		this.pixi.addChild(square.pixi);
		this.pipeline.enableShadows(square.mesh);
	}

	/**
	 * Moves the given square from its current location to the given target
	 * location. Throws if a square already exists at the target.
	 */
	moveSquare(square: Square, to: Position): void {
		this.moveSquareUnmarked(square, to);
		//this.markComponents();
	}

	/**
	 * As moveSquare(), but does not update the component status of the squares.
	 */
	moveSquareUnmarked(square: Square, to: Position): void {
		if (this.hasSquare(to)) {
			throw new Error(`Tried to move square on top of another square ` +
				`at (${to})`);
		}

		const id = this.getSquareId(square.p)!;
		this.getCell(square.p).squareId = null;
		this.getCell(to).squareId = id;
		square.p = [...to];
		square.updatePosition(0, 0);
	}

	/**
	 * Removes the square at the given location.
	 */
	removeSquare(square: Square): void {
		this.removeSquareUnmarked(square);
		//this.markComponents();
	}

	/**
	 * As removeSquare(), but does not update the component status of the squares.
	 */
	removeSquareUnmarked(square: Square): void {
		this.getCell(square.p).squareId = null;
		this.pixi.removeChild(square.pixi);
		this.squares = this.squares.filter((b) => b !== square);
		// because removing the square from this.squares changes the indices, we
		// need to update the squareIds as well
		for (let i = 0; i < this.squares.length; i++) {
			this.getCell(this.squares[i].p).squareId = i;
		}
	}

	/**
	 * Updates the positions of all squares in the visualization.
	 */
	updatePositions(time: number, timeStep: number): void {
		this.squares.forEach((square) => {
			square.updatePosition(time, timeStep);
		});
		if (this.currentMove) {
			const p = this.currentMove.position;
			this.getSquare(p)?.updatePosition(time, timeStep, this.currentMove);
		}
	}

	/**
	 * Puts all squares back in their starting location.
	 */
	reset(): void {
		this.squares.forEach((square) => {
			this.getCell(square.p).squareId = null;
		});
		for (let i = 0; i < this.squares.length; i++) {
			const square = this.squares[i];
			square.p = [...square.resetPosition];
			square.dots = [];
			this.getCell(square.p).squareId = i;
		}
		this.currentMove = null;
		//this.markComponents();
	}

	/**
	 * Returns an object with keys 'x', 'X', 'y', etc. with booleans
	 * indicating if the given cell has neighboring squares in that direction.
	 */
	hasNeighbors([x, y, z]: Position): { [key: string]: boolean } {
		let has: { [key: string]: boolean } = {};
		has['x'] = this.hasSquare([x - 1, y, z]);
		has['X'] = this.hasSquare([x + 1, y, z]);
		has['y'] = this.hasSquare([x, y - 1, z]);
		has['Y'] = this.hasSquare([x, y + 1, z]);
		has['z'] = this.hasSquare([x, y, z - 1]);
		has['Z'] = this.hasSquare([x, y, z + 1]);
		return has;
	}

	/**
	 * Given a square, returns a list of all the moves starting at that square that
	 * are valid.
	 *
	 * If the configuration would be disconnected without the given square, no
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
	getMoveTo(source: Square, target: Position): Move | null {
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
	 * Executes the shortest move path between the given squares.
	 *
	 * Throws if no move path is possible.
	 *
	 * @param from The source coordinate, containing the square we want to move.
	 * @param to The target coordinate, which should be an empty cell.
	 */
	*shortestMovePath(from: Position, to: Position): Algorithm {

		// temporarily remove the origin square from the configuration, to avoid
		// invalid moves in the resulting move path (because we could slide
		// along the origin square itself)
		const square = this.getSquare(from);
		if (square === null) {
			throw "Cannot compute move path from non-existing square" +
			` (${from})`;
		}
		this.removeSquareUnmarked(square);

		// do BFS over the move graph
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
			throw "No move path possible from " + from + " to " + to;
		}

		// reconstruct the path
		let path: Move[] = [];
		let c = to;
		while (c[0] !== from[0] || c[1] !== from[1] || c[2] !== from[2]) {
			let move = seen[c[0] + "," + c[1]].move!;
			path.unshift(move);
			c = move.sourcePosition();
		}

		// put the origin square back
		this.addSquare(square);

		yield* path;
	}

	/**
	 * Returns the degree of the given cube (in 6-connectivity).
	 */
	degree(square: Square): number {
		const has = this.hasNeighbors(square.p);
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
	 * provided, that square is ignored (considered as non-existing).
	 */
	isConnected(skip?: Position): boolean {
		if (!this.squares.length) {
			return true;
		}

		// do BFS from square 0 to check if we can reach all squares
		let seen = Array(this.squares.length).fill(false);
		let seenCount = 0;
		let queue = [0];

		if (skip) {
			// mark the skipped square so we won't visit it again
			const skipIndex = this.getSquareId(skip);
			if (skipIndex !== null) {
				seen[skipIndex] = true;
				seenCount++;

				// special case: if we were about to start our BFS with the
				// skipped square, then pick another square to start with
				// (note that if the configuration has exactly 1 square, which
				// is then skipped, the function should return true
				// but that works because the BFS starting at the skipped
				// square will not encounter any squares)
				if (skipIndex === 0 && this.squares.length > 1) {
					queue = [1];
				}
			}
		}

		while (queue.length !== 0) {
			const squareId = queue.shift()!;
			if (seen[squareId]) {
				continue;
			}

			const square = this.squares[squareId];
			seen[squareId] = true;
			seenCount++;

			const neighbors = [
				this.getCell([square.p[0] - 1, square.p[1], square.p[2]]),
				this.getCell([square.p[0] + 1, square.p[1], square.p[2]]),
				this.getCell([square.p[0], square.p[1] - 1, square.p[2]]),
				this.getCell([square.p[0], square.p[1] + 1, square.p[2]]),
				this.getCell([square.p[0], square.p[1], square.p[2] - 1]),
				this.getCell([square.p[0], square.p[1], square.p[2] + 1])
			];
			neighbors.forEach(function (c) {
				if (c.squareId) {
					queue.push(c.squareId);
				}
			});
		}

		return this.squares.length === seenCount;
	}

	/**
	 * Returns the minimum and maximum x-, y-, and z-coordinates of squares in
	 * the configuration, as an array [minX, minY, minZ, maxX, maxY, maxZ].
	 */
	bounds(): [number, number, number, number, number, number] {
		return [
			this.squares.map((square) => square.p[0]).min(),
			this.squares.map((square) => square.p[1]).min(),
			this.squares.map((square) => square.p[2]).min(),
			this.squares.map((square) => square.p[0]).max(),
			this.squares.map((square) => square.p[1]).max(),
			this.squares.map((square) => square.p[2]).max()
		];
	}

	/**
	 * Determines which squares in the configuration are stable.
	 *
	 * Returns a list of booleans for each square: true if the corresponding square
	 * is stable; false if it is a cut square.
	 */
	findSquareStability(): boolean[] {
		if (!this.squares.length) {
			return [];
		}
		let seen = Array(this.squares.length).fill(false);
		let parent: (number | null)[] = Array(this.squares.length).fill(null);
		let depth = Array(this.squares.length).fill(-1);
		let low = Array(this.squares.length).fill(-1);
		let stable = Array(this.squares.length).fill(true);
		this.findSquareStabilityRecursive(0, 0, seen, parent, depth, low, stable);
		return stable;
	}

	private findSquareStabilityRecursive(i: number, d: number,
		seen: boolean[], parent: (number | null)[],
		depth: number[], low: number[],
		stable: boolean[]): void {

		seen[i] = true;
		depth[i] = d;
		low[i] = d;
		let square = this.squares[i];

		const neighbors = [
			this.getCell([square.p[0] - 1, square.p[1], square.p[2]]),
			this.getCell([square.p[0] + 1, square.p[1], square.p[2]]),
			this.getCell([square.p[0], square.p[1] - 1, square.p[2]]),
			this.getCell([square.p[0], square.p[1] + 1, square.p[2]]),
			this.getCell([square.p[0], square.p[1], square.p[2] - 1]),
			this.getCell([square.p[0], square.p[1], square.p[2] + 1])
		];
		const self = this;
		let cutSquare = false;
		let childCount = 0;
		neighbors.forEach(function (c) {
			if (c.squareId !== null && !seen[c.squareId]) {
				parent[c.squareId] = i;
				self.findSquareStabilityRecursive(c.squareId, d + 1,
					seen, parent, depth, low, stable);
				childCount++;
				if (low[c.squareId] >= depth[i]) {
					cutSquare = true;
				}
				low[i] = Math.min(low[i], low[c.squareId]);
			} else if (c.squareId !== null && c.squareId != parent[i]) {
				low[i] = Math.min(low[i], depth[c.squareId]);
			}
		});
		if (parent[i] === null) {
			stable[i] = childCount <= 1;
		} else {
			stable[i] = !cutSquare;
		}
	}

	/**
	 * Determines if the configuration is xyz-monotone.
	 */
	isXYZMonotone(): boolean {
		const [minX, minY, minZ, , , ] = this.bounds();

		for (const square of this.squares) {
			if (square.p[0] !== minX &&
				!this.hasSquare([square.p[0] - 1, square.p[1], square.p[2]])) {
				return false;
			}
			if (square.p[1] !== minY &&
				!this.hasSquare([square.p[0], square.p[1] - 1, square.p[2]])) {
				return false;
			}
			if (square.p[2] !== minZ &&
				!this.hasSquare([square.p[0], square.p[1], square.p[2] - 1])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Generates a JSON string from this world.
	 */
	serialize(): string {
		let squares: any = [];
		this.squares.forEach((square) => {
			squares.push({
				'x': square.resetPosition[0],
				'y': square.resetPosition[1],
				'z': square.resetPosition[2],
				'color': [square.color.r, square.color.g, square.color.b]
			});
		});
		let obj: any = {
			'_version': 1,
			'squares': squares
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

		let squares: any[] = obj[version === 1 ? 'cubes' : 'squares'];
		squares.forEach((square: any) => {
			let color = Color.BLUE;
			if (square.hasOwnProperty('color')) {
				color = new Color(square['color'][0],
					square['color'][1], square['color'][2]);
			}
			this.addSquare(new Square(this, [square['x'], square['y'], square['z']], color));
		});
	}
}

export { Algorithm, World, Move, moveDirections };
