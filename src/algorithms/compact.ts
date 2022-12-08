import {Algorithm} from "./algorithm";
import {Move, moveDirections, MoveGenerator} from "../move";
import {ComponentStatus, Cube, Position} from "../cube";

class CompactAlgorithm extends Algorithm {
    
    *execute(): MoveGenerator {
        printStep("Compacting");
        
        while (!this.configuration.isXYZMonotone()) {
            let freeMove = this.findFreeMove(true);
            let cornerMove = this.findCornerMove(true);

            let moves: Move[][] = [];
            if (freeMove.length > 0) {
                moves.push([freeMove[0]]);
            }
            if (cornerMove.length > 0) {
                moves.push(cornerMove[0]);
            }

            let maxCost = -1;
            let maxMove: Move[] | null = null;
            for (let movePath of moves) {
                let cost = this.cost(movePath[0].sourcePosition(), this.configuration.bounds());
                if (cost > maxCost) {
                    maxCost = cost;
                    maxMove = movePath;
                }
            }
            
            let chainMove = this.findChainMove(true, maxCost);
            if (chainMove.length > 0) {
                yield* chainMove[0];
            } else if (maxMove !== null) {
                yield* maxMove;
            } else {
                // no moves possible to compact
                throw "No compacting moves possible.";
            }
        }
    }

    /**
     * The cost function for the moves
     */
    cost(p: Position, bounds: [number, number, number, number, number, number]): number {
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
    findFreeMove(stopAfterFirst: boolean): Move[] | [] {
        // reverse order the cubes on cost and pick the first one that has a valid free move.
        let bounds = this.configuration.bounds();
        let cubesOrdered: Cube[] = [...this.configuration.cubes].sort((c1,c2) => this.cost(c2.p, bounds) - this.cost(c1.p, bounds));
        
        let potentialMoves: Move[] = [];
        
        for (let cube of cubesOrdered) {
            if (cube.componentStatus !== ComponentStatus.CHUNK_STABLE) continue;
            for (let direction of moveDirections) {
                let potentialMove = new Move(this.configuration, cube.p, direction);
                let target = potentialMove.targetPosition();
                let bounds = this.configuration.bounds();
                if (potentialMove.isValid() &&
                    this.cost(cube.p, bounds) > this.cost(target, bounds) &&
                    this.inBounds(target) &&
                    this.preservesChunkiness([potentialMove])) {
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
     * From all possible corning moves that reduce the total cost, this finds the move that moves the cube
     * with the highest cost
     * Possible corner moves that reduce cost:
     * xy, yz, xz, Xz, Yz, xY
     */
    findCornerMove(stopAfterFirst: boolean): [Move, Move][] | [] {
        // reverse order the cubes on cost and pick the first with a valid corner move
        let bounds = this.configuration.bounds();
        let cubesOrdered: Cube[] = [...this.configuration.cubes].sort((c1,c2) => this.cost(c2.p, bounds) - this.cost(c1.p, bounds));

        let potentialMoves: [Move, Move][] = [];
        
        let possibleCornerMoves = ['xy', 'yz', 'xz', 'Xz', 'Yz', 'Xy'];
        for (let cube of cubesOrdered) {
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
                        // there is a valid corner move, check if it preserves chunkiness
                        let firstMoveDir = cornerDirections.replace(secondMoveDir, "");
                        let firstMove = new Move(this.configuration, helperNeighbor.p, firstMoveDir);
                        let secondMove = new Move(this.configuration, cube.p, secondMoveDir);
                        
                        if (this.preservesChunkiness([firstMove, secondMove])) {
                            potentialMoves.push([firstMove, secondMove]);
                            if (stopAfterFirst) {
                                return potentialMoves;
                            }
                        }
                    }
                }
            }
        }
        
        // no move has been returned yet, so no valid corner move exists
        return potentialMoves;
    }

    /**
     * From all possible chain moves (reducing the total cost), this finds the move that moves the cube
     * with the highest cost
     * @param limit finding chainmoves is a heavy operation. If a valid move with cost limit has already been found,
     * only search for chainmoves that are better to avoid searching all chain moves.
     */
    findChainMove(stopAfterFirst: boolean, limit?: number): Move[][] | [] {
        const [minX, minY, minZ, ,] = this.configuration.bounds();
        // reverse order the cubes on cost and pick the first with a valid corner move
        let bounds = this.configuration.bounds();
        let cubesOrdered: Cube[] = [...this.configuration.cubes].sort((c1,c2) => this.cost(c2.p, bounds) - this.cost(c1.p, bounds));
        
        let potentialMoves: Move[][] = [];
        
        for (let cube of cubesOrdered) {
            if (limit && this.cost(cube.p, bounds) <= limit) break;
            if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
                if (cube.p[0] === minX) {
                    let move = this.checkZChainMove(cube);
                    if (move !== null) {
                        potentialMoves.push(move);
                        if (stopAfterFirst) return potentialMoves;
                    }
                    move = this.checkYChainMove(cube);
                    if (move !== null) {
                        potentialMoves.push(move);
                        if (stopAfterFirst) return potentialMoves;
                    }                }
                if (cube.p[1] === minY) {
                    let move = this.checkZChainMove(cube);
                    if (move !== null) {
                        potentialMoves.push(move);
                        if (stopAfterFirst) return potentialMoves;
                    }                    move = this.checkXChainMove(cube);
                    if (move !== null) {
                        potentialMoves.push(move);
                        if (stopAfterFirst) return potentialMoves;
                    }                }
                if (cube.p[2] === minZ) {
                    let move = this.checkYChainMove(cube);
                    if (move !== null) {
                        potentialMoves.push(move);
                        if (stopAfterFirst) return potentialMoves;
                    }                    move = this.checkXChainMove(cube);
                    if (move !== null) {
                        potentialMoves.push(move);
                        if (stopAfterFirst) return potentialMoves;
                    }                }
            }
        }
        return potentialMoves;
    }
    
    checkXChainMove(cube: Cube): Move[] | null {
        const minX = this.configuration.bounds()[0];
        let lastCube: Cube | null = null;
        for (let x = cube.p[0] - 1; x >= minX; x--) {
            if (!this.configuration.hasCube([x - 1, cube.p[1], cube.p[2]]) && this.configuration.hasCube([x, cube.p[1], cube.p[2]])) {
                lastCube = this.configuration.getCube([x, cube.p[1], cube.p[2]])!;
                if (lastCube.componentStatus === ComponentStatus.LINK_CUT ||
                    lastCube.componentStatus === ComponentStatus.LINK_STABLE) {
                    lastCube = null;
                }
                break;
            }
        }
        if (lastCube !== null) {
            let target: Position = [...lastCube.p];
            target[0]--;
            if (this.inBounds(target) && !this.configuration.hasCube(target)) {
                let chainMove = this.configuration.shortestMovePath(cube.p, target);
                if (chainMove.length === 0) {
                    throw Error("Shortest path has length 0");
                }
                if (this.preservesChunkiness(chainMove)) return chainMove;
            }
        }
        return null;
    }
    
    checkYChainMove(cube: Cube): Move[] | null {
        const minY = this.configuration.bounds()[1];
        let lastCube: Cube | null = null;
        for (let y = cube.p[1] - 1; y >= minY; y--) {
            if (!this.configuration.hasCube([cube.p[0], y - 1, cube.p[2]]) && this.configuration.hasCube([cube.p[0], y, cube.p[2]])) {
                lastCube = this.configuration.getCube([cube.p[0], y, cube.p[2]])!;
                if (lastCube.componentStatus === ComponentStatus.LINK_CUT ||
                    lastCube.componentStatus === ComponentStatus.LINK_STABLE) {
                    lastCube = null;
                }
                break;
            }
        }
        if (lastCube !== null) {
            let target: Position = [...lastCube.p];
            target[1]--;
            if (this.inBounds(target) && !this.configuration.hasCube(target)) {
                let chainMove = this.configuration.shortestMovePath(cube.p, target);
                if (chainMove.length === 0) {
                    throw Error("Shortest path has length 0");
                }
                if (this.preservesChunkiness(chainMove)) return chainMove;
            }
        }
        return null;
    }

    checkZChainMove(cube: Cube): Move[] | null {
        const minZ = this.configuration.bounds()[2];
        let lastCube: Cube | null = null;
        for (let z = cube.p[2] - 1; z >= minZ; z--) {
            if (!this.configuration.hasCube([cube.p[0], cube.p[1], z - 1]) && this.configuration.hasCube([cube.p[0], cube.p[1], z])) {
                lastCube = this.configuration.getCube([cube.p[0], cube.p[1], z])!;
                if (lastCube.componentStatus === ComponentStatus.LINK_CUT ||
                    lastCube.componentStatus === ComponentStatus.LINK_STABLE) {
                    lastCube = null;
                }
                break;
            }
        }
        if (lastCube !== null) {
            let target: Position = [...lastCube.p];
            target[2]--;
            if (this.inBounds(target)) {
                let chainMove = this.configuration.shortestMovePath(cube.p, target);
                if (chainMove.length === 0 && !this.configuration.hasCube(target)) {
                    throw Error("Shortest path has length 0");
                }
                if (this.preservesChunkiness(chainMove)) return chainMove;
            }
        }
        return null;
    }
    
    // /**
    //  * From all possible chain moves (reducing the total cost), this finds the move that moves the cube
    //  * with the highest cost
    //  */
    // findChainMove(): Move[] | null {
    //     let potentialMoves: Move[][] = [];
    //     const [minX, minY, minZ, maxX, maxY, maxZ] = this.configuration.bounds();
    //    
    //     let potentialXReducingCubes: (Cube | null)[] = [];
    //     // bottom plane
    //     for (let y = maxY; y >= minY; y--) {
    //         for (let x = maxX; x >= minX; x--) {
    //             if (this.configuration.hasCube([x, y, minZ])) {
    //                 const cube = this.configuration.getCube([x, y, minZ])!;
    //                 if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
    //                     potentialXReducingCubes.push(cube);
    //                 } else {
    //                     potentialXReducingCubes.push(null);
    //                 }
    //                 break;
    //             }
    //         } 
    //     }
    //     // front-most plane
    //     for (let z = maxZ; z >= minZ; z--) {
    //         for (let x = maxX; x >= minX; x--) {
    //             if (this.configuration.hasCube([x, minY, z])) {
    //                 const cube = this.configuration.getCube([x, minY, z])!;
    //                 if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
    //                     potentialXReducingCubes.push(cube);
    //                 } else {
    //                     potentialXReducingCubes.push(null);
    //                 }
    //                 break;
    //             }            
    //         }
    //     }
    //    
    //     let potentialYReducingCubes: (Cube | null)[] = [];
    //     // bottom plane
    //     for (let x = maxX; x >= minX; x--) {
    //         for (let y = maxY; y >= minY; y--) {
    //             if (this.configuration.hasCube([x, y, minZ])) {
    //                 const cube = this.configuration.getCube([x, y, minZ])!;
    //                 if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
    //                     potentialYReducingCubes.push(cube);
    //                 } else {
    //                     potentialYReducingCubes.push(null);
    //                 }
    //                 break;
    //             }
    //         }
    //     }
    //     // left-most plane
    //     for (let z = maxZ; z >= minZ; z--) {
    //         for (let y = maxY; y >= minY; y--) {
    //             if (this.configuration.hasCube([minX, y, z])) {
    //                 const cube = this.configuration.getCube([minX, y, z])!;
    //                 if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
    //                     potentialYReducingCubes.push(cube);
    //                 } else {
    //                     potentialYReducingCubes.push(null);
    //                 }
    //                 break;
    //             }
    //         }
    //     }
    //    
    //     let potentialZReducingCubes: (Cube | null)[] = [];
    //     // front-most plane
    //     for (let x = maxX; x >= minX; x--) {
    //         for (let z = maxZ; z >= minZ; z--) {
    //             if (this.configuration.hasCube([x, minY, z])) {
    //                 const cube = this.configuration.getCube([x, minY, z])!;
    //                 if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
    //                     potentialZReducingCubes.push(cube);
    //                 } else {
    //                     potentialZReducingCubes.push(null);
    //                 }
    //                 break;
    //             }
    //         }
    //     }
    //     // left-most plane
    //     for (let y = maxY; y >= minY; y--) {
    //         for (let z = maxZ; z >= minZ; z--) {
    //             if (this.configuration.hasCube([minX, y, z])) {
    //                 const cube = this.configuration.getCube([minX, y, z])!;
    //                 if (cube.componentStatus === ComponentStatus.CHUNK_STABLE) {
    //                     potentialZReducingCubes.push(cube);
    //                 } else {
    //                     potentialZReducingCubes.push(null);
    //                 }
    //                 break;
    //             }
    //         }
    //     }
    //    
    //     // if no valid cubes are found, there is no chain move
    //     if (potentialXReducingCubes.length === 0 &&
    //         potentialYReducingCubes.length === 0 &&
    //         potentialZReducingCubes.length === 0) {
    //         return null;
    //     }
    //    
    //     let potentialXReducingLastCubes: (Cube | null)[] = [];
    //     for (let cube of potentialXReducingCubes) {
    //         if (cube === null) {
    //             potentialXReducingLastCubes.push(null);
    //             continue;
    //         }
    //         let foundLastCube: boolean = false;
    //         for (let x = cube.p[0] - 1; x > minX; x--) {
    //             if (!this.configuration.hasCube([x - 1, cube.p[1], cube.p[2]]) && this.configuration.hasCube([x, cube.p[1], cube.p[2]])) {
    //                 let lastCube = this.configuration.getCube([x, cube.p[1], cube.p[2]])!;
    //                 if (lastCube.componentStatus === ComponentStatus.LINK_CUT ||
    //                     lastCube.componentStatus === ComponentStatus.LINK_STABLE) {
    //                     break;
    //                 }
    //                 potentialXReducingLastCubes.push(lastCube);
    //                 foundLastCube = true;
    //                 break;
    //             }
    //         }
    //         if (!foundLastCube) potentialXReducingLastCubes.push(null);
    //     }
    //    
    //     let potentialYReducingLastCubes: (Cube | null)[] = [];
    //     for (let cube of potentialYReducingCubes) {
    //         if (cube === null) {
    //             potentialYReducingLastCubes.push(null);
    //             continue;
    //         }
    //         let foundLastCube: boolean = false;
    //         for (let y = cube.p[1] - 1; y > minY; y--) {
    //             if (!this.configuration.hasCube([cube.p[0], y - 1, cube.p[2]]) && this.configuration.hasCube([cube.p[0], y, cube.p[2]])) {
    //                 let lastCube = this.configuration.getCube([cube.p[0], y, cube.p[2]])!;
    //                 if (lastCube.componentStatus === ComponentStatus.LINK_CUT ||
    //                     lastCube.componentStatus === ComponentStatus.LINK_STABLE) {
    //                     break;
    //                 }
    //                 potentialYReducingLastCubes.push(lastCube);
    //                 foundLastCube = true;
    //                 break;
    //             }
    //         }
    //         if (!foundLastCube) potentialYReducingLastCubes.push(null);
    //     }
    //    
    //     let potentialZReducingLastCubes: (Cube | null)[] = [];
    //     for (let cube of potentialZReducingCubes) {
    //         if (cube === null) {
    //             potentialZReducingLastCubes.push(null);
    //             continue;
    //         }
    //         let foundLastCube: boolean = false;
    //         for (let z = cube.p[2] - 1; z > minZ; z--) {
    //             if (!this.configuration.hasCube([cube.p[0], cube.p[1], z - 1]) && this.configuration.hasCube([cube.p[0], cube.p[1], z])) {
    //                 let lastCube = this.configuration.getCube([cube.p[0], cube.p[1], z])!;
    //                 if (lastCube.componentStatus === ComponentStatus.LINK_CUT ||
    //                     lastCube.componentStatus === ComponentStatus.LINK_STABLE) {
    //                     break;
    //                 }
    //                 potentialZReducingLastCubes.push(lastCube);
    //                 foundLastCube = true;
    //                 break;
    //             }
    //         }
    //         if (!foundLastCube) potentialZReducingLastCubes.push(null);
    //     }
    //    
    //     if (potentialXReducingCubes.length !== potentialXReducingLastCubes.length) {
    //         throw "Not every chain cube has a destination.";
    //     }
    //     if (potentialYReducingCubes.length !== potentialYReducingLastCubes.length) {
    //         throw "Not every chain cube has a destination.";
    //     }
    //     if (potentialZReducingCubes.length !== potentialZReducingLastCubes.length) {
    //         throw "Not every chain cube has a destination.";
    //     }
    //    
    //     let potentialMovesWithoutChunkiness: Move[][] = [];
    //     for (let i = 0; i < potentialXReducingCubes.length; i++) {
    //         let startCube = potentialXReducingCubes[i];
    //         let targetCube = potentialXReducingLastCubes[i];
    //         if (startCube === null || targetCube === null) continue;
    //         let target: Position = [...targetCube.p];
    //         target[0]--;
    //         potentialMovesWithoutChunkiness.push(this.configuration.shortestMovePath(startCube.p, target));
    //     }
    //     for (let i = 0; i < potentialYReducingCubes.length; i++) {
    //         let startCube = potentialYReducingCubes[i];
    //         let targetCube = potentialYReducingLastCubes[i];
    //         if (startCube === null || targetCube === null) continue;
    //         let target: Position = [...targetCube.p];
    //         target[1]--;
    //         potentialMovesWithoutChunkiness.push(this.configuration.shortestMovePath(startCube.p, target));
    //     }
    //     for (let i = 0; i < potentialZReducingCubes.length; i++) {
    //         let startCube = potentialZReducingCubes[i];
    //         let targetCube = potentialZReducingLastCubes[i];
    //         if (startCube === null || targetCube === null) continue;
    //         let target: Position = [...targetCube.p];
    //         target[2]--;
    //         potentialMovesWithoutChunkiness.push(this.configuration.shortestMovePath(startCube.p, target));
    //     }
    //    
    //     for (let potentialPath of potentialMovesWithoutChunkiness) {
    //         if (this.preservesChunkiness(potentialPath)) {
    //             potentialMoves.push(potentialPath);
    //         }
    //     }
    //
    //     // find the chain move with highest cost
    //     let maxCostStart = Math.max(...potentialMoves.map(potentialMove => {return this.cost(potentialMove[0].sourcePosition());}));
    //     let maxMove = potentialMoves.find(potentialMove => {return this.cost(potentialMove[0].sourcePosition()) === maxCostStart;});
    //
    //     return maxMove ?? null;
    // }
    
    /**
     * Checks if a series of moves preserves the "chunkiness",
     * i.e. all cubes stay in the same chunk and keep the same componentStatus.
     * Only the starting configuration and the ending configuration are compared.
     */
    preservesChunkiness(moves: Move[]): boolean {
        let originalComponentStatus: ComponentStatus[] = this.configuration.cubes.map(cube => {return cube.componentStatus;});
        let originalHeavyChunk: boolean[] = this.configuration.cubes.map(cube => {return cube.heavyChunk;});
        let originalChunkIds: number[] = this.configuration.cubes.map(cube => {return cube.chunkId;});
        
        let preservesChunkiness = true;
        let movesApplied = -1;
        
        // for each move along the way should be valid
        for (let i = 0; i < moves.length; i++) {
            // // first check if the move is valid
            let move = moves[i];
            if (!move.isValid()) {
                movesApplied = i;
                preservesChunkiness = false;
                break;
            }
            let cube = this.configuration.getCube(move.sourcePosition())!;
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
            this.configuration.cubes[i].setComponentStatus(originalComponentStatus[i], originalHeavyChunk[i]);
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
                if (originalChunks[j] === originalChunks[i] && originalChunks[i] !== -1) {
                    checked[j] = true;
                    if (newChunks[j] !== newChunks[i]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
}

export {CompactAlgorithm}