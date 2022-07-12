import { World} from '../world';
import { Algorithm } from "./algorithm";
import {MoveGenerator} from "../move";
import {Configuration} from "../configuration";

class CustomAlgorithm extends Algorithm {
	
	constructor(public world: World) {
		super(world);
	}

	override *execute(): MoveGenerator {
		const moveJson = window.prompt('Input a move sequence (as a JSON array containing moves of the form [x1, y1, z1, x2, y2, z2]):')!;
		let sequence: any;
		try {
			sequence = JSON.parse(moveJson);
		} catch (e) {
			throw new Error('JSON string was invalid');
		}
		printStep(`Running custom move sequence`);

		for (let move of sequence) {
			const cube = this.configuration.getCube([move[0], move[1], move[2]]);
			if (!cube) {
				throw new Error("Custom move path tried to move a non-existing cube at " +
					`(${move[0]}, ${move[1]}, ${move[2]})`);
			}
			if (this.configuration.hasCube([move[3], move[4], move[5]])) {
				throw new Error("Custom move path tried to move a cube on top of another Cube at " +
					`(${move[3]}, ${move[4]}, ${move[5]})`);
			}
			const m = this.configuration.getMoveTo(cube, [move[3], move[4], move[5]]);
			if (m === null) {
				throw new Error("Custom move path tried to do a move that is invalid in the sliding cube model: " +
					`(${move[0]}, ${move[1]}, ${move[2]}) \u2192 (${move[3]}, ${move[4]}, ${move[5]})`);
			}
			yield m;
		}

		printStep("Move sequence finished");
	}
}

export { CustomAlgorithm };
