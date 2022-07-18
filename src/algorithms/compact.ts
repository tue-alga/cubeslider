import {Algorithm} from "./algorithm";
import {Move, moveDirections, MoveGenerator} from "../move";
import {ComponentStatus, Cube, Position} from "../cube";

class CompactAlgorithm extends Algorithm {
    
    *execute(): MoveGenerator {
        printStep("Compacting");
        
        while (!this.configuration.isXYZMonotone()) {
            let freeMove = this.findFreeMove();
            let cornerMove = this.findCornerMove();
            // pick the highest cost of the two
            if (freeMove !== null && cornerMove !== null) {
                let freeMoveCost = this.cost(freeMove.sourcePosition());
                let cornerMoveCost = this.cost(cornerMove[1].sourcePosition());
                if (freeMoveCost > cornerMoveCost) {
                    yield freeMove;
                } else {
                    yield* cornerMove;
                }
            } else {
                if (freeMove !== null) {
                    yield freeMove;
                } else if (cornerMove !== null) {
                    yield* cornerMove;
                }
            }
        }
    }

    /**
     * The cost function for the moves
     */
    cost(p: Position): number {
        let bounds = this.configuration.bounds();
        let [x, y, z] = [p[0] - bounds[0], p[1] - bounds[1], p[2] - bounds[2]];
        return x + 2 * y + 4 * z;
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
     * From all possible free moves (reducing the total cost), this finds the move that moves the cube
     * with the highest cost
     */
    findFreeMove(): Move | null {
        let potentialMoves: Move[] = [];
        for (let cube of this.configuration.cubes) {
            if (cube.componentStatus !== ComponentStatus.CHUNK_STABLE) continue;
            for (let direction of moveDirections) {
                let potentialMove = new Move(this.configuration, cube.p, direction);
                let target = potentialMove.targetPosition();
                if (potentialMove.isValid() &&
                    this.cost(cube.p) > this.cost(target) &&
                    this.inBounds(target) &&
                    this.preservesChunkiness([potentialMove])) {
                    potentialMoves.push(potentialMove);
                }
            }
        }
        
        if (potentialMoves.length === 0) return null;
        
        // return the move that moves the cube with the highest cost
        let maxCostStart = Math.max(...potentialMoves.map(move => {return this.cost(move.sourcePosition());}));
        let maxMove = potentialMoves.find(move => {return this.cost(move.sourcePosition()) === maxCostStart;});
        
        return maxMove!;
    }

    /**
     * From all possible corning moves that reduce the total cost, this finds the move that moves the cube
     * with the highest cost
     * Possible corner moves that reduce cost:
     * xy, yz, xz, Xz, Yz, xY
     */
    findCornerMove(): [Move, Move] | null {
        let potentialCornerMoves: [Move, Move][] = [];
        let possibleCornerMoves = ['xy', 'yz', 'xz', 'Xz', 'Yz', 'xY'];
        for (let cube of this.configuration.cubes) {
            if (cube.componentStatus !== ComponentStatus.CHUNK_STABLE) continue;
            const neighbors = this.configuration.getNeighborMap(cube.p);
            for (let cornerDirections of possibleCornerMoves) {
                if (!neighbors[cornerDirections] && neighbors[cornerDirections[0]] && neighbors[cornerDirections[1]]) {
                    let helperNeighbor: Cube | null = null;
                    let secondMoveDir: string | null = null;
                    
                    // check if one of the neighbors is free to do a corner move with
                    for (let dir of cornerDirections) {
                        if (neighbors[dir]) {
                            let neighbor = neighbors[dir]!;
                            if (neighbor.componentStatus === ComponentStatus.CHUNK_STABLE) {
                                helperNeighbor = neighbor;
                                secondMoveDir = dir;
                                break;
                            }
                        }
                    }

                    if (helperNeighbor !== null && secondMoveDir !== null) {
                        // there is a valid cornermove, check if it preserves chunkiness
                        let firstMoveDir = cornerDirections.replace(secondMoveDir, "");
                        let firstMove = new Move(this.configuration, helperNeighbor.p, firstMoveDir);
                        let secondMove = new Move(this.configuration, cube.p, secondMoveDir);
                        
                        if (this.preservesChunkiness([firstMove, secondMove])) {
                            potentialCornerMoves.push([firstMove, secondMove]);
                        }
                    }
                }
            }
        }
        
        // loop over all potential cornermoves to find the one with highest cost cube involved
        if (potentialCornerMoves.length === 0) {
            return null;
        }
        
        let highestCost = 0;
        let highestCostCorner: [Move, Move] = potentialCornerMoves[0];
        
        for (let potentialMove of potentialCornerMoves) {
            let cost = this.cost(potentialMove[1].sourcePosition());
            if (cost > highestCost) {
                highestCost = cost;
                highestCostCorner = potentialMove;
            }
        }
        return highestCostCorner;
    }
    
    /**
     * Checks if a series of moves preserves the "chunkiness",
     * i.e. all cubes stay in the same chunk and keep the same componentStatus
     * after executing the move.
     */
    preservesChunkiness(moves: Move[]): boolean {
        
        let originalComponentStatus: ComponentStatus[] = this.configuration.cubes.map(cube => {return cube.componentStatus;});
        let originalChunkIds: number[] = this.configuration.cubes.map(cube => {return cube.chunkId;});
        
        let preservesChunkiness = true;
        let movesApplied = -1;
        
        // for each move along the way, the chunkiness should be preserved
        for (let i = 0; i < moves.length; i++) {
            // first check if the move is valid
            let move = moves[i];
            if (!move.isValid()) {
                movesApplied = i;
                preservesChunkiness = false;
                break;
            }
            let cube = this.configuration.getCube(move.sourcePosition());
            if (cube === null) {
                movesApplied = i;
                preservesChunkiness = false;
                break;
            }
            
            // move the cube
            this.configuration.moveCube(cube, move.targetPosition());
        }

        // for all cubes that were in a chunk, they should be together in a chunk again.
        let newChunkIds: number[] = this.configuration.cubes.map(cube => {return cube.chunkId;});
        if (!this.checkMarks(originalChunkIds, newChunkIds)) {
            preservesChunkiness = false;
        }
        
        // Al moves were legal, so we have to undo all of them
        if (movesApplied === -1) {
            movesApplied = moves.length;
        }
        
        // undo all moves we did by going through the moves backwards
        for (let j = movesApplied - 1; j >= 0; j--) {
            let moveToUndo = moves[j];
            let cube = this.configuration.getCube(moveToUndo.targetPosition())!;
            this.configuration.moveCubeUnmarked(cube, moveToUndo.sourcePosition());
        }
        for (let i = 0; i < this.configuration.cubes.length; i++) {
            this.configuration.cubes[i].setComponentStatus(originalComponentStatus[i]);
            this.configuration.cubes[i].setChunkId(originalChunkIds[i]);
        }
        
        return preservesChunkiness;
    }

    /**
     * Checks if each cube is in a chunk with the same cubes as before, more specifically:
     * for each set of cubes with the same chunkId i in the original array, all of these should have the same
     * number j in the new array, note that it might be possible that i != j.
     * @param originalChunks
     * @param newChunks
     * @private
     */
    private checkMarks(originalChunks: number[], newChunks: number[]): boolean {
        if (originalChunks.length !== newChunks.length) {
            throw new Error("Checking chunk ids from configurations with different amount of cubes.");
        }
        let checked = Array(originalChunks.length).fill(false);
        for (let i = 0; i < originalChunks.length; i++) {
            if (checked[i]) continue;
            
            checked[i] = true;
            // check every item from i onwards            
            for (let j = i; j < originalChunks.length; j++) {
                if (originalChunks[j] === originalChunks[i]) {
                    checked[j] = true;
                    if (newChunks[j] !== originalChunks[i]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
}

export {CompactAlgorithm}