import {Algorithm} from "./algorithm";
import {Move, moveDirections, MoveGenerator} from "../move";
import {Cube, Position, StableStatus} from "../cube";

class PillarAlgorithm extends Algorithm {

    * execute(): MoveGenerator {
        printStep("Pillar algorithm");
        while (!this.configuration.isXYZMonotone()) {
            let cubesOrdered: Cube[] = [...this.configuration.cubes].sort((c1, c2) => this.cost(c2.p) - this.cost(c1.p));

            let a = this.operationA(cubesOrdered, true);
            if (a.length > 0) {
                printMiniStep(`A move from ${a[0].position} to ${a[0].targetPosition()}`)
                yield a[0]; // a[0] because this is a list of potential moves. However, the function stops after the first move found, so this contains only a single element
                continue;
            }
            let b = this.operationB(cubesOrdered, true);
            if (b.length > 0) {
                printMiniStep(`B move from ${b[0][0].position} to ${b[0][b[0].length-1].targetPosition()}`)
                yield* b[0];
                continue;
            }
            let c = this.operationC(cubesOrdered, true);
            if (c.length > 0) {
                printMiniStep(`C move from ${c[0][0].position} to ${c[0][0].targetPosition()}`)
                yield* c[0];
                continue;
            }
            let d = this.operationD(cubesOrdered, true);
            if (d.length > 0) {
                printMiniStep(`D move from ${d[0][0].position} to ${d[0][0].targetPosition()}`)
                yield* d[0];
                continue;
            }
            let e = this.operationE(cubesOrdered, true);
            if (e.length > 0) {
                printMiniStep(`E move from ${e[0][0].position.slice(0, 2)} to ${e[0][0].targetPosition().slice(0, 2)}`)
                yield* e[0];
                continue;
            }
            let fg = this.operationFG(cubesOrdered, true);
            if (fg.length > 0) {
                printMiniStep(`F/G move from ${fg[0][0].position} to ${fg[0][0].targetPosition()}`)
                yield* fg[0];
                continue;
            }

            let clear = this.findClearLowComponent(false);
            let clearLowComponentUndef = clear.component;
            let clearingPillarUndef = clear.pillar;
            // only perform H/I moves if the clear low component actually exists and is too small to reach the origin.
            if (clearLowComponentUndef && clearingPillarUndef && clearLowComponentUndef.length > 0 && clearingPillarUndef.length > 0 &&
                clearLowComponentUndef!.length < clearingPillarUndef![0][0] + clearingPillarUndef![0][1]) {
                
                let hi = this.operationHI(clearLowComponentUndef!, clearingPillarUndef!);
                if (hi) {
                    printMiniStep(`H/I move from ${hi[0].position.slice(0, 2)} to ${hi[0].targetPosition().slice(0, 2)}`);
                    yield* hi;
                    continue;
                }
            } else {
                // the only low component is the root component.
                // a, b, c, d, f, and g operations are possible also on low components
                // we only need to fix the e and h "pillar shove" moves.
                let lowComponentCubesOrdered = this.configuration.cubes
                    .filter(c => c.p[2] === this.configuration.bounds()[2]);
                lowComponentCubesOrdered = [...lowComponentCubesOrdered].sort((c1, c2) => this.cost(c2.p) - this.cost(c1.p));
                
                let e = this.operationELow(lowComponentCubesOrdered, [0, 0, 0], true);
                if (e.length > 0) {
                    printMiniStep(`Low E move from ${e[0][0].position.slice(0, 2)} to ${e[0][0].targetPosition().slice(0, 2)}`)
                    yield* e[0];
                    continue;
                }
                
                let clear = this.findClearLowComponent(true);
                let clearLowComponentUndef = clear.component;
                let clearingPillarUndef = clear.pillar;
                if (clearLowComponentUndef && clearingPillarUndef && clearLowComponentUndef.length > 0 && clearingPillarUndef.length > 0) {
                    let hi = this.operationHIflat(clearLowComponentUndef!, clearingPillarUndef!);
                    if (hi) {
                        printMiniStep(`I move in 2D from ${hi[0].position[0]} to ${hi[0].targetPosition()[0]}`);
                        yield* hi;
                        continue;
                    }
                }
                
            }

            
            throw new Error("Not XYZ monotone, but no move is found.");
        }
    }

    /**
     * The potential function of a cube as described in the paper.
     * This assumes the coordinates of cubes are bigger or equal to 0.
     * @param p
     */
    cost(p: Position): number {
        let [minX, minY, minZ] = this.configuration.bounds().slice(3);
        
        let adjustedP = [p[0] - minX, p[1] - minY, p[2] - minZ];
        
        let weight = 0
        if (adjustedP[2] > 1) weight = 5;
        else if (adjustedP[2] == 1) weight = 4;
        else if (adjustedP[1] > 1) weight = 3;
        else if (adjustedP[1] == 1) weight = 2;
        else weight = 1;
        return weight * (adjustedP[0] + 2*adjustedP[1] + 4*adjustedP[2]);
    }
    
    /**
     * From all possible operations of type (a): top cube convex transition down,
     * this finds the move that moves the cube with the highest cost
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     */
    operationA(cubesOrdered: Cube[], stopAfterFirst: boolean): Move[] | [] {
        let potentialMoves: Move[] = [];
        
        for (let cube of cubesOrdered) {
            // check if the cube is stable
            if (cube.stableStatus !== StableStatus.STABLE) continue;
            let p = cube.p;
            let sides: [number, number][] = [[p[0], p[1] - 1], [p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] + 1]];
            for (let side of sides) {
                let target: Position = [...side, p[2] - 1];
                if (!this.configuration.hasCube([...side, p[2]]) &&
                        !this.configuration.hasCube([p[0], p[1], p[2] + 1]) &&
                        !this.configuration.hasCube(target) &&
                        this.configuration.boundingBoxContains(target)) {
                    let direction = Move.getDirection(p, [...side, p[2] - 1]);
                    let potentialMove = new Move(this.configuration, p, direction);
                    if (potentialMove.isValid()) {
                        potentialMoves.push(potentialMove);
                        if (stopAfterFirst) {
                            return potentialMoves;
                        }
                    }
                }
            }
        }
        return potentialMoves;
    }
    
    unlockPossible(p: Position, side: [number, number]): boolean {
        return this.configuration.hasCube(p) &&                        // there is actually a cube
            this.configuration.isSingleConnectionCube(p) &&            // single connection
            !this.configuration.hasCube([...side, p[2]]) &&         // there is no cube on the same height next to it
            this.configuration.hasCube([p[0], p[1], p[2] - 1]) &&   // there is a cube below it
            this.configuration.hasCube([...side, p[2] - 1]);        // there is a cube next to it but one lower.
    }
    
    unlockMove(p: Position, side: [number, number]): Move {
        let unlockDir = Move.getDirection(p, [...side, p[2]]);
        return new Move(this.configuration, p, unlockDir);
    }
    
    unlockPossibleFlat(p: Position, side: number): boolean {
        return this.configuration.hasCube(p) &&
            this.configuration.isSingleConnectionCube(p) &&
            !this.configuration.hasCube([side, p[1], p[2]]) &&
            this.configuration.hasCube([p[0], p[1] - 1, p[2]]) &&
            this.configuration.hasCube([side, p[1] - 1, p[2]]);
    }
    
    unlockMoveFlat(p: Position, side: number): Move {
        let unlockDir = Move.getDirection(p, [side, p[1], p[2]]);
        return new Move(this.configuration, p, unlockDir);
    }

    /**
     * From all possible operations of type (b): corner move underneath another pillar,
     * this finds the move that moves the cube with the highest cost
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     */
    operationB(cubesOrdered: Cube[], stopAfterFirst: boolean): Move[][] | [] {
        let potentialMoves: Move[][] = [];

        for (let cube of cubesOrdered) {
            let p = cube.p;
            let positionBelowP: Position = [p[0], p[1], p[2] - 1];
            let positionAboveP: Position = [p[0], p[1], p[2] + 1];
            if (this.configuration.hasCube(positionBelowP)) {
                let sides: [number, number][] = [[p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]];
                for (let side of sides) {
                    let target: Position = [...side, p[2] - 1];
                    if (this.configuration.hasCube([...side, p[2]]) &&
                        !this.configuration.hasCube(target)) {
                        // move is valid if either the pair is not a cutpair, or if it is, then it is not a cut triple with the unlocking cube
                        if (this.configuration.isConnected([], [p, positionBelowP]) ||
                            (this.configuration.isConnected([], [p, positionBelowP, positionAboveP])) && this.unlockPossible(positionAboveP, side)) {
                            let potentialMove: Move[] = [];
                            // if an unlock is possible, just do it, dont check if it is actually necessary
                            if (this.unlockPossible(positionAboveP, side)) {
                                potentialMove.push(this.unlockMove(positionAboveP, side));
                            }
                            // no cube at the target, cube above the target, cube below p is stable
                            // so corner move is valid
                            let firstMoveDir = Move.getDirection(positionBelowP, target);
                            let firstMove = new Move(this.configuration, positionBelowP, firstMoveDir);
                            let secondMoveDir = Move.getDirection(p, positionBelowP);
                            let secondMove = new Move(this.configuration, p, secondMoveDir);
                            potentialMove.push(firstMove);
                            potentialMove.push(secondMove);
                            potentialMoves.push(potentialMove);
                            if (stopAfterFirst) {
                                return potentialMoves
                            }
                        }
                    }
                }
            }
        }
        return potentialMoves;
    }

    /**
     * From all possible operations of type (c): free cube moves straight down,
     * this finds the move that moves the cube with the highest cost
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     */
    operationC(cubesOrdered: Cube[], stopAfterFirst: boolean): Move[][] | [] {
        let potentialMoves: Move[][] = [];
        
        for (let cube of cubesOrdered) {
            let p = cube.p;
            let positionBelowP: Position = [p[0], p[1], p[2] - 1];
            let positionAboveP: Position = [p[0], p[1], p[2] + 1];
            if (!this.configuration.hasCube(positionBelowP)) {
                let sides: [number, number][] = [[p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]];
                for (let side of sides) {
                    if (!(this.configuration.hasCube([...side, p[2]]) && this.configuration.hasCube([...side, p[2] - 1]))) continue;
                    if (!(this.configuration.getCube(p)!.stableStatus === StableStatus.STABLE ||
                        (this.configuration.isConnected([], [p, positionAboveP])))) continue;
                    // the move is possible: the cube is not a cut cube (maybe together with the cube above it in case of an unlock)
                    let potentialMove: Move[] = [];
                    if (this.unlockPossible(positionAboveP, side)) {
                        potentialMove.push(this.unlockMove(positionAboveP, side));
                    }
                    let moveDir = Move.getDirection(p, positionBelowP);
                    let move = new Move(this.configuration, p, moveDir);
                    potentialMove.push(move);
                    
                    potentialMoves.push(potentialMove);
                    if (stopAfterFirst) {
                        return potentialMoves;
                    }
                }
            }
        }
        return potentialMoves;
    }

    /**
     * From all possible operations of type (d): bottom of pillar does convex transition to go underneath neighboring pillar,
     * this finds the move that moves the cube with the highest cost
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     */
    operationD(cubesOrdered: Cube[], stopAfterFirst: boolean): Move[][] | [] {
        let potentialMoves: Move[][] = [];
        
        for (let cube of cubesOrdered) {
            let p = cube.p;
            let positionBelowP: Position = [p[0], p[1], p[2] - 1];
            let positionAboveP: Position = [p[0], p[1], p[2] + 1];
            if (this.configuration.hasCube(positionBelowP) || p[2] <= 0) continue;
            let sides: [number, number][] = [[p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]];
            for (let side of sides) {
                if (!(this.configuration.hasCube([...side, p[2]]) &&
                        !this.configuration.hasCube([...side, positionBelowP[2]]))) continue;
                if (!(this.configuration.getCube(p)!.stableStatus === StableStatus.STABLE ||
                    (this.configuration.isConnected([], [p, positionAboveP])))) continue;
                // the move is possible, possibly after an unlock
                let potentialMove: Move[] = []
                if (this.unlockPossible(positionAboveP, side)) {
                    potentialMove.push(this.unlockMove(positionAboveP, side));
                }
                let moveDir = Move.getDirection(p, [...side, p[2] - 1]);
                // the getDirection function prioritises x, then y, then z.
                // here, we want to go z first
                moveDir = moveDir[1] + moveDir[0];
                let move = new Move(this.configuration, p, moveDir);
                potentialMove.push(move);
                potentialMoves.push(potentialMove);
                if (stopAfterFirst) {
                    return potentialMoves;
                }
            }
        }
        return potentialMoves;
    }

    /**
     * Finds a non cut pillar. The pillars are listed from bottom to top.
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     * @param flat if false, perform it in 3d, if true, perform the check in 2d
     * @param fixedCube a cube that is always a cut cube. Not necessarily defined
     */
    nonCutPillar(cubesOrdered: Cube[], stopAfterFirst: boolean, flat: boolean = false, fixedCube: Position | undefined = undefined): Position[][] {
        
        let nonCutPillars: Position[][] = []
        
        for (let cube of cubesOrdered) {
            let p = cube.p;
            if (!flat && this.configuration.hasCube([p[0], p[1], p[2] - 1])) continue; // only take cubes with no cube below
            if (flat && this.configuration.hasCube([p[0], p[1] - 1, p[2]])) continue;
            
            let pillar: Position[] = []
            
            let cutPillar = false;
            while (this.configuration.hasCube(p)) {
                // the fixedcube can never be part of a non cut pillar
                if (fixedCube && (p[0] === fixedCube[0] && p[1] === fixedCube[1] && p[2] === fixedCube[2])) {
                    cutPillar = true;
                    break;
                }
                    


                pillar.push(p);

                if (!flat) {
                    p = [p[0], p[1], p[2] + 1];
                } else {
                    p = [p[0], p[1] + 1, p[2]];
                }
            }
            if (cutPillar) continue;
            
            // we have a pillar
            if (this.configuration.isConnected([], pillar, cubesOrdered)) {
                // non cut pillar
                nonCutPillars.push(pillar);
                if (stopAfterFirst) {
                    return nonCutPillars;
                }
            }
        }
        return nonCutPillars;
    }

    /**
     * Calculates the movepath of a cube participating in a pillar shove of <= 8, i.e. a fold.
     * @param start
     * @param target
     * @param flat if true, this pillar shove is executed in 2D instead of 3D
     */
    pillarCubeFoldPath(start: Position, target: Position, flat: boolean = false): Move[] {
        let moveSequence: Move[] = [];
        
        let relevantTargetCoord = flat ? target[1] : target[2];
        let relevantStartCoord = flat ? start[1] : start[2];
        if (relevantTargetCoord > relevantStartCoord) {
            // the cubes that move up in the fold
            let sideWaysDir = flat ? Move.getDirection(start, [target[0], start[1] + 1, target[2]]) :
                Move.getDirection(start, [target[0], target[1], start[2] + 1]);
            moveSequence.push(new Move(this.configuration, start, sideWaysDir));
            for (let z = relevantStartCoord + 1; z < relevantTargetCoord; z++) {
                if (flat) {
                    moveSequence.push(new Move(this.configuration, [target[0], z, target[2]], "Y"));   
                } else {
                    moveSequence.push(new Move(this.configuration, [target[0], target[1], z], "Z"));
                }
            }
        } else if (relevantTargetCoord < relevantStartCoord) {
            // the cubes that move down in the fold
            for (let z = relevantStartCoord; z > relevantTargetCoord + 1; z--) {
                if (flat) {
                    moveSequence.push(new Move(this.configuration, [start[0], z, start[2]], "y"));
                } else {
                    moveSequence.push(new Move(this.configuration, [start[0], start[1], z], "z"));
                }
            }
            let sideWaysDir = flat ? Move.getDirection([start[0], target[1] + 1, start[2]], target) : 
                Move.getDirection([start[0], start[1], target[2] + 1], target);
            // the getDirection function prioritises x, then y, then z.
            // here, we want to go z/y first
            sideWaysDir = sideWaysDir[1] + sideWaysDir[0];
            if (flat) {
                moveSequence.push(new Move(this.configuration, [start[0], target[1] + 1, start[2]], sideWaysDir));
            } else {
                moveSequence.push(new Move(this.configuration, [start[0], start[1], target[2] + 1], sideWaysDir));
            }
        } else {
            // the cubes that move horizontally
            let sideWaysDir = Move.getDirection(start, target);
            moveSequence.push(new Move(this.configuration, start, sideWaysDir));
        }
        return moveSequence;
    }
    
    pillarHeadDown(start: Position, target: Position): Move[] {
        let moveSequence: Move[] = [];
        for (let z = start[2]; z > target[2]; z--) {
            moveSequence.push(new Move(this.configuration, [start[0], start[1], z], "z"));
        }
        return moveSequence;
    }

    /**
     * Perform a normal pillar shove in the direction given
     */
    pillarShove(pillar: Position[], side: [number, number]): Move[] {
        let moveSequence: Move[] = [];
        
        if (pillar.length <= 8) { // the pillar 
            // do direct pillar fold
            let head = pillar[pillar.length - 1];
            let pillarXY: [number, number] = [pillar[0][0], pillar[0][1]];
            // move all cubes to the side
            let cubesMoved = 0;
            for (let z = pillar[0][2]; z < head[2]; z++) {
                let movePath = this.pillarCubeFoldPath([...pillarXY, z], [...side, head[2] - 1 - cubesMoved]);
                moveSequence = moveSequence.concat(movePath);
                cubesMoved++;
            }
            
            // move the head down
            let headMovePath = this.pillarHeadDown(head, [...pillarXY, pillar[0][2]]);
            moveSequence = moveSequence.concat(headMovePath);
        } else {
            // perform an actual pillar shove
            let p: [number, number] = [pillar[0][0], pillar[0][1]];
            let sides: [number, number][] = [[p[0], p[1] - 1], [p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] + 1]];
            let minZ = this.configuration.bounds()[2];
            let otherSide = sides.find(s => !(s[0] === side[0] && s[1] === side[1]))!;
            
            let bottomZPillar = pillar[0][2];
            
            let targets: Position[] = [
                [...side, bottomZPillar + 7],
                [...side, bottomZPillar + 6],
                [...side, bottomZPillar + 5],
                [...otherSide, bottomZPillar + 7],
                [...otherSide, bottomZPillar + 5],
            ];

            // a list with all cubes that we have moved already. To be moved back before executing the moves.
            // They are mapped [to, from]
            let cubesMoved: [Position, Position][] = [];
            
            for (let i = 0; i < targets.length; i++) {
                let target = targets[i];
                let cubeToMove = pillar[i];
                // we do not need to remember which cubes we already moved, since all sides will be empty and we are doing it in the correct order
                let path = this.configuration.shortestMovePath(cubeToMove, target);
                moveSequence = moveSequence.concat(path);
                
                cubesMoved.push([target, cubeToMove]);
                this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, target);
            }

            // Move all cubes that we "temporarily" moved to calculate movepaths back such that they can actually do the moves
            for (let entry of cubesMoved) {
                let from = entry[1];
                let to = entry[0];
                this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
            }
            let pillarToSideDir = Move.getDirection(pillar[0], [...side, bottomZPillar]); // this is the direction from the pillar to the side
            let otherSideToPillarDir = Move.getDirection([...otherSide, bottomZPillar], pillar[0]); // this is the direction from the otherside to the pillar
            let bottomZipper = pillar[0][2] + 5; // the zipper requires 5 cubes
            moveSequence = moveSequence.concat(this.zipper(pillar, side, otherSide, bottomZipper));

            // move zipper back down, so calculate the new bottom of the zipper
            bottomZipper = pillar.length - 4 + bottomZPillar; // zipper is height 3 + head
            // First move the otherside blocks back
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper], "z" + otherSideToPillarDir));
            for (let i = 1; i < pillar.length - 9; i++) { // same magical 9 as before, this is the amount the zipper moved
                moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
            }
            if (pillar.length > 9) { // there is not enough cubes to perform a convex transition, so only perform a sideways move instead
                moveSequence.push(new Move(this.configuration, [...p, bottomZPillar + 5], "z" + pillarToSideDir));
            } else {
                moveSequence.push(new Move(this.configuration, [...p, bottomZPillar + 4], pillarToSideDir));
            }

            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 2], "z"));
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 1], "z"));
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper], "z" + otherSideToPillarDir));
            for (let i = 1; i < pillar.length - 8; i++) {
                moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
            }
            moveSequence.push(new Move(this.configuration, [...p, bottomZPillar + 4], "z" + pillarToSideDir));

            // bottom cube of zipper
            for (let i = 0; i < pillar.length - 7; i++) {
                moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
            }
            moveSequence.push(new Move(this.configuration, [...p, bottomZPillar + 3], "z" + pillarToSideDir));

            // second cube of zipper
            for (let i = -1; i < pillar.length - 6; i++) {
                moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
            }
            moveSequence.push(new Move(this.configuration, [...p, bottomZPillar + 2], "z" + pillarToSideDir));

            // third cube of zipper
            for (let i = -2; i < pillar.length - 5; i++) {
                moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
            }
            moveSequence.push(new Move(this.configuration, [...p, bottomZPillar + 1], "z" + pillarToSideDir));

            // move head down
            for (let i = -3; i < pillar.length - 4; i++) {
                moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
            }
        }
        
        return moveSequence;
    }


    /**
     * Generates the moves necessary for a zipper when the zipper is already in position
     * @param pillar the pillar, including the head, pillar[0] should be on the bottom
     * @param sideToMoveTo
     * @param otherSide
     * @param bottomZipper the z-coordinate of the bottom cube of the zipper
     */
    zipper(pillar: Position[], sideToMoveTo: [number, number],otherSide: [number, number], bottomZipper: number) {
        let p: [number, number] = [pillar[0][0], pillar[0][1]];
        
        // the cubes are in zipper position, perform the actual pillar shove
        // the magical numbers are computed as follows:
        // 5 cubes are from the pillar making the zipper
        // the zipper is height 3
        // the last move shouldn't be done, since the zipper is already touching the cube neighboring the head.
        // 5+3+1 = 9
        let pillarToSideDir = Move.getDirection([...p, 0], [...sideToMoveTo, 0]); // this is the direction from the pillar to the side
        let pillarToOtherSideDir = Move.getDirection([...p, 0], [...otherSide, 0]); // this is the direction from the pillar to the otherside
        let otherSideToPillarDir = Move.getDirection([...otherSide, 0], [...p, 0]); // this is the direction from the otherside to the pillar

        let moveSequence: Move[] = [];
        
        let headZ = pillar[pillar.length - 1][2];
        for (let i = 0; i < headZ - (bottomZipper + 3); i++) {
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 2 + i], "Z"));
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + i], "Z"));
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 1 + i], "Z"));
            moveSequence.push(new Move(this.configuration, [...p, bottomZipper + i], pillarToOtherSideDir + "Z"));
            moveSequence.push(new Move(this.configuration, [...sideToMoveTo, bottomZipper + 2 + i], "Z"));
            moveSequence.push(new Move(this.configuration, [...p, bottomZipper + 2 + i], pillarToSideDir));
            moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 2 + i], otherSideToPillarDir));
        }
        return moveSequence;
    }

    /**
     * Same as zipper, but then in 2D on the bottom plane
     */
    zipperFlat(pillar: Position[], sideToMoveTo: number, otherSide: number, bottomZipper: number) {
        let p = pillar[0][0];
        let minZ = this.configuration.bounds()[2];

        let pillarToSideDir = Move.getDirection([p, 0, minZ], [sideToMoveTo, 0, minZ]); // this is the direction from the pillar to the side
        let pillarToOtherSideDir = Move.getDirection([p, 0, minZ], [otherSide, 0, minZ]); // this is the direction from the pillar to the otherside
        let otherSideToPillarDir = Move.getDirection([otherSide, 0, minZ], [p, 0, minZ]); // this is the direction from the otherside to the pillar
        
        let moveSequence: Move[] = [];
        
        let headY = pillar[pillar.length - 1][1];
        for (let i = 0; i < headY - (bottomZipper + 3); i++) {
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 2 + i, minZ], "Y"));
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + i, minZ], "Y"));
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 1 + i, minZ], "Y"));
            moveSequence.push(new Move(this.configuration, [p, bottomZipper + i, minZ], pillarToOtherSideDir + "Y"));
            moveSequence.push(new Move(this.configuration, [sideToMoveTo, bottomZipper + 2 + i, minZ], "Y"));
            moveSequence.push(new Move(this.configuration, [p, bottomZipper + 2 + i, minZ], pillarToSideDir));
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 2 + i, minZ], otherSideToPillarDir));
        }
        return moveSequence;
    }

    /**
     * From all possible operations of type (e): pillar shoves,
     * this finds the move that moves the pillar with the highest cost
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     */
    operationE(cubesOrdered: Cube[], stopAfterFirst: boolean): Move[][] | [] {
        let allPossiblePillarMoves: Move[][] = []
        let pillars = this.nonCutPillar(cubesOrdered, false);
        for (let pillar of pillars) {

            if (pillar.length <= 1) continue;
            let head = pillar[pillar.length - 1];

            let p: [number, number] = [pillar[0][0], pillar[0][1]]

            // define variables necessary later
            let subpillar: Position[] = [];
            let chosenSide: [number, number] = p;
            let moveSequence: Move[] = []

            // check if an unlock is possible
            // the sides are ordered in order of priority
            let sides: [number, number][] = [[p[0], p[1] - 1], [p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] + 1]];
            let unlockPossible = false;

            for (let side of sides) {
                // if an unlock is possible, and is actually necessary in that direction, chose that side
                if (this.unlockPossible(head, side) &&
                    !this.configuration.hasCube([...side, head[2] - 2])) {
                    chosenSide = side;
                    unlockPossible = true;

                    subpillar = pillar.slice(0, pillar.length - 1);

                    let unlockMove = this.unlockMove(head, chosenSide);
                    moveSequence.push(unlockMove);

                    break;
                }
            }
            // if an unlock is not required, find the side that is lowest
            if (!unlockPossible) {
                const subPillarReturnValue = this.subPillarToMove(pillar);
                chosenSide = subPillarReturnValue.chosenSide!;
                subpillar = subPillarReturnValue.subPillar;
            }

            let pillarMoves = this.pillarShove(subpillar, chosenSide);
            if (pillarMoves.length === 0) continue;

            allPossiblePillarMoves.push(moveSequence.concat(pillarMoves));
            if (stopAfterFirst) {
                break;
            }
        }
        
        return allPossiblePillarMoves;
    }

    /**
     * Perform a normal pillar shove in 2D in the direction given
     * @param pillar
     * @param side the x coordinate of the direction we want to shove in
     */
    pillarShoveLow(pillar: Position[], side: number): Move[] {
        let moveSequence: Move[] = [];
        let minZ = this.configuration.bounds()[2];
        if (pillar.length <= 8) {
            // do a fold
            let head = pillar[pillar.length - 1];
            let p = head[0];
            // mvoe all cubes to the side
            let cubesMoved = 0;
            for (let y = pillar[0][1]; y < head[1]; y++) {
                let movePath = this.pillarCubeFoldPath([p, y, minZ], [side, head[1] - 1 - cubesMoved, minZ], true);
                moveSequence = moveSequence.concat(movePath);
                cubesMoved++;
            }
        } else {
            // perform actual pillar shove
            let p = pillar[0][0];
            let bounds = this.configuration.bounds();
            let minZ = bounds[2];
            let otherSide = side === p - 1 ? p + 1 : p - 1;
            
            let bottomYPillar = pillar[0][1];
            
            let targets: Position[] = [
                [side, bottomYPillar + 7, minZ],
                [side, bottomYPillar + 6, minZ],
                [side, bottomYPillar + 5, minZ],
                [otherSide, bottomYPillar + 7, minZ],
                [otherSide, bottomYPillar + 5, minZ],
            ];

            // a list with all cubes that we have moved already. To be moved back before executing the moves.
            // They are mapped [to, from]
            let cubesMoved: [Position, Position][] = [];
            
            for (let i = 0; i < targets.length; i++) {
                let target = targets[i];
                let cubeToMove = pillar[i];
                // we do not need to remember which cubes we already moved, since all sides will be empty
                let path = this.configuration.shortestMovePath(cubeToMove, target);
                moveSequence = moveSequence.concat(path);
                cubesMoved.push([target, cubeToMove]);
                this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, target);
            }

            // Move all cubes that we "temporarily" moved to calculate movepaths back such that they can actually do the moves
            for (let entry of cubesMoved) {
                let from = entry[1];
                let to = entry[0];
                this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
            }
            let pillarToSideDir = Move.getDirection(pillar[0], [side, bottomYPillar, minZ]);
            let otherSideToPillarDir = Move.getDirection([otherSide, bottomYPillar, minZ], pillar[0]);
            let bottomZipper = pillar[0][1] + 5; // zipper requires 5 cubes
            // todo fix this function for 2D
            moveSequence = moveSequence.concat(this.zipperFlat(pillar, side, otherSide, bottomZipper));
            
            // move zipper back down, so calculate the new bottom of the zipper
            bottomZipper = pillar.length - 4 + bottomYPillar; // zipper is height 3 + head
            // First move the otherside blocks back
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper, minZ], "y" + otherSideToPillarDir));
            for (let i = 1; i < pillar.length - 9; i++) { // same magical 9 as before
                moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
            }
            if (pillar.length > 9) { // there can be not enough cubes to perform a convex transition
                moveSequence.push(new Move(this.configuration, [p, bottomYPillar + 5, minZ], "y" + pillarToSideDir));
            } else {
                moveSequence.push(new Move(this.configuration, [p, bottomYPillar + 4, minZ], pillarToSideDir));
            }
            
            // second otherside block
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 2, minZ], "y"));
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 1, minZ], "y"));
            moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper, minZ], "y" + otherSideToPillarDir));
            for (let i = 1; i < pillar.length - 8; i++) {
                moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
            }
            moveSequence.push(new Move(this.configuration, [p, bottomYPillar + 4, minZ], "y" + pillarToSideDir));

            // bottom cube of zipper
            for (let i = 0; i < pillar.length - 7; i++) {
                moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
            }
            moveSequence.push(new Move(this.configuration, [p, bottomYPillar + 3, minZ], "y" + pillarToSideDir));

            // second cube of zipper
            for (let i = -1; i < pillar.length - 6; i++) {
                moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
            }
            moveSequence.push(new Move(this.configuration, [p, bottomYPillar + 2, minZ], "y" + pillarToSideDir));

            // third cube of zipper
            for (let i = -2; i < pillar.length - 5; i++) {
                moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
            }
            moveSequence.push(new Move(this.configuration, [p, bottomYPillar + 1, minZ], "y" + pillarToSideDir));

            // move head down
            for (let i = -3; i < pillar.length - 4; i++) {
                moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
            }
        }
        
        
        return moveSequence;
    }
    
    /**
     * Perform a pillar shove on a low component. The fixed cube is not allowed to move.
     */
    operationELow(lowCubesOrdered: Cube[], fixedCube: Position, stopAfterFirst: boolean): Move[][] | [] {
        let allPossiblePillarMoves: Move[][] = [];
        // only non cut pillars that do not contain the fixed cube are considered
        let pillars = this.nonCutPillar(lowCubesOrdered, false, true, fixedCube);
        
        let minZ = this.configuration.bounds()[2];
        
        for (let pillar of pillars) {
            if (pillar.length <= 1) continue;
            let head = pillar[pillar.length - 1];
            
            // p is only the x coordinate in this case
            let p = pillar[0][0];
            
            // define variables necessary later
            let subpillar: Position[] = [];
            let chosenSide: number = p;
            let moveSequence: Move[] = [];
            
            // check if an unlock is possble
            // the sides are ordered in order of priority
            let sides = [p - 1, p + 1];
            let unlockPossible = false;
            for (let side of sides) {
                // if an unlock is possible, and is actually necessary in that direction, chose that side
                if (this.configuration.hasCube(head) &&
                    !this.configuration.hasCube([side, head[1], minZ]) &&
                    this.configuration.hasCube([side, head[1] - 1, minZ]) &&
                    !this.configuration.hasCube([side, head[1] - 2, minZ])) {
                    chosenSide = side;
                    unlockPossible = true;
                    subpillar = pillar.slice(0, pillar.length - 1);
                    let unlockMove = new Move(this.configuration, head, side < p ? "x" : "X");
                    moveSequence.push(unlockMove);
                    
                    break;
                }
            }
            
            // if an unlock is not required, find the side that is lowest
            if (!unlockPossible) {
                let sideHasBeenChosen = false;
                let yWithBottomCube = -1;
                for (let y = pillar[0][1]; y <= head[1]; y++) {
                    for (let side of sides) {
                        if (this.configuration.hasCube([side, y, minZ])) {
                            chosenSide = side;
                            sideHasBeenChosen = true;
                            yWithBottomCube = y;
                            break;
                        }
                    }
                    if (sideHasBeenChosen) break; // break out of double for
                }
                subpillar = pillar.filter(p => p[1] <= yWithBottomCube);
            }
            
            // perform the pillar shove
            let pillarMoves = this.pillarShoveLow(subpillar, chosenSide);
            if (pillarMoves.length === 0) continue;
            
            allPossiblePillarMoves.push(moveSequence.concat(pillarMoves));
            if (stopAfterFirst) {
                break;
            }
            
        }
        
        return allPossiblePillarMoves;
    }

    /**
     * Given a pillar that can do a pillar move, calculate the subpillar that will actually do the move and the side
     * it will perform the move to
     */
    subPillarToMove(pillar: Position[]) {
        let p = [pillar[0][0], pillar[0][1]];
        let sides: [number, number][] = [[p[0], p[1] - 1], [p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] + 1]];
        let head = pillar[pillar.length - 1];
        let aSideHasBeenChosen = false;
        let zWithBottomCube = -1;
        let chosenSide;
        for (let z = pillar[0][2]; z <= head[2]; z++) {
            for (let side of sides) {
                if (this.configuration.hasCube([...side, z])) {
                    chosenSide = side;
                    aSideHasBeenChosen = true;
                    zWithBottomCube = z;
                    break;
                }
            }
            // break out of double for loop
            if (aSideHasBeenChosen) break;
        }
        // we have chosen a side to do a pillar move to, but pick the respective subPillar
        let subPillar = pillar.filter(p => p[2] <= zWithBottomCube);
        return {chosenSide, subPillar};
    }

    inBounds(p: Position): boolean {
        let bounds = this.configuration.bounds();
        return  p[0] >= bounds[0] &&
            p[1] >= bounds[1] &&
            p[2] >= bounds[2] &&
            p[0] <= bounds[3] &&
            p[1] <= bounds[4] &&
            p[2] <= bounds[5];
    }
    
    /**
     * From all possible operations of type (e): any potential reducing move,
     * this finds the move that moves the cube with the highest cost
     * @param cubesOrdered the cubes in order they should be processed
     * @param stopAfterFirst if the function should return after the first successfully found move
     */
    operationFG(cubesOrdered: Cube[], stopAfterFirst: boolean): Move[][] {
        let potentialMoves: Move[][] = [];
        
        for (let cube of cubesOrdered) {
            if (cube.stableStatus === StableStatus.STABLE) {
                // not a cut cube
                for (let direction of moveDirections) {
                    let potentialMove = new Move(this.configuration, cube.p, direction);
                    let target = potentialMove.targetPosition();
                    if (potentialMove.isValid() &&
                        this.cost(cube.p) > this.cost(target) &&
                        this.inBounds(target)) {
                        potentialMoves.push([potentialMove]);
                        if (stopAfterFirst) {
                            return potentialMoves;
                        }
                    }
                }
            } else {
                // check for 2D unlock
                let minZ = this.configuration.bounds()[2];
                let p = cube.p;
                if (p[2] !== minZ) continue;
                
                let unlockSide = -1;
                let unlockingCube: Position = [p[0], p[1] + 1, p[2]];
                if (this.unlockPossibleFlat(unlockingCube, p[0] + 1)) {
                    unlockSide = p[0] + 1;
                } else if (this.unlockPossibleFlat(unlockingCube, p[0] - 1)) {
                    unlockSide = p[0] - 1;
                }
                if (unlockSide === -1) continue;
                
                for (let direction of moveDirections) {
                    let potentialMove = new Move(this.configuration, cube.p, direction);
                    let target = potentialMove.targetPosition();
                    if (potentialMove.isValidIgnoreConnectivity() && this.configuration.isConnected([], [p, unlockingCube]) &&
                        this.cost(cube.p) > this.cost(target) &&
                        this.inBounds(target)) {
                        potentialMoves.push([this.unlockMoveFlat(unlockingCube, unlockSide), potentialMove]);
                        if (stopAfterFirst) {
                            return potentialMoves;
                        }
                    }
                }
                
            }
        }
        return potentialMoves;
    }

    /**
     * Finds a low component that is not the root.
     * The root is the component containing the origin, or, if none such exists,
     * the component containing the first low cube.
     * @returns [lowComponent, clearingPillar]
     */
    findClearLowComponent(flat: boolean) {
        let bounds = this.configuration.bounds();
        let origin: Position = [bounds[0], bounds[1], bounds[2]];
        
        let root: Position;
        if (this.configuration.hasCube(origin)) {
            root = origin;
        } else {
            if (flat) {
                root = this.configuration.cubes.find(c => c.p[2] === bounds[2] && c.p[1] === bounds[1])!.p;
            } else {
                root = this.configuration.cubes.find(c => c.p[2] === bounds[2])!.p;
            }
        }
        
        let nonRootComponents = [];
        let seen: boolean[] = Array(this.configuration.cubes.length).fill(false);
        
        let minZ = bounds[2];
        let minY = bounds[1];
        for (let cube of this.configuration.cubes) {
            let cubeId = this.configuration.getCubeId(cube.p)!;
            if (cube.p[2] !== minZ) continue
            if (flat && cube.p[1] !== minY) continue;
            if (seen[cubeId]) continue;
            let queue = [cubeId];
            let component: Position[] = [];
            
            let isRootComponent = false;
            
            while (queue.length !== 0) {
                cubeId = queue.shift()!;
                if (seen[cubeId]) {
                    continue;
                }
                
                let cubeP = this.configuration.cubes[cubeId].p;
                
                if (cubeP[0] === root[0] && cubeP[1] === root[1] && cubeP[2] === root[2]) {
                    isRootComponent = true;
                }
                
                component.push(cubeP);
                
                const cube = this.configuration.cubes[cubeId];
                seen[cubeId] = true;

                const neighbors: Position[] = flat ?
                [
                    [cube.p[0] - 1, cube.p[1], cube.p[2]],
                    [cube.p[0] + 1, cube.p[1], cube.p[2]],
                ]
                : 
                [
                    [cube.p[0] - 1, cube.p[1], cube.p[2]],
                    [cube.p[0] + 1, cube.p[1], cube.p[2]],
                    [cube.p[0], cube.p[1] - 1, cube.p[2]],
                    [cube.p[0], cube.p[1] + 1, cube.p[2]]
                ];
                
                for (let p of neighbors) {
                    if (this.configuration.hasCube(p)) {
                        queue.push(this.configuration.getCubeId(p)!);
                    }
                }
            }
            
            if (!isRootComponent) {
                nonRootComponents.push(component);
            }
        }
        
        // check all non-root components if they are a clear component
        for (let component of nonRootComponents) {
            // find all pillars connected to a cube in our component
            let pillars: Position[][] = [];
            for (let lowCubePosition of component) {
                let p: Position = flat ?
                    [lowCubePosition[0], lowCubePosition[1] + 1, lowCubePosition[2]] :
                    [lowCubePosition[0], lowCubePosition[1], lowCubePosition[2] + 1];
                if (this.configuration.hasCube(p)) {
                    // there is a cube above this lowCube, so follow it to find the pillar
                    let pillar: Position[] = [];
                    while (this.configuration.hasCube(p)) {
                        pillar.push(p);
                        p = flat ?
                            [p[0], p[1] + 1, p[2]]:
                            [p[0], p[1], p[2] + 1];
                    }
                    
                    pillars.push(pillar);
                }
            }
            
            // for each pillar, check if it is a clearing pillar
            for (let pillar of pillars) {
                if (this.configuration.isConnected([], pillar.concat(component))) {
                    return {component, pillar};
                }
            }
        }
        
        if (nonRootComponents.length > 0) {
            throw new Error("There are non root low components, but none of them is clear");
        }
        
        let component: Position[] = [];
        let pillar: Position[]  = [];
        return {component, pillar};
    }

    /**
     * Find a stable cube in a list of possible cubes. Assumes that the configuration is up to date.
     * @returns a stable cube, or undefined if none exist in the component
      */
    findStableCube(component: Position[]): Position | undefined {
        return component.find(p => this.configuration.isConnected([], [p]));
    }
    
    operationHI(clearLowComponent: Position[], clearingPillar: Position[]): Move[] {
        let p: [number, number] = [clearingPillar[0][0], clearingPillar[0][1]];
        let sides: [number, number][] = [[p[0], p[1] - 1], [p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] + 1]];

        let bounds = this.configuration.bounds();
        let minX = bounds[0];
        let minY = bounds[1];
        let minZ = bounds[2];
        let maxX = bounds[3];
        let maxY = bounds[4];
        
        let N: Position[] = sides.map(s => [...s, clearLowComponent[0][2] + 1]);
        let allNPresent = true;
        for (let n of N) {
            if (!this.configuration.hasCube(n) && minX <= n[0] && n[0] <= maxX && minY <= n[1] && n[1] <= maxY) {
                allNPresent = false;
                break;
            }
        }
        
        if (allNPresent) {
            // make H move
            // find an empty spot e on the bottom layer closer to the origin
            
            let e: Position | undefined = undefined;
            
            for (let x = clearingPillar[0][0]; x >= minX; x--) {
                for (let y = clearingPillar[0][1]; y >= minY; y--) {
                    if (this.configuration.hasCube([x, y, minZ])) continue;
                    e = [x, y, minZ];
                    break;
                }
                if (e) break;
            }
            
            if (!e) {
                throw new Error("There is no empty spot closer to the origin.");
            }
            return  this.configuration.shortestMovePath([clearingPillar[0][0], clearingPillar[0][1], minZ], e!);
        } else {
            // all N should be absent
            // make I move

            // first figure out which side the pillar wants to move to.
            let subPillarReturnValue = this.subPillarToMove(clearingPillar);
            let side  = subPillarReturnValue.chosenSide!;
            let subPillar = subPillarReturnValue.subPillar;

            let minZ = this.configuration.bounds()[2];
            
            let otherSide = sides.find(s => !(s[0] == side[0] && s[1] == side[1]))!;
            
            let moveSequence: Move[] = [];
            
            // first gather cubes towards the pillar
            if (subPillar.length >= 5 && subPillar.length + clearLowComponent.length > 8) {
                let targets: Position[] = [
                    [...side, minZ],
                    [...side, minZ + 1],
                    [...side, minZ + 2],
                    [...side, minZ + 3],
                    // [...otherSide, minZ],
                    [...otherSide, minZ + 1],
                    // [...otherSide, minZ + 2],
                    [...otherSide, minZ + 3],
                ];

                // Get all cubes in the low component that are not directly underneath the pillar and are not already a target.
                let potentialCubesToPickFromLowComponent = clearLowComponent.filter(p => 
                    !(p[0] === clearingPillar[0][0] && p[1] === clearingPillar[0][1]) &&
                    !(p[0] === targets[0][0] && p[1] === targets[0][1]) && // only targets[0] and targets[3] can be present in the low component
                    !(p[0] === targets[3][0] && p[1] === targets[3][1])
                );
                
                // only take those targets that actually need to be filled
                targets = targets.filter(t => !this.configuration.hasCube(t));
                
                let bottomZipper = minZ + 1;
                
                if (targets.length <= potentialCubesToPickFromLowComponent.length) {

                    // a list with all cubes that we have moved already. To be moved back before executing the moves.
                    // They are mapped [to, from]
                    let cubesMoved: [Position, Position][] = [];

                    for (let i = 0; i < targets.length; i++) {
                        // get a non-cut cube in the low component

                        let cubeToMove = this.findStableCube(potentialCubesToPickFromLowComponent);
                        if (!cubeToMove) {
                            throw new Error("Not enough cubes in the low component");
                        }
                        let path = this.configuration.shortestMovePath(cubeToMove, targets[i]);

                        cubesMoved.push([targets[i], cubeToMove]);
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, targets[i]);
                        potentialCubesToPickFromLowComponent = potentialCubesToPickFromLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));

                        if (path.length === 0) {
                            throw new Error("There is no valid movepath from this cube to its target.");
                        }
                        moveSequence = moveSequence.concat(path);
                    }

                    // move the cubes we moved temporarily to calculate movepaths back to their original position such that they can be moved back 
                    for (let entry of cubesMoved) {
                        let to = entry[0];
                        let from = entry[1];
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                    }
                } else {
                    // there is not enough cubes in the low component to make the zipper, zo use the cubes from the pillar itself to make the zipper
                    let cubesInLowComponent = clearLowComponent.length; // this must be at least 1, i.e. the cube below the pillar
                    let availableCubes = cubesInLowComponent - 1; // the cubes we can use
                    let bottomZPillar = minZ;
                    // the target adjusted for the amount of cubes we have available from the low component
                    let targets: Position[] = [
                        [...side, bottomZPillar + 7 - availableCubes],
                        [...side, bottomZPillar + 6 - availableCubes],
                        [...side, bottomZPillar + 5 - availableCubes],
                        [...otherSide, bottomZPillar + 7 - availableCubes],
                        [...otherSide, bottomZPillar + 5 - availableCubes],
                    ];

                    bottomZipper = bottomZPillar + 5 - availableCubes;

                    // a list with all cubes that we have moved already. To be moved back before executing the moves.
                    // They are mapped [to, from]
                    let cubesMoved: [Position, Position][] = [];
                    
                    for (let i = 0; i < targets.length; i++) {
                        let target = targets[i];
                        // don't pick the clearing pillar cube, unless we have to
                        let potentialCubes = clearLowComponent.filter(c => !(c[0] === clearingPillar[0][0] && c[1] === clearingPillar[0][1]));
                        let cubeToMove = this.findStableCube(potentialCubes);
                        if (!cubeToMove) {
                            // if the low component is empty, use the pillar itself
                            let potentialCube: Position = [clearingPillar[0][0], clearingPillar[0][1], minZ];
                            while (!this.configuration.hasCube(potentialCube)) {
                                potentialCube = [potentialCube[0], potentialCube[1], potentialCube[2] + 1];
                            }
                            cubeToMove = potentialCube;
                        } else {
                            // remove the cube that we are going to move from the low component
                            clearLowComponent = clearLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));
                        }
                        
                        // if the cube we want to move is already on the correct position, just go to the next cube
                        if (cubeToMove[0] === target[0] && cubeToMove[1] === target[1] && cubeToMove[2] === target[2]) continue;
                        
                        // we do not need to remember which cubes we already moved, since all sides will be empty and we are doing it in the correct order
                        let path = this.configuration.shortestMovePath(cubeToMove, target);
                        moveSequence = moveSequence.concat(path);
                        
                        cubesMoved.push([target, cubeToMove]);
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, target);
                    }
                    // Move all cubes that we "temporarily" moved to calculate movepaths back such that they can actually do the moves
                    for (let entry of cubesMoved) {
                        let from = entry[1];
                        let to = entry[0];
                        
                        // check if this cube A's "from" position is another cube B's "to" position
                        // if it is, skip A for now and try to do it again after all other cubes have been placed back
                        if (this.configuration.hasCube(from)) {
                            cubesMoved.push([to, from]);
                            continue;
                        }
                        
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                    }
                }

                // the cubes are now in zipper formation, so perform the zipper
                moveSequence = moveSequence.concat(this.zipper(subPillar, side, otherSide, bottomZipper));

                let newBottomZipper = subPillar[subPillar.length - 1][2] - 3;
                let pillarMoved = newBottomZipper - bottomZipper;


                // cleanup the zipper
                bottomZipper = subPillar[subPillar.length - 1][2] - 3;
                let otherSideToPillarDir = Move.getDirection([...otherSide, 0], [...p, 0]); // this is the direction from the otherside to the pillar


                // First move the otherside blocks back
                moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper], "z" + otherSideToPillarDir));
                for (let i = 1; i < pillarMoved; i++) { // same magical 9 as before, this is the amount the zipper moved
                    moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
                }
                
                // Second otherside block
                moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 2], "z"));
                moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper + 1], "z"));
                if (pillarMoved > 1) {
                    moveSequence.push(new Move(this.configuration, [...otherSide, bottomZipper], "z" + otherSideToPillarDir));
                }
                for (let i = 1; i < pillarMoved - 1; i++) {
                    moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
                }
                
                // the last 4 blocks, including the head
                for (let i = 0; i < pillarMoved - 2; i++) {
                    moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
                }
                for (let i = -1; i < pillarMoved - 3; i++) {
                    moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
                }
                for (let i = -2; i < pillarMoved - 4; i++) {
                    moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
                }
                for (let i = -3; i < pillarMoved - 5; i++) {
                    moveSequence.push(new Move(this.configuration, [...p, bottomZipper - i], "z"));
                }



            } else if (subPillar.length < 5) {
                // for a pillar of height 1, 2 or 3, just gather cubes to the "side" to fill the gap
                let targets: Position[] = [];
                for (let i = 0; i < subPillar.length; i++) {
                    targets.push([...side, minZ + i]);
                }
                // Get all cubes in the low component that are not directly underneath the pillar and are not already a target.
                let potentialCubesToPickFromLowComponent = clearLowComponent.filter(p =>
                    !(p[0] === clearingPillar[0][0] && p[1] === clearingPillar[0][1])
                );
                
                // just gather the cubes to the targets

                // a list with all cubes that we have moved already. To be moved back before executing the moves.
                // They are mapped [to, from]
                let cubesMoved: [Position, Position][] = [];
                
                // fill the targets from top to bottom
                for (let i = targets.length - 1; i >= 0; i--) {
                    if (this.configuration.hasCube(targets[i])) continue; // skip this target if it already contains a cube
                    
                    // get a non-cut cube in the low component

                    let cubeToMove = this.findStableCube(potentialCubesToPickFromLowComponent);
                    if (!cubeToMove) {
                        break; // there are no cubes anymore in the low component.
                    }
                    let path = this.configuration.shortestMovePath(cubeToMove, targets[i]);

                    cubesMoved.push([targets[i], cubeToMove]);
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, targets[i]);
                    potentialCubesToPickFromLowComponent = potentialCubesToPickFromLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));

                    if (path.length === 0) {
                        throw new Error("There is no valid movepath from this cube to its target.");
                    }
                    moveSequence = moveSequence.concat(path);
                }

                // move the cubes we moved temporarily to calculate movepaths back to their original position such that they can be moved back 
                for (let entry of cubesMoved) {
                    let to = entry[0];
                    let from = entry[1];
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                }
            } else {
                // there is not enough cubes to perform a zipper, so gather cubes and do a "fold"
                let targets: Position[] = [];
                let maxZOpen = subPillar[subPillar.length - 1][2] - 1;
                for (let i = 0; i < clearLowComponent.length - 1; i++) {
                    targets.push([...side, maxZOpen - i]);
                }

                // Get all cubes in the low component that are not directly underneath the pillar and are not already a target.
                let potentialCubesToPickFromLowComponent = clearLowComponent.filter(p =>
                    !(p[0] === clearingPillar[0][0] && p[1] === clearingPillar[0][1])
                );

                // a list with all cubes that we have moved already. To be moved back before executing the moves.
                // They are mapped [to, from]
                let cubesMoved: [Position, Position][] = [];

                // fill the targets
                for (let i = 0; i < targets.length; i++) {
                    // get a non-cut cube in the low component

                    let cubeToMove = this.findStableCube(potentialCubesToPickFromLowComponent);
                    if (!cubeToMove) {
                        break; // there are no cubes anymore in the low component.
                    }
                    let path = this.configuration.shortestMovePath(cubeToMove, targets[i]);

                    cubesMoved.push([targets[i], cubeToMove]);
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, targets[i]);
                    potentialCubesToPickFromLowComponent = potentialCubesToPickFromLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));

                    if (path.length === 0) {
                        throw new Error("There is no valid movepath from this cube to its target.");
                    }
                    moveSequence = moveSequence.concat(path);
                }

                // move the cubes we moved temporarily to calculate movepaths back to their original position such that they can be moved back 
                for (let entry of cubesMoved) {
                    let to = entry[0];
                    let from = entry[1];
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                }

                let minZ = this.configuration.bounds()[2];

                // move the cube below the pillar
                moveSequence = moveSequence.concat(this.pillarCubeFoldPath([subPillar[0][0], subPillar[0][1], minZ], [...side, maxZOpen - targets.length]))
                
                // fill the rest of the "side"
                for (let i = 0; i < maxZOpen - minZ - targets.length; i++)
                {
                    let cubeToMove = subPillar[i];
                    let target: Position = [...side, maxZOpen - targets.length - 1 - i];
                    moveSequence = moveSequence.concat(this.pillarCubeFoldPath(cubeToMove, target));
                }
            }
            
            return moveSequence;
        }
    }
    
    operationHIflat(clearLowComponent: Position[], clearingPillar: Position[]): Move[] {
        let p = clearingPillar[0][0];
        let sides = [p - 1, p + 1];
        let bounds = this.configuration.bounds();
        let minZ = bounds[2];
        let minY = bounds[1];
        let minX = bounds[0];
        let maxX = bounds[3];
        
        let N: Position[] = sides.map(s => [s, clearLowComponent[0][1] + 1, minZ]);
        let allNPresent = true;
        for (let n of N) {
            if (!this.configuration.hasCube(n) && minX <= n[0] && n[0] <= maxX) {
                allNPresent = false;
                break;
            }
        }
        
        if (allNPresent) {
            // make H move
            // find empty spot e on the bottom layer closer to the origin
            let e: Position | undefined = undefined;
            
            for (let x = p; x >= minX; x--) {
                if (this.configuration.hasCube([x, minY, minZ])) continue;
                e = [x, minY, minZ];
                break;
            }
            
            if (!e) {
                throw new Error("There is no empty spot closer to the origin.");
            }
            return this.configuration.shortestMovePath([clearingPillar[0][0], minY, minZ], e);
        } else {

            // all N absent so do an I move
            // first figure out which side the pillar wants to move to

            let head = clearingPillar[clearingPillar.length - 1];
            let chosenSide: number | undefined;

            let sideHasBeenChosen = false;
            let yWithBottomCube = -1;
            for (let y = clearingPillar[0][1]; y <= head[1]; y++) {
                for (let side of sides) {
                    if (this.configuration.hasCube([side, y, minZ])) {
                        chosenSide = side;
                        sideHasBeenChosen = true;
                        yWithBottomCube = y;
                        break;
                    }
                }
                if (sideHasBeenChosen) break; // break out of double for
            }
            let subpillar = clearingPillar.filter(p => p[1] <= yWithBottomCube);
            let side = chosenSide!;

            let otherSide = side === p - 1 ? p + 1 : p - 1;

            let moveSequence: Move[] = [];

            if (subpillar.length >= 5 && subpillar.length + clearLowComponent.length > 8) {
                let targets: Position[] = [
                    [side, minY, minZ],
                    [side, minY + 1, minZ],
                    [side, minY + 2, minZ],
                    [side, minY + 3, minZ],
                    // [otherSide, minY, minZ],
                    [otherSide, minY + 1, minZ],
                    // [...otherSide, minZ + 2],
                    [otherSide, minY + 3, minZ],
                ];

                // Get all cubes in the low component that are not directly underneath the pillar and not already target
                let potentialCubesToPickFromLowComponent = clearLowComponent.filter(p =>
                    !(p[0] === clearingPillar[0][0] && p[1] === clearingPillar[0][1]) &&
                    !(p[0] === targets[0][0] && p[1] === targets[0][1]) && // only targets[0] and targets[3] can be present in the low component
                    !(p[0] === targets[3][0] && p[1] === targets[3][1])
                );

                // only take those targets that actually need filling
                targets = targets.filter(t => !this.configuration.hasCube(t));

                let bottomZipper = minZ + 1;
                if (targets.length <= potentialCubesToPickFromLowComponent.length) {
                    // move the cubes to the correct targets

                    // a list with all cubes that we have moved already. To be moved back before executing the moves.
                    // They are mapped [to, from]
                    let cubesMoved: [Position, Position][] = [];

                    for (let i = 0; i < targets.length; i++) {
                        // get a non-cut cube in the low component

                        let cubeToMove = this.findStableCube(potentialCubesToPickFromLowComponent);
                        if (!cubeToMove) {
                            throw new Error("Not enough cubes in the low component");
                        }
                        let path = this.configuration.shortestMovePath(cubeToMove, targets[i]);

                        cubesMoved.push([targets[i], cubeToMove]);
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, targets[i]);
                        potentialCubesToPickFromLowComponent = potentialCubesToPickFromLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));

                        if (path.length === 0) {
                            throw new Error("There is no valid movepath from this cube to its target.");
                        }
                        moveSequence = moveSequence.concat(path);
                    }

                    // move the cubes we moved temporarily to calculate movepaths back to their original position such that they can be moved back 
                    for (let entry of cubesMoved) {
                        let to = entry[0];
                        let from = entry[1];
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                    }
                } else {
                    // there are not enough cubes in the low component to make a zipper, so use the cubes from the pillar to fill up
                    let cubesInLowComponent = clearLowComponent.length;
                    let availableCubes = cubesInLowComponent - 1; // not the one underneath the pillar
                    let bottomYPillar = minY;
                    let targets: Position[] = [
                        [side, bottomYPillar + 7 - availableCubes, minZ],
                        [side, bottomYPillar + 6 - availableCubes, minZ],
                        [side, bottomYPillar + 5 - availableCubes, minZ],
                        [otherSide, bottomYPillar + 7 - availableCubes, minZ],
                        [otherSide, bottomYPillar + 5 - availableCubes, minZ],
                    ];

                    bottomZipper = bottomYPillar + 5 - availableCubes;

                    // a list with all cubes that we have moved already. To be moved back before executing the moves.
                    // They are mapped [to, from]
                    let cubesMoved: [Position, Position][] = [];

                    for (let i = 0; i < targets.length; i++) {
                        let target = targets[i];
                        // don't pick the clearing pillar cube, unless we have to
                        let potentialCubes = clearLowComponent.filter(c => !(c[0] === clearingPillar[0][0]));
                        let cubeToMove = this.findStableCube(potentialCubes);
                        if (!cubeToMove) {
                            // if the low component is empty, use the pillar itself
                            let potentialCube: Position = [clearingPillar[0][0], minY, minZ];
                            while (!this.configuration.hasCube(potentialCube)) {
                                potentialCube = [potentialCube[0], potentialCube[1] + 1, potentialCube[2]];
                            }
                            cubeToMove = potentialCube;
                        } else {
                            // remove the cube that we are going to move from the low component
                            clearLowComponent = clearLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));
                        }

                        // if the cube we want to move is already on the correct position, just go to the next cube
                        if (cubeToMove[0] === target[0] && cubeToMove[1] === target[1] && cubeToMove[2] === target[2]) continue;

                        // we do not need to remember which cubes we already moved, since all sides will be empty and we are doing it in the correct order
                        let path = this.configuration.shortestMovePath(cubeToMove, target);
                        moveSequence = moveSequence.concat(path);

                        cubesMoved.push([target, cubeToMove]);
                        this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, target);
                    }

                    // Move all cubes that we "temporarily" moved to calculate movepaths back such that they can actually do the moves
                    for (let entry of cubesMoved) {
                        let from = entry[1];
                        let to = entry[0];

                        // check if this cube A's "from" position is another cube B's "to" position
                        // if it is, skip A for now and try to do it again after all other cubes have been placed back
                        if (this.configuration.hasCube(from)) {
                            cubesMoved.push([to, from]);
                            continue;
                        }

                        this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                    }
                }

                // the cubes are now in zipper formation, so perform the zipper
                moveSequence = moveSequence.concat(this.zipperFlat(subpillar, side, otherSide, bottomZipper));

                let newBottomZipper = subpillar[subpillar.length - 1][2] - 3;
                let pillarMoved = newBottomZipper - bottomZipper;

                // cleanup the zipper
                bottomZipper = subpillar[subpillar.length - 1][1] - 3;
                let otherSideToPillarDir = Move.getDirection([otherSide, 0, 0], [p, 0, 0]); // this is the direction from the otherside to the pillar


                // First move the otherside blocks back
                moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper, minZ], "y" + otherSideToPillarDir));
                for (let i = 1; i < pillarMoved; i++) { // same magical 9 as before, this is the amount the zipper moved
                    moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
                }

                // Second otherside block
                moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 2, minZ], "y"));
                moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper + 1, minZ], "y"));
                if (pillarMoved > 1) {
                    moveSequence.push(new Move(this.configuration, [otherSide, bottomZipper, minZ], "y" + otherSideToPillarDir));
                }
                for (let i = 1; i < pillarMoved - 1; i++) {
                    moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
                }

                // the last 4 blocks, including the head
                for (let i = 0; i < pillarMoved - 2; i++) {
                    moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
                }
                for (let i = -1; i < pillarMoved - 3; i++) {
                    moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
                }
                for (let i = -2; i < pillarMoved - 4; i++) {
                    moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
                }
                for (let i = -3; i < pillarMoved - 5; i++) {
                    moveSequence.push(new Move(this.configuration, [p, bottomZipper - i, minZ], "y"));
                }
            } else if (subpillar.length < 5) {
                // pillar of height 1, 2, or 3, just gather cubes to the "side" to fill the gap
                let targets: Position[] = [];
                for (let i = 0; i < subpillar.length; i++) {
                    targets.push([side, minY + i, minZ]);
                }
                // Get all cubes in the low component that are not directly underneath the pillar
                let potentialCubesToPickFromLowComponent = clearLowComponent.filter(p =>
                    !(p[0] === clearingPillar[0][0])
                );

                // just gather the cubes to the targets
                // a list with all cubes that we have moved already. To be moved back before executing the moves.
                // They are mapped [to, from]
                let cubesMoved: [Position, Position][] = [];

                // fill the targets from top to bottom
                for (let i = targets.length - 1; i >= 0; i--) {
                    if (this.configuration.hasCube(targets[i])) continue; // skip this target if it already contains a cube
                    
                    // get a non-cut cube in the low component
                    let cubeToMove = this.findStableCube(potentialCubesToPickFromLowComponent);
                    if (!cubeToMove) {
                        break; // there are no cubes anymore in the low component.
                    }
                    let path = this.configuration.shortestMovePath(cubeToMove, targets[i]);

                    cubesMoved.push([targets[i], cubeToMove]);
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, targets[i]);
                    potentialCubesToPickFromLowComponent = potentialCubesToPickFromLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));

                    if (path.length === 0) {
                        throw new Error("There is no valid movepath from this cube to its target.");
                    }
                    moveSequence = moveSequence.concat(path);
                }

                // move the cubes we moved temporarily to calculate movepaths back to their original position such that they can be moved back 
                for (let entry of cubesMoved) {
                    let to = entry[0];
                    let from = entry[1];
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                }
            } else {
                // there is not enough cubes to perform a zipper, so gather cubes and do a "fold"
                let targets: Position[] = [];
                let minZ = this.configuration.bounds()[2];
                let maxYOpen = subpillar[subpillar.length - 1][1] - 1;
                for (let i = 0; i < clearLowComponent.length - 1; i++) {
                    targets.push([side, maxYOpen - i, minZ]);
                }

                // Get all cubes in the low component that are not directly underneath the pillar and are not already a target.
                let potentialCubesToPickFromLowComponent = clearLowComponent.filter(p =>
                    !(p[0] === clearingPillar[0][0])
                );

                // a list with all cubes that we have moved already. To be moved back before executing the moves.
                // They are mapped [to, from]
                let cubesMoved: [Position, Position][] = [];

                // fill the targets
                for (let i = 0; i < targets.length; i++) {
                    // get a non-cut cube in the low component

                    let cubeToMove = this.findStableCube(potentialCubesToPickFromLowComponent);
                    if (!cubeToMove) {
                        break; // there are no cubes anymore in the low component.
                    }
                    let path = this.configuration.shortestMovePath(cubeToMove, targets[i]);

                    cubesMoved.push([targets[i], cubeToMove]);
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(cubeToMove)!, targets[i]);
                    potentialCubesToPickFromLowComponent = potentialCubesToPickFromLowComponent.filter(p => !(p[0] === cubeToMove![0] && p[1] === cubeToMove![1] && p[2] === cubeToMove![2]));

                    if (path.length === 0) {
                        throw new Error("There is no valid movepath from this cube to its target.");
                    }
                    moveSequence = moveSequence.concat(path);
                }

                // move the cubes we moved temporarily to calculate movepaths back to their original position such that they can be moved back 
                for (let entry of cubesMoved) {
                    let to = entry[0];
                    let from = entry[1];
                    this.configuration.moveCubeUnmarked(this.configuration.getCube(to)!, from);
                }

                let minY = this.configuration.bounds()[1];

                // move the cube below the pillar
                moveSequence = moveSequence.concat(this.pillarCubeFoldPath([subpillar[0][0], minY, minZ], [side, maxYOpen - targets.length, minZ], true))

                // fill the rest of the "side"
                for (let i = 0; i < maxYOpen - minY - targets.length; i++) {
                    let cubeToMove = subpillar[i];
                    let target: Position = [side, maxYOpen - targets.length - 1 - i, minZ];
                    moveSequence = moveSequence.concat(this.pillarCubeFoldPath(cubeToMove, target, true));
                }
            }

            return moveSequence;
        }
    }
}

export {PillarAlgorithm}